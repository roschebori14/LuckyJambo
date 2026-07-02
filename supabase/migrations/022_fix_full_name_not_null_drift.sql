-- Root cause found via Supabase Auth logs:
--   ERROR: null value in column "full_name" of relation "profiles"
--   violates not-null constraint (SQLSTATE 23502)
--
-- The live database has a NOT NULL constraint on profiles.full_name that
-- was never part of the tracked schema (001_initial_schema.sql declares it
-- nullable, and every type in /types treats it as `string | null`). It was
-- evidently added directly against the database outside of migrations.
-- Since the signup form never collects a full name, this was rejecting
-- every new signup, unrelated to the earlier username-collision fix.

alter table public.profiles
  alter column full_name drop not null;

-- Belt-and-braces: make handle_new_user() resilient to ANY failure writing
-- to profiles/wallets, not just unique_violation. A problem with an
-- auxiliary field (or any future schema drift like this one) should never
-- be able to block the underlying auth.users row from being created.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username text;
begin
  v_username := coalesce(
    new.raw_user_meta_data ->> 'username',
    split_part(new.email, '@', 1)
  );

  begin
    insert into public.profiles (id, email, username, full_name)
    values (
      new.id,
      new.email,
      v_username,
      new.raw_user_meta_data ->> 'full_name'
    )
    on conflict (id) do nothing;
  exception
    when unique_violation then
      -- username was taken; retry once with a short random suffix so
      -- signup still succeeds instead of aborting the whole trigger.
      begin
        insert into public.profiles (id, email, username, full_name)
        values (
          new.id,
          new.email,
          v_username || '_' || substr(new.id::text, 1, 6),
          new.raw_user_meta_data ->> 'full_name'
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
