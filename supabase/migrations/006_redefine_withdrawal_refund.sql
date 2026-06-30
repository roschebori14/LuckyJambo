-- Lucky Jambo - Redefine withdrawal/refund semantics
--
-- Previously 'withdrawal' debited available_balance straight away and
-- 'refund' credited available_balance straight away. Two problems:
--
-- 1. A withdrawal sits as 'pending' until an admin approves it
--    (Phase 8, not built yet). If we don't reserve the funds at
--    request time, a user could request several withdrawals, or
--    stake the same money on a match, that together exceed their
--    balance, while all of them show as "pending" with nothing
--    actually held back yet.
-- 2. 'refund' as a plain credit doesn't reverse a lock - so undoing a
--    match_stake or withdrawal lock left the money double-counted
--    (still sitting in locked_balance AND added back to available).
--
-- New semantics: 'withdrawal' now locks (mirrors match_stake).
-- 'refund' now releases a lock back to available (used for cancelled
-- matches and, later, rejected withdrawals).

create or replace function public.apply_wallet_transaction(
  p_user_id uuid,
  p_type text,
  p_amount numeric,
  p_reference text default null,
  p_description text default null
)
returns wallet_ledger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wallet wallets%rowtype;
  v_balance_before numeric;
  v_balance_after numeric;
  v_ledger wallet_ledger%rowtype;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be positive';
  end if;

  select * into v_wallet
  from wallets
  where user_id = p_user_id
  for update;

  if not found then
    raise exception 'Wallet not found for user %', p_user_id;
  end if;

  v_balance_before := v_wallet.available_balance;

  if p_type in ('deposit', 'match_win', 'bonus', 'admin_adjustment') then
    v_balance_after := v_wallet.available_balance + p_amount;

    update wallets
    set available_balance = v_balance_after,
        updated_at = now()
    where user_id = p_user_id;

  elsif p_type in ('withdrawal', 'match_stake') then
    if v_wallet.available_balance < p_amount then
      raise exception 'Insufficient balance';
    end if;

    v_balance_after := v_wallet.available_balance - p_amount;

    update wallets
    set available_balance = v_balance_after,
        locked_balance = locked_balance + p_amount,
        updated_at = now()
    where user_id = p_user_id;

  elsif p_type = 'refund' then
    if v_wallet.locked_balance < p_amount then
      raise exception 'Cannot release more than is locked';
    end if;

    v_balance_after := v_wallet.available_balance + p_amount;

    update wallets
    set available_balance = v_balance_after,
        locked_balance = locked_balance - p_amount,
        updated_at = now()
    where user_id = p_user_id;

  elsif p_type = 'match_loss' then
    v_balance_after := v_wallet.available_balance;

    update wallets
    set locked_balance = locked_balance - p_amount,
        updated_at = now()
    where user_id = p_user_id;

  else
    raise exception 'Unsupported ledger type %', p_type;
  end if;

  insert into wallet_ledger (
    wallet_id, user_id, type, amount,
    balance_before, balance_after, reference, description
  )
  values (
    v_wallet.id, p_user_id, p_type, p_amount,
    v_balance_before, v_balance_after, p_reference, p_description
  )
  returning * into v_ledger;

  return v_ledger;
end;
$$;
