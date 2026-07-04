-- Lucky Jambo - Withdraw locked funds early (0.5% penalty)
--
-- Confirmed behaviour with the user before building this (it changes
-- match economics, see the batch-2 continuation brief, item 4):
--
--   - A player in an ACTIVE match can pull their own locked stake back
--     out early, instead of leaving it locked until the match
--     naturally ends. They get 99.5% of their stake back immediately
--     (0.5% early-exit penalty), and the match ends right away.
--   - Their opponent is auto-declared the winner and still gets a
--     "normal" win payout - but that payout is computed on what's
--     actually left in the pool after the exiting player's refund, so
--     the numbers stay balanced: prize_pool (stake*2) is always fully
--     accounted for across [exiting player's refund] + [opponent's
--     payout] + [platform commission]. The opponent isn't shorted
--     anything they would have gotten from a normal win *of the
--     remaining pool* - they just don't get a cut of the stake their
--     opponent pulled back out early.
--
-- This is deliberately a different code path from resign_match (030):
-- resigning forfeits your entire stake to your opponent (same as any
-- normal loss). This lets you keep almost all of it instead, at the
-- cost of the match ending immediately in your opponent's favor.

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

  -- Release the opponent's own stake lock, then pay their adjusted
  -- win payout (pool minus commission minus the exiting player's
  -- refund) the same way settle_match pays a normal winner.
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
