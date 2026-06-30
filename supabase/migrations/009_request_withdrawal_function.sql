-- Lucky Jambo - Withdrawal request function
--
-- Fixes the three critical bugs in app/api/withdrawals/create/route.ts
-- and lib/withdrawals/withdrawal-service.ts:
--
-- 1. The route hardcoded "temporary-user-id" instead of the real
--    authenticated user - any logged-in user could trigger a
--    withdrawal under that fake id. Deriving identity from auth.uid()
--    inside a security definer function means the caller can't
--    impersonate anyone else regardless of what they put in the body.
--
-- 2. WithdrawalService.createWithdrawal inserted columns
--    'phone_number' and 'reference' which don't exist on the
--    withdrawals table (actual columns are 'account_number' and
--    'transaction_reference'). This would crash immediately.
--
-- 3. No balance check happened before creating the withdrawal row.
--    apply_wallet_transaction with type='withdrawal' now handles this:
--    it locks the funds (available->locked) atomically, and raises an
--    exception if the user doesn't have enough - that exception aborts
--    the whole transaction so the withdrawal row is never created.

create or replace function public.request_withdrawal(
  p_amount numeric,
  p_account_number text,
  p_provider text
)
returns withdrawals
language plpgsql
security definer
set search_path = public
as $$
declare
  v_min numeric;
  v_max numeric;
  v_reference text;
  v_row withdrawals%rowtype;
begin
  select coalesce(value::numeric, 500) into v_min
  from settings where key = 'minimum_withdrawal';

  select coalesce(value::numeric, 100000) into v_max
  from settings where key = 'maximum_withdrawal';

  if p_amount < v_min then
    raise exception 'Minimum withdrawal is % XAF', v_min;
  end if;

  if p_amount > v_max then
    raise exception 'Maximum withdrawal is % XAF', v_max;
  end if;

  if p_provider not in ('mtn', 'orange') then
    raise exception 'Provider must be mtn or orange';
  end if;

  -- Locking funds here (available -> locked) prevents the user from
  -- spending the same money on a match while this withdrawal is
  -- pending admin approval. If they don't have enough this raises and
  -- the whole transaction aborts - no row is written.
  v_reference := 'WD-' || to_char(now(), 'YYYYMMDD') || '-' ||
                 upper(substr(auth.uid()::text, 1, 8));

  perform public.apply_wallet_transaction(
    auth.uid(), 'withdrawal', p_amount, v_reference,
    'Withdrawal requested to ' || upper(p_provider) || ' ' || p_account_number
  );

  insert into withdrawals (
    user_id, amount, account_number, provider,
    transaction_reference, status
  )
  values (
    auth.uid(), p_amount, p_account_number, p_provider,
    v_reference, 'pending'
  )
  returning * into v_row;

  return v_row;
end;
$$;
