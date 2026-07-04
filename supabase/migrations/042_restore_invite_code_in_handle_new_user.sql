-- Lucky Jambo - Restore invite_code generation in handle_new_user()
--
-- Root cause (confirmed via Postgres logs):
--   ERROR: null value in column "invite_code" of relation "profiles"
--   violates not-null constraint
--
-- Migration 019 added profiles.invite_code as NOT NULL and correctly
-- generated one in handle_new_user(). Migration 021 ("fix username
-- conflict") replaced handle_new_user() again, but was authored from a
-- copy of the function that predated 019 - its insert into profiles
-- omitted invite_code entirely. Migrations 022 and 033 each replaced
-- the function again to fix unrelated things, both building on 021's
-- already-broken version, so the missing invite_code insert has been
-- silently carried forward ever since.
--
-- Because 022 also made the profiles insert swallow all errors
-- ("exception when others -> raise warning"), every signup since 021
-- has been failing to create a profiles row (and, as a knock-on effect,
-- a wallets row, which has a FK to profiles) without ever surfacing an
-- error to the user or to signUp() - the account just silently ends up
-- broken until something else touches wallets/profiles for that user.

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
  v_username := regexp_replace(
    coalesce(
      new.raw_user_meta_data ->> 'username',
      split_part(new.email, '@', 1)
    ),
    '\s+', '', 'g'
  );

  v_invite_code := substr(replace(uuid_generate_v4()::text, '-', ''), 1, 8);

  begin
    insert into public.profiles (id, email, username, full_name, invite_code)
    values (
      new.id,
      new.email,
      v_username,
      new.raw_user_meta_data ->> 'full_name',
      v_invite_code
    )
    on conflict (id) do nothing;
  exception
    when unique_violation then
      -- Either the username or the invite_code collided. Retry once
      -- with a fresh suffix/code so signup still succeeds instead of
      -- aborting the whole trigger.
      begin
        insert into public.profiles (id, email, username, full_name, invite_code)
        values (
          new.id,
          new.email,
          v_username || '_' || substr(new.id::text, 1, 6),
          new.raw_user_meta_data ->> 'full_name',
          substr(replace(uuid_generate_v4()::text, '-', ''), 1, 8)
        )
        on conflict (id) do nothing;
      exception when others then
        raise warning 'handle_new_user: failed to insert profile (retry) for %: %', new.id, sqlerrm;
      end;
    when others then
      -- Never let a profile-row issue block account creation; log and move on.
      raise warning 'handle_new_user: failed to insert profile for %: %', new.id, sqlerrm;
  end;

  begin
    insert into public.wallets (user_id, available_balance, locked_balance)
    values (new.id, 0, 0)
    on conflict (user_id) do nothing;
  exception when others then
    raise warning 'handle_new_user: failed to insert wallet for %: %', new.id, sqlerrm;
  end;

  return new;
end;
$$;

-- =========================
-- BACKFILL: repair every account broken by this regression
-- =========================
-- Any auth.users row created between migration 021 landing and this
-- fix may be missing its profiles and/or wallets row. Repair all of
-- them in one pass rather than one at a time as users hit the crash.

insert into public.profiles (id, email, username, full_name, invite_code)
select
  u.id,
  u.email,
  regexp_replace(
    coalesce(u.raw_user_meta_data ->> 'username', split_part(u.email, '@', 1)),
    '\s+', '', 'g'
  ) || '_' || substr(u.id::text, 1, 6),
  u.raw_user_meta_data ->> 'full_name',
  substr(replace(uuid_generate_v4()::text, '-', ''), 1, 8)
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
on conflict (id) do nothing;

insert into public.wallets (user_id, available_balance, locked_balance)
select u.id, 0, 0
from auth.users u
left join public.wallets w on w.user_id = u.id
where w.user_id is null
on conflict (user_id) do nothing;
