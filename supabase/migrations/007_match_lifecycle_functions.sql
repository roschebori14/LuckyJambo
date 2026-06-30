-- Lucky Jambo - Match lifecycle functions
--
-- These replace MatchService/StakeLocker's direct table writes, which
-- had two problems: they used unsafe read-then-write balance updates
-- (a money app needs atomic, locked updates - see
-- 004_apply_wallet_transaction.sql), and matches/match_participants
-- has no INSERT/UPDATE policy for regular users, so those writes were
-- being silently rejected by RLS anyway. Routing everything through
-- security definer functions fixes both: they run with the rights to
-- write these tables, and they're the only path that can.
--
-- Every function below takes the caller's identity from auth.uid(),
-- never from a request body param, so a request can't act as another
-- user.

create or replace function public.create_match(
  p_game_slug text,
  p_stake_amount numeric
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

  -- Locks the creator's stake (available -> locked). Raises if they
  -- don't have enough available balance.
  perform public.apply_wallet_transaction(
    auth.uid(), 'match_stake', p_stake_amount, null, 'Stake for new ' || v_game.name || ' match'
  );

  insert into matches (game_id, creator_id, stake_amount, total_pot, status)
  values (v_game.id, auth.uid(), p_stake_amount, p_stake_amount * 2, 'waiting')
  returning * into v_match;

  insert into match_participants (match_id, user_id)
  values (v_match.id, auth.uid());

  return v_match;
end;
$$;

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

create or replace function public.cancel_match(
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

  if v_match.creator_id != auth.uid() then
    raise exception 'Only the creator can cancel this match';
  end if;

  if v_match.status != 'waiting' then
    raise exception 'Match already has an opponent and cannot be cancelled';
  end if;

  perform public.apply_wallet_transaction(
    auth.uid(), 'refund', v_match.stake_amount, null, 'Match cancelled, stake released'
  );

  update matches
  set status = 'cancelled'
  where id = p_match_id
  returning * into v_match;

  return v_match;
end;
$$;
