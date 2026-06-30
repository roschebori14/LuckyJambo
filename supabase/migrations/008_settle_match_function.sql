-- Lucky Jambo - Match settlement
--
-- Fixes lib/games/prize-distributor.ts + game-settlement.ts, which:
--   - did a plain wallet.balance + amount update (unsafe, no locking,
--     bypassed wallet_ledger entirely)
--   - paid the winner stake_amount * 2 in full, with no platform
--     commission deducted (settings.platform_fee_percent = 5 was
--     already seeded but never read anywhere)
--   - never released either player's locked_balance, so the locked
--     stake just sat frozen forever while the winner *also* got a
--     fresh stake*2 credit - balances would inflate with every match
--   - was reachable via /api/games/settle with NO auth check at all,
--     trusting a client-supplied winner_id directly
--
-- This function is the only legitimate way to settle a match now. It
-- takes its caller's identity from auth.uid() (must be one of the two
-- match participants - a random third party can't call it even if
-- they know the match_id) and independently looks up who the two
-- participants actually are rather than trusting the winner_id alone.

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

  -- Lock both wallets in a deterministic order (by user_id) so two
  -- matches settling concurrently can never deadlock against each
  -- other.
  if p_winner_id < v_loser_id then
    v_first_id := p_winner_id;
    v_second_id := v_loser_id;
  else
    v_first_id := v_loser_id;
    v_second_id := p_winner_id;
  end if;

  perform 1 from wallets where user_id = v_first_id for update;
  perform 1 from wallets where user_id = v_second_id for update;

  -- Loser: their locked stake is gone. No available_balance change -
  -- it already left available_balance when they locked the stake.
  perform public.apply_wallet_transaction(
    v_loser_id, 'match_loss', v_match.stake_amount, p_match_id::text, 'Lost match'
  );

  -- Winner: their own locked stake is released as part of the prize
  -- pool, and they're credited the net payout (pool minus commission).
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
      winner_id = p_winner_id
  where id = p_match_id
  returning * into v_match;

  return v_match;
end;
$$;
