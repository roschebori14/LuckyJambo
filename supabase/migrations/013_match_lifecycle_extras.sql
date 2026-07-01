-- Lucky Jambo - Match lifecycle extras
--
-- Three additions:
--   1. updated_at + trigger on matches, so we can detect staleness
--      (a match nobody has touched in N hours) without relying on
--      created_at, which doesn't move when moves are made.
--   2. invited_user_id - lets a match be created as a direct friend
--      challenge that only the invited friend can join, instead of
--      every match being open to any stranger.
--   3. commission_amount - settle_match now records exactly how much
--      platform fee was taken on each match, so the admin revenue
--      dashboard can sum it directly instead of recomputing.

alter table matches
add column if not exists updated_at timestamptz default now(),
add column if not exists invited_user_id uuid references profiles(id),
add column if not exists commission_amount numeric(12,2);

create or replace function public.touch_match_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_matches_touch_updated_at on matches;
create trigger trg_matches_touch_updated_at
before update on matches
for each row
execute function public.touch_match_updated_at();

-- Redefine join_match to respect a private invite: if invited_user_id
-- is set, only that user may join (anyone else is rejected even if
-- they discover the match_id), and to forfeit a match silently
-- expiring the invite isn't needed since the creator can cancel.
create or replace function public.join_match(
  p_match_id uuid
)
returns matches
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match matches%rowtype;
begin
  select * into v_match from matches where id = p_match_id for update;

  if not found then
    raise exception 'Match not found';
  end if;

  if v_match.status != 'waiting' then
    raise exception 'Match is no longer open';
  end if;

  if v_match.creator_id = auth.uid() then
    raise exception 'You cannot join your own match';
  end if;

  if v_match.invited_user_id is not null and v_match.invited_user_id != auth.uid() then
    raise exception 'This match is a private challenge for another player';
  end if;

  perform public.apply_wallet_transaction(
    auth.uid(), 'match_stake', v_match.stake_amount, null, 'Stake to join match'
  );

  insert into match_participants (match_id, user_id)
  values (p_match_id, auth.uid());

  update matches
  set status = 'active'
  where id = p_match_id
  returning * into v_match;

  return v_match;
end;
$$;

-- Redefine create_match to accept an optional invited friend.
create or replace function public.create_match(
  p_game_slug text,
  p_stake_amount numeric,
  p_invited_user_id uuid default null
)
returns matches
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game games%rowtype;
  v_match matches%rowtype;
begin
  select * into v_game from games where slug = p_game_slug and is_active = true;

  if not found then
    raise exception 'Unknown or inactive game %', p_game_slug;
  end if;

  if p_stake_amount < v_game.min_stake or p_stake_amount > v_game.max_stake then
    raise exception 'Stake must be between % and %', v_game.min_stake, v_game.max_stake;
  end if;

  if p_invited_user_id is not null and p_invited_user_id = auth.uid() then
    raise exception 'You cannot challenge yourself';
  end if;

  perform public.apply_wallet_transaction(
    auth.uid(), 'match_stake', p_stake_amount, null, 'Stake for new ' || v_game.name || ' match'
  );

  insert into matches (game_id, creator_id, stake_amount, total_pot, status, invited_user_id)
  values (v_game.id, auth.uid(), p_stake_amount, p_stake_amount * 2, 'waiting', p_invited_user_id)
  returning * into v_match;

  insert into match_participants (match_id, user_id)
  values (v_match.id, auth.uid());

  return v_match;
end;
$$;

-- Redefine settle_match to also record the commission taken, used by
-- the admin revenue dashboard.
create or replace function public.settle_match(
  p_match_id uuid,
  p_winner_id uuid
)
returns matches
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match matches%rowtype;
  v_participants uuid[];
  v_loser_id uuid;
  v_fee_percent numeric;
  v_prize_pool numeric;
  v_commission numeric;
  v_net_payout numeric;
  v_first_id uuid;
  v_second_id uuid;
begin
  select * into v_match from matches where id = p_match_id for update;

  if not found then
    raise exception 'Match not found';
  end if;

  if v_match.status != 'active' then
    raise exception 'Match is not active';
  end if;

  select array_agg(user_id) into v_participants
  from match_participants
  where match_id = p_match_id;

  if array_length(v_participants, 1) != 2 then
    raise exception 'Match does not have exactly two participants';
  end if;

  if not (auth.uid() = any(v_participants)) then
    raise exception 'Only a match participant can settle this match';
  end if;

  if not (p_winner_id = any(v_participants)) then
    raise exception 'Winner must be a match participant';
  end if;

  v_loser_id := (
    select user_id from unnest(v_participants) as user_id
    where user_id != p_winner_id
  );

  select coalesce(value::numeric, 5) into v_fee_percent
  from settings where key = 'platform_fee_percent';

  v_prize_pool := v_match.stake_amount * 2;
  v_commission := round(v_prize_pool * v_fee_percent / 100, 2);
  v_net_payout := v_prize_pool - v_commission;

  if p_winner_id < v_loser_id then
    v_first_id := p_winner_id; v_second_id := v_loser_id;
  else
    v_first_id := v_loser_id; v_second_id := p_winner_id;
  end if;

  perform 1 from wallets where user_id = v_first_id for update;
  perform 1 from wallets where user_id = v_second_id for update;

  perform public.apply_wallet_transaction(
    v_loser_id, 'match_loss', v_match.stake_amount, p_match_id::text, 'Lost match'
  );

  update wallets
  set locked_balance = locked_balance - v_match.stake_amount,
      updated_at = now()
  where user_id = p_winner_id;

  perform public.apply_wallet_transaction(
    p_winner_id, 'match_win', v_net_payout, p_match_id::text,
    'Won match (pool ' || v_prize_pool || ', commission ' || v_commission || ')'
  );

  update matches
  set status = 'completed',
      winner_id = p_winner_id,
      commission_amount = v_commission
  where id = p_match_id
  returning * into v_match;

  return v_match;
end;
$$;

-- Lets the opponent of an inactive player claim a forfeit win after a
-- match has had no activity for the given timeout. Prevents a match's
-- stake sitting locked forever if one player simply disappears.
-- p_timeout_minutes is passed by the caller (API route) based on game
-- type - instant games time out fast, turn-based games get longer.
create or replace function public.claim_forfeit_win(
  p_match_id uuid,
  p_timeout_minutes integer default 60
)
returns matches
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match matches%rowtype;
  v_participants uuid[];
begin
  select * into v_match from matches where id = p_match_id for update;

  if not found then
    raise exception 'Match not found';
  end if;

  if v_match.status != 'active' then
    raise exception 'Match is not active';
  end if;

  if v_match.updated_at > now() - (p_timeout_minutes || ' minutes')::interval then
    raise exception 'Match has not been inactive long enough to claim forfeit';
  end if;

  select array_agg(user_id) into v_participants
  from match_participants where match_id = p_match_id;

  if not (auth.uid() = any(v_participants)) then
    raise exception 'Only a match participant can claim forfeit';
  end if;

  -- The caller claiming forfeit is declared the winner - they are the
  -- one who showed up to claim it, the other side went silent.
  return public.settle_match(p_match_id, auth.uid());
end;
$$;
