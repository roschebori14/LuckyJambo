-- Lucky Jambo Payment Provider Fields
-- Adds Fapshi reconciliation fields for projects that already ran 001.

alter table deposits
add column if not exists provider_transaction_id text unique,
add column if not exists payment_url text;

create index if not exists idx_deposits_user
on deposits(user_id);

create index if not exists idx_deposits_provider_transaction
on deposits(provider_transaction_id);

alter table withdrawals
add column if not exists provider_transaction_id text;
