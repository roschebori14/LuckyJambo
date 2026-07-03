-- Lucky Jambo - Make deposit completion atomic
--
-- PaymentProcessor.completeDeposit() previously called
-- apply_wallet_transaction() to credit the wallet, and then, as a
-- separate follow-up statement from application code, updated
-- deposits.status to 'completed'. Those are two independent round
-- trips: if the process crashes, the request times out, or the second
-- call otherwise fails after the first one succeeds, the wallet has
-- already been credited but the deposit row is left at 'pending'
-- forever. That's a permanent ledger/deposits inconsistency - the
-- money moved, but every read of the deposits table (admin dashboard,
-- user's deposit history, reconciliation jobs) says it never did, and
-- any retry logic keyed off deposits.status will keep trying to
-- "complete" a deposit that's already been paid out (only saved from
-- double-crediting today by the migration 023 unique ledger index).
--
-- This wraps the credit + status update in one plpgsql function so
-- they commit or roll back together, in a single DB transaction. If
-- the status update somehow fails, the wallet credit is rolled back
-- with it, instead of the two ever being able to disagree.

create or replace function public.complete_deposit(
  p_deposit_id uuid,
  p_user_id uuid,
  p_amount numeric,
  p_reference text,
  p_description text default null
)
returns wallet_ledger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ledger wallet_ledger%rowtype;
  v_updated_id uuid;
begin
  -- Same guard as PaymentProcessor.completeDeposit()'s pre-check, but
  -- re-done here inside the transaction so a race between two callers
  -- can't both pass the application-level check and then both credit.
  select id into v_updated_id
  from deposits
  where id = p_deposit_id
    and status not in ('completed', 'failed', 'cancelled')
  for update;

  if not found then
    raise exception 'Deposit % is not in a completable state', p_deposit_id;
  end if;

  v_ledger := public.apply_wallet_transaction(
    p_user_id, 'deposit', p_amount, p_reference, p_description
  );

  update deposits
  set status = 'completed'
  where id = p_deposit_id;

  return v_ledger;
end;
$$;

-- Same access shape as apply_wallet_transaction (migration 017): only
-- trusted server-side code using the service-role client calls this
-- (webhook handler, poll/verify routes, redirect callback), never the
-- end user's own session.
revoke execute on function public.complete_deposit(uuid, uuid, numeric, text, text) from public;
revoke execute on function public.complete_deposit(uuid, uuid, numeric, text, text) from authenticated;
revoke execute on function public.complete_deposit(uuid, uuid, numeric, text, text) from anon;
grant execute on function public.complete_deposit(uuid, uuid, numeric, text, text) to service_role;
