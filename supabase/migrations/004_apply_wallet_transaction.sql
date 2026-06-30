-- Lucky Jambo - Atomic wallet transaction function
-- Phase 3A fix
--
-- BalanceEngine (lib/wallet/balance-engine.ts) only computes new balances
-- in memory; nothing previously persisted those changes safely. Doing a
-- "read balance -> compute -> write balance" from application code is
-- unsafe for money: two concurrent requests can race and corrupt the
-- balance. This function does the read, check, update, and ledger insert
-- inside one locked transaction, which is the standard fix.
--
-- Not called by any route yet. Phase 3E (Ledger Engine) and Phase 4
-- (Fapshi Integration) will call it via WalletService.applyTransaction()
-- to actually credit/debit balances. Deposits stay 'pending' until then.

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

  -- Lock the wallet row so concurrent transactions can't race each other
  select * into v_wallet
  from wallets
  where user_id = p_user_id
  for update;

  if not found then
    raise exception 'Wallet not found for user %', p_user_id;
  end if;

  v_balance_before := v_wallet.available_balance;

  if p_type in ('deposit', 'match_win', 'refund', 'bonus', 'admin_adjustment') then
    v_balance_after := v_wallet.available_balance + p_amount;

    update wallets
    set available_balance = v_balance_after,
        updated_at = now()
    where user_id = p_user_id;

  elsif p_type = 'withdrawal' then
    if v_wallet.available_balance < p_amount then
      raise exception 'Insufficient balance';
    end if;

    v_balance_after := v_wallet.available_balance - p_amount;

    update wallets
    set available_balance = v_balance_after,
        updated_at = now()
    where user_id = p_user_id;

  elsif p_type = 'match_stake' then
    if v_wallet.available_balance < p_amount then
      raise exception 'Insufficient balance';
    end if;

    v_balance_after := v_wallet.available_balance - p_amount;

    update wallets
    set available_balance = v_balance_after,
        locked_balance = locked_balance + p_amount,
        updated_at = now()
    where user_id = p_user_id;

  elsif p_type = 'match_loss' then
    -- Stake already moved out of available_balance when the match was
    -- entered; a loss just releases it from locked_balance.
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
