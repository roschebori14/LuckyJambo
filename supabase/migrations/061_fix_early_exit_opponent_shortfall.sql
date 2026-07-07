-- Lucky Jambo - Fix: early_exit_match can pay the opponent LESS than
-- their own stake back
--
-- Bug: v_opponent_payout was computed as
--   prize_pool - commission - refund
-- where commission = fee_percent% of the FULL prize_pool (stake*2),
-- exactly as in a normal 2-player settle_match. That's correct when
-- the whole pool is still in play, but here one player already pulled
-- ~99.5% of their own stake back out (refund), so there is only
-- (stake_amount + penalty) left to split between the opponent and the
-- platform - not the full pool.
--
-- Worked example that shows the bug (stake 1000, 5% platform fee):
--   penalty   = 0.5% of 1000 = 5
--   refund    = 995
--   commission (old, on full pool) = 5% of 2000 = 100
--   opponent_payout = 2000 - 100 - 995 = 905
--
-- The "winning" opponent nets 905 on a 1000 stake - i.e. they LOSE 95
-- XAF even though their opponent is the one who quit. The exiting
-- player only pays a 0.5% penalty while the remaining player effectively
-- absorbs the platform's full commission out of their own principal.
-- That directly contradicts the feature's own stated goal in
-- 032_early_exit_match.sql: "The opponent isn't shorted anything they
-- would have gotten from a normal win."
--
-- Fix: the platform's cut on an early exit can only ever come out of
-- the money actually freed up by the exit - the forfeited penalty. It
-- must never dip into the remaining player's own principal. Concretely,
-- commission is capped at the penalty amount:
--
--   remaining        = stake_amount + penalty   (what's left after refund)
--   commission        = least(fee_percent% of remaining, penalty)
--   opponent_payout   = remaining - commission
--
-- Since commission can never exceed penalty, opponent_payout can never
-- fall below stake_amount - the opponent is always guaranteed their
-- own stake back, plus whatever slice of the penalty the platform
-- doesn't take as commission.
--
-- Same worked example under the fix:
--   remaining  = 1000 + 5 = 1005
--   commission = least(5% of 1005, 5) = least(50.25, 5) = 5
--   opponent_payout = 1005 - 5 = 1000  (stake fully returned)
--
-- Nothing else about the function changes.

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
  v_remaining numeric;
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

  -- What's actually left to distribute between the opponent and the
  -- platform once the exiting player has been refunded - their own
  -- stake plus the forfeited penalty. NOT the full 2x prize pool.
  v_remaining := v_match.stake_amount + v_penalty;

  -- Cap commission at the penalty itself, so it can never eat into
  -- the opponent's own principal.
  v_commission := least(round(v_remaining * v_fee_percent / 100, 2), v_penalty);
  v_opponent_payout := v_remaining - v_commission;

  if v_opponent_payout < v_match.stake_amount then
    -- Should be unreachable given the cap above, but guard explicitly
    -- rather than ever silently paying the opponent less than they
    -- staked.
    raise exception 'Early-exit settlement would short the opponent - contact support';
  end if;

  -- Lock both wallet rows up front (consistent ordering avoids
  -- deadlocks the same way settle_match already does).
  if auth.uid() < v_opponent_id then v_first_id := auth.uid(); v_second_id := v_opponent_id;
  else v_first_id := v_opponent_id; v_second_id := auth.uid(); end if;

  perform 1 from wallets where user_id = v_first_id for update;
  perform 1 from wallets where user_id = v_second_id for update;

  -- Release the exiting player's own locked stake and pay back 99.5%
  -- of it. Written directly rather than via apply_wallet_transaction's
  -- 'refund' type, since that type releases the exact amount credited
  -- from locked_balance - here we release 100% of the lock but only
  -- credit back 99.5% of it.
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

  -- Release the opponent's own stake lock, then pay their payout -
  -- their full stake back plus whatever's left of the forfeited
  -- penalty after commission, exactly like a normal winner's payout,
  -- just scaled to what's actually still in the pool.
  update wallets
  set locked_balance = locked_balance - v_match.stake_amount,
      updated_at = now()
  where user_id = v_opponent_id;

  perform public.apply_wallet_transaction(
    v_opponent_id, 'match_win', v_opponent_payout, p_match_id::text,
    'Won match (opponent withdrew early - stake ' || v_match.stake_amount ||
    ' returned, commission ' || v_commission || ', opponent refund ' || v_refund || ')'
  );

  update matches
  set status = 'completed', winner_id = v_opponent_id, commission_amount = v_commission
  where id = p_match_id
  returning * into v_match;

  perform public.notify_user(auth.uid(), 'Stake withdrawn',
    'You withdrew ' || v_refund || ' XAF from your locked stake (0.5% early-exit fee applied). The match has ended.');
  perform public.notify_user(v_opponent_id, 'Opponent withdrew - you win!',
    'Your opponent withdrew their stake early. You won ' || v_opponent_payout || ' XAF.');

  return v_match;
end;
$$;

grant execute on function public.early_exit_match(uuid) to authenticated;
