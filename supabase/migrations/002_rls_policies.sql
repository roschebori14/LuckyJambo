-- ==========================================
-- LUCKY JAMBO RLS POLICIES
-- ==========================================

-- Enable RLS
alter table profiles enable row level security;
alter table wallets enable row level security;
alter table wallet_ledger enable row level security;
alter table deposits enable row level security;
alter table withdrawals enable row level security;
alter table transactions enable row level security;
alter table friend_requests enable row level security;
alter table friends enable row level security;
alter table matches enable row level security;
alter table match_participants enable row level security;
alter table notifications enable row level security;
alter table reports enable row level security;

-- ==========================================
-- PROFILES
-- ==========================================

create policy "users can view own profile"
on profiles
for select
using (
  auth.uid() = id
);

create policy "users can update own profile"
on profiles
for update
using (
  auth.uid() = id
);

-- ==========================================
-- WALLETS
-- ==========================================

create policy "users can view own wallet"
on wallets
for select
using (
  auth.uid() = user_id
);

-- ==========================================
-- WALLET LEDGER
-- ==========================================

create policy "users can view own ledger"
on wallet_ledger
for select
using (
  auth.uid() = user_id
);

-- ==========================================
-- DEPOSITS
-- ==========================================

create policy "users can view own deposits"
on deposits
for select
using (
  auth.uid() = user_id
);

create policy "users can create deposits"
on deposits
for insert
with check (
  auth.uid() = user_id
);

-- ==========================================
-- WITHDRAWALS
-- ==========================================

create policy "users can view own withdrawals"
on withdrawals
for select
using (
  auth.uid() = user_id
);

create policy "users can create withdrawals"
on withdrawals
for insert
with check (
  auth.uid() = user_id
);

-- ==========================================
-- TRANSACTIONS
-- ==========================================

create policy "users can view own transactions"
on transactions
for select
using (
  auth.uid() = user_id
);

-- ==========================================
-- FRIEND REQUESTS
-- ==========================================

create policy "view own friend requests"
on friend_requests
for select
using (
  auth.uid() = sender_id
  or
  auth.uid() = receiver_id
);

create policy "create friend request"
on friend_requests
for insert
with check (
  auth.uid() = sender_id
);

-- ==========================================
-- FRIENDS
-- ==========================================

create policy "view own friends"
on friends
for select
using (
  auth.uid() = user_id
  or
  auth.uid() = friend_id
);

-- ==========================================
-- MATCHES
-- ==========================================

create policy "view matches"
on matches
for select
using (true);

-- ==========================================
-- MATCH PARTICIPANTS
-- ==========================================

create policy "view own match participation"
on match_participants
for select
using (
  auth.uid() = user_id
);

-- ==========================================
-- NOTIFICATIONS
-- ==========================================

create policy "view own notifications"
on notifications
for select
using (
  auth.uid() = user_id
);

create policy "update own notifications"
on notifications
for update
using (
  auth.uid() = user_id
);

-- ==========================================
-- REPORTS
-- ==========================================

create policy "create reports"
on reports
for insert
with check (
  auth.uid() = reporter_id
);

create policy "view own reports"
on reports
for select
using (
  auth.uid() = reporter_id
);

-- ==========================================
-- ADMIN ACCESS
-- ==========================================

create or replace function is_admin()
returns boolean
language sql
security definer
as $$
  select exists (
    select 1
    from profiles
    where profiles.id = auth.uid()
    and profiles.role = 'admin'
  );
$$;

create policy "admin full profiles"
on profiles
for all
using (is_admin());

create policy "admin full wallets"
on wallets
for all
using (is_admin());

create policy "admin full ledger"
on wallet_ledger
for all
using (is_admin());

create policy "admin full deposits"
on deposits
for all
using (is_admin());

create policy "admin full withdrawals"
on withdrawals
for all
using (is_admin());

create policy "admin full transactions"
on transactions
for all
using (is_admin());

create policy "admin full matches"
on matches
for all
using (is_admin());

create policy "admin full reports"
on reports
for all
using (is_admin());

create policy "admin full notifications"
on notifications
for all
using (is_admin());