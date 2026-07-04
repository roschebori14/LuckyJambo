-- Lucky Jambo - Track *why* a match ended
--
-- Right now every path that finishes a match (a real win/lose,
-- resign_match, claim_forfeit_win, early_exit_match) just sets
-- matches.status = 'completed'. That's fine for settlement, but it
-- means the UI has no way to tell "your opponent actually beat you"
-- apart from "your opponent quit on you" - both just look like
-- status = 'completed' with a winner_id. The user-facing ask is to
-- show a distinct "Opponent forfeited" state instead of a generic
-- "match ended" one, so we need to persist the reason somewhere.
--
-- Adding matches.end_reason (nullable text) for this:
--   'normal'             - the game was actually played to a decisive
--                          finish (checkmate, three-in-a-row, all
--                          ships sunk, etc.)
--   'resigned'           - a player voluntarily resigned
--                          (resign_match)
--   'forfeited_timeout'  - the opponent went quiet and the other
--                          player claimed the forfeit win
--                          (claim_forfeit_win)
--   'early_exit'         - a player pulled their locked stake back
--                          out early with the 0.5% penalty
--                          (early_exit_match)
--
-- settle_match gets a new optional 4th param, p_end_reason, that
-- defaults to 'normal' - every existing call site (the game engines
-- settling a real decisive finish) keeps working unchanged and is
-- correctly tagged 'normal' by default. Only resign_match and
-- claim_forfeit_win are updated to pass their own specific reason.

alter table matches
add column if not exists end_reason text;

-- IMPORTANT: settle_match is gaining a 3rd parameter. In Postgres,
-- create-or-replace only replaces a function whose *signature* (arg
-- types) matches exactly - adding a parameter (even with a default)
-- creates a brand-new overload sitting alongside the old
-- settle_match(uuid, uuid) instead of replacing it. Every existing
-- call site in the game engines (tic-tac-toe, chess, draughts,
-- battleship, snakes & ladders, instant games) calls
-- `perform public.settle_match(p_match_id, v_winner_id)` with exactly
-- two args, which would keep resolving to that stale 2-arg overload
-- forever (never tagging end_reason, defeating this whole migration).
-- Dropping the old 2-arg overload first forces every 2-arg call site
-- to resolve to the new 3-arg version instead (using its default),
-- so end_reason = 'normal' is applied everywhere automatically.
drop function if exists public.settle_match(uuid, uuid);

create or replace function public.settle_match(
  p_match_id uuid,
  p_winner_id uuid,
  p_end_reason text default 'normal'
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

  if not found then raise exception 'Match not found'; end if;
  if v_match.status != 'active' then raise exception 'Match is not active'; end if;

  select array_agg(user_id) into v_participants
  from match_participants where match_id = p_match_id;

  if array_length(v_participants, 1) != 2 then
    raise exception 'Match does not have exactly two participants';
  end if;
  if not (auth.uid() = any(v_participants)) then
    raise exception 'Only a match participant can settle this match';
  end if;
  if not (p_winner_id = any(v_participants)) then
    raise exception 'Winner must be a match participant';
  end if;

  v_loser_id := (select user_id from unnest(v_participants) as user_id where user_id != p_winner_id);

  select coalesce(value::numeric, 5) into v_fee_percent from settings where key = 'platform_fee_percent';

  v_prize_pool := v_match.stake_amount * 2;
  v_commission := round(v_prize_pool * v_fee_percent / 100, 2);
  v_net_payout := v_prize_pool - v_commission;

  if p_winner_id < v_loser_id then v_first_id := p_winner_id; v_second_id := v_loser_id;
  else v_first_id := v_loser_id; v_second_id := p_winner_id; end if;

  perform 1 from wallets where user_id = v_first_id for update;
  perform 1 from wallets where user_id = v_second_id for update;

  perform public.apply_wallet_transaction(
    v_loser_id, 'match_loss', v_match.stake_amount, p_match_id::text, 'Lost match'
  );

  update wallets set locked_balance = locked_balance - v_match.stake_amount, updated_at = now()
  where user_id = p_winner_id;

  perform public.apply_wallet_transaction(
    p_winner_id, 'match_win', v_net_payout, p_match_id::text,
    'Won match (pool ' || v_prize_pool || ', commission ' || v_commission || ')'
  );

  update matches
  set status = 'completed', winner_id = p_winner_id, commission_amount = v_commission,
      end_reason = coalesce(p_end_reason, 'normal')
  where id = p_match_id
  returning * into v_match;

  perform public.notify_user(p_winner_id, 'You won! 🏆',
    'You won ' || v_net_payout || ' XAF. Funds added to your wallet.');
  perform public.notify_user(v_loser_id, 'Match result',
    case
      when coalesce(p_end_reason, 'normal') = 'resigned' then 'Your opponent resigned. You won by forfeit!'
      else 'You lost this match. Better luck next time!'
    end);

  return v_match;
end;
$$;

-- Redefine resign_match to tag the settlement as a resignation, not a
-- normal decisive finish.
create or replace function public.resign_match(
  p_match_id uuid
)
returns matches
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match matches%rowtype;
  v_participants uuid[];
  v_winner_id uuid;
begin
  select * into v_match from matches where id = p_match_id for update;

  if not found then
    raise exception 'Match not found';
  end if;

  if v_match.status != 'active' then
    raise exception 'Match is not active';
  end if;

  select array_agg(user_id) into v_participants
  from match_participants where match_id = p_match_id;

  if not (auth.uid() = any(v_participants)) then
    raise exception 'Only a match participant can resign';
  end if;

  v_winner_id := (
    select user_id from unnest(v_participants) as user_id
    where user_id != auth.uid()
  );

  if v_winner_id is null then
    raise exception 'Cannot resign a match with no opponent';
  end if;

  -- The resigning player forfeits, so the other participant is the winner.
  return public.settle_match(p_match_id, v_winner_id, 'resigned');
end;
$$;

-- Redefine claim_forfeit_win to tag the settlement as a timeout
-- forfeit rather than a normal decisive finish.
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
  return public.settle_match(p_match_id, auth.uid(), 'forfeited_timeout');
end;
$$;

-- early_exit_match doesn't go through settle_match (it has its own
-- unbalanced-payout math), so tag its own status update directly.
create or replace function public.early_exit_match(
  p_match_id uuid
)
returns matches
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match matches%rowtype;
  v_participants uuid[];
  v_opponent_id uuid;
  v_penalty numeric;
  v_refund numeric;
  v_fee_percent numeric;
  v_prize_pool numeric;
  v_commission numeric;
  v_opponent_payout numeric;
  v_first_id uuid;
  v_second_id uuid;
  v_exiting_before numeric;
  v_exiting_after numeric;
  v_exiting_wallet_id uuid;
