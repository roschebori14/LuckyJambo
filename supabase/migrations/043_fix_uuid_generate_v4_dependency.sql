-- Lucky Jambo - Fix uuid_generate_v4() dependency introduced in migration 042
--
-- Root cause (confirmed via Postgres logs):
--   error 42883: function uuid_generate_v4() does not exist
--   error 25P02: current transaction is aborted, commands ignored until
--   end of transaction block (cascading failure from the above)
--
-- uuid_generate_v4() comes from the uuid-ossp extension, which Supabase
-- installs into the `extensions` schema, not `public`. Migration 042
-- (and originally 019, before 021 accidentally dropped the call) set
-- `search_path = public` on handle_new_user(), so the unqualified call
-- to uuid_generate_v4() cannot be resolved and every signup was failing
-- with a 500 on /auth/v1/signup.
--
-- Fix: use gen_random_uuid(), which has been built into Postgres core
-- since v13 (Supabase runs 15+) and needs no extension or schema
-- qualification, so it works regardless of search_path.

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

  v_invite_code := substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);

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
      begin
        insert into public.profiles (id, email, username, full_name, invite_code)
        values (
          new.id,
          new.email,
          v_username || '_' || substr(new.id::text, 1, 6),
          new.raw_user_meta_data ->> 'full_name',
          substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)
        )
        on conflict (id) do nothing;
      exception when others then
        raise warning 'handle_new_user: failed to insert profile (retry) for %: %', new.id, sqlerrm;
      end;
    when others then
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

-- Backfill again, in case any signups were attempted (and failed
-- outright with a 500) between migration 042 and this fix and left
-- behind an auth.users row with no matching profile/wallet.
insert into public.profiles (id, email, username, full_name, invite_code)
select
  u.id,
  u.email,
  regexp_replace(
    coalesce(u.raw_user_meta_data ->> 'username', split_part(u.email, '@', 1)),
    '\s+', '', 'g'
  ) || '_' || substr(u.id::text, 1, 6),
  u.raw_user_meta_data ->> 'full_name',
  substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)
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
