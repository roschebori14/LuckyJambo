-- Lucky Jambo - Friends: invite links + missing RLS policies
--
-- Two real bugs this fixes:
-- 1. friend_requests had no UPDATE policy and friends had no INSERT
--    policy, so accepting/rejecting a request silently did nothing
--    (RLS just filtered the write down to zero rows - no error).
--    The application code now performs the accept/insert via the
--    service-role admin client after an explicit authorization check
--    (same pattern as withdrawals), so these policies exist mainly as
--    defense-in-depth for any direct/user-scoped access.
-- 2. Nothing stopped duplicate friend rows or duplicate pending
--    requests between the same two users.

-- =========================
-- INVITE CODES
-- =========================

alter table profiles
add column if not exists invite_code text unique;

-- Short, URL-safe code for existing users who signed up before this
-- column existed.
update profiles
set invite_code = substr(replace(uuid_generate_v4()::text, '-', ''), 1, 8)
where invite_code is null;

alter table profiles
alter column invite_code set not null;

create index if not exists idx_profiles_invite_code
on profiles(invite_code);

-- Generate an invite code for every new signup too.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username text;
  v_invite_code text;
begin
  v_username := coalesce(
    new.raw_user_meta_data ->> 'username',
    split_part(new.email, '@', 1)
  );

  v_invite_code := substr(replace(uuid_generate_v4()::text, '-', ''), 1, 8);

  insert into public.profiles (id, email, username, invite_code)
  values (new.id, new.email, v_username, v_invite_code)
  on conflict (id) do nothing;

  insert into public.wallets (user_id, available_balance, locked_balance)
  values (new.id, 0, 0)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

-- =========================
-- DUPLICATE PREVENTION
-- =========================

-- One friendship row per direction, no duplicates.
alter table friends
add constraint friends_user_friend_unique unique (user_id, friend_id);

-- Only one pending request between any two users at a time, regardless
-- of who sent it. (least/greatest works on uuid since it has a total
-- ordering.)
create unique index if not exists idx_friend_requests_pending_pair
on friend_requests (least(sender_id, receiver_id), greatest(sender_id, receiver_id))
where status = 'pending';

-- =========================
-- RLS: FRIEND_REQUESTS
-- =========================

create policy "receiver can update own incoming requests"
on friend_requests
for update
using (auth.uid() = receiver_id)
with check (auth.uid() = receiver_id);

create policy "sender can cancel own pending request"
on friend_requests
for delete
using (auth.uid() = sender_id and status = 'pending');

-- =========================
-- RLS: FRIENDS
-- =========================

create policy "insert own friend row"
on friends
for insert
with check (auth.uid() = user_id);