begin
  select * into v_match from matches where id = p_match_id for update;
  if not found then raise exception 'Match not found'; end if;
  if v_match.status != 'active' then raise exception 'Match is not active'; end if;

  select array_agg(user_id) into v_participants
  from match_participants where match_id = p_match_id;

  if array_length(v_participants, 1) != 2 then
    raise exception 'Match does not have exactly two participants';
  end if;
  if not (auth.uid() = any(v_participants)) then
    raise exception 'Only a match participant can withdraw locked funds early';
  end if;

  v_opponent_id := (
    select user_id from unnest(v_participants) as user_id where user_id != auth.uid()
  );

  v_penalty := round(v_match.stake_amount * 0.005, 2);
  v_refund := v_match.stake_amount - v_penalty;

  select coalesce(value::numeric, 5) into v_fee_percent
  from settings where key = 'platform_fee_percent';

  v_prize_pool := v_match.stake_amount * 2;
  v_commission := round(v_prize_pool * v_fee_percent / 100, 2);
  v_opponent_payout := v_prize_pool - v_commission - v_refund;

  if v_opponent_payout < 0 then
    raise exception 'Early-exit penalty does not cover platform fees on this stake - contact support';
  end if;

  if auth.uid() < v_opponent_id then v_first_id := auth.uid(); v_second_id := v_opponent_id;
  else v_first_id := v_opponent_id; v_second_id := auth.uid(); end if;

  perform 1 from wallets where user_id = v_first_id for update;
  perform 1 from wallets where user_id = v_second_id for update;

  select available_balance, id into v_exiting_before, v_exiting_wallet_id
  from wallets where user_id = auth.uid();

  v_exiting_after := v_exiting_before + v_refund;

  update wallets
  set locked_balance = locked_balance - v_match.stake_amount,
      available_balance = v_exiting_after,
      updated_at = now()
  where user_id = auth.uid();

  insert into wallet_ledger (
    wallet_id, user_id, type, amount, balance_before, balance_after, reference, description
  )
  values (
    v_exiting_wallet_id, auth.uid(), 'refund', v_refund, v_exiting_before, v_exiting_after,
    p_match_id::text, 'Early exit - stake withdrawn minus 0.5% penalty'
  );

  update wallets
  set locked_balance = locked_balance - v_match.stake_amount,
      updated_at = now()
  where user_id = v_opponent_id;

  perform public.apply_wallet_transaction(
    v_opponent_id, 'match_win', v_opponent_payout, p_match_id::text,
    'Won match (opponent withdrew early - pool ' || v_prize_pool ||
    ', commission ' || v_commission || ', opponent refund ' || v_refund || ')'
  );

  update matches
  set status = 'completed', winner_id = v_opponent_id, commission_amount = v_commission,
      end_reason = 'early_exit'
  where id = p_match_id
  returning * into v_match;

  perform public.notify_user(auth.uid(), 'Stake withdrawn',
    'You withdrew ' || v_refund || ' XAF from your locked stake (0.5% early-exit fee applied). The match has ended.');
  perform public.notify_user(v_opponent_id, 'Opponent withdrew - you win!',
    'Your opponent withdrew their stake early. You won ' || v_opponent_payout || ' XAF.');

  return v_match;
end;
$$;

revoke execute on function public.settle_match(uuid, uuid, text) from public;
revoke execute on function public.settle_match(uuid, uuid, text) from anon;
grant execute on function public.settle_match(uuid, uuid, text) to authenticated;
