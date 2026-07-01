-- Lucky Jambo - Fix deposits table constraints and add missing columns
--
-- deposit-service.ts inserts a `payment_reference` column and sets
-- `payment_url` (added in 003_payment_provider_fields.sql) but the
-- original schema had `transaction_reference` for this purpose.
-- Add payment_reference alias + allow expired status + add payment_url
-- if somehow not already present.

alter table deposits
add column if not exists payment_reference text unique,
add column if not exists payment_url text;

-- Widen the status check constraint to include 'expired' (Fapshi
-- can expire a payment link if the user doesn't pay in time).
alter table deposits drop constraint if exists deposits_status_check;
alter table deposits
add constraint deposits_status_check
check (status in ('pending', 'completed', 'failed', 'expired'));
