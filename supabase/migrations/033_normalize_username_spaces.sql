-- Lucky Jambo - Normalize usernames server-side (spaces)
--
-- Root cause confirmed: this was an input-level regex rejecting spaces
-- outright, in two places -
--   1. components/auth/register-form.tsx: `/^[a-zA-Z0-9_]+$/` test ran
--      against the raw typed username, so a stray leading/trailing
--      space (common from mobile keyboards/autocomplete) or an
--      intentional "first last" style name failed validation with a
--      generic "letters, numbers, underscores only" error - which is
--      what "many users fail to register because of a space" was.
--   2. lib/validations/profile.ts: the same regex on the profile-edit
--      form, so the identical failure could happen again later when
--      editing a username, not just at signup.
--
-- Both client-side spots now strip whitespace before validating/
-- saving (the <input> itself was never blocking spaces as typed -
-- only the regex at submit time was). This migration adds the same
-- normalization at the database level as a safety net, so a username
-- can never end up with whitespace in it regardless of which code
-- path writes it (direct signUp() calls, admin tooling, future forms
-- that forget to reuse the shared schema, etc).

create or replace function public.normalize_username()
returns trigger
language plpgsql
as $$
begin
  if new.username is not null then
    new.username := regexp_replace(new.username, '\s+', '', 'g');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_profiles_normalize_username on profiles;
create trigger trg_profiles_normalize_username
before insert or update of username on profiles
for each row
execute function public.normalize_username();

-- handle_new_user itself derives v_username from raw_user_meta_data
-- (or the email) before the insert - normalize it there too, so the
-- trigger above is a pure backstop rather than the only thing
-- standing between a stray space and a broken signup.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username text;
begin
  v_username := regexp_replace(
    coalesce(
      new.raw_user_meta_data ->> 'username',
      split_part(new.email, '@', 1)
    ),
    '\s+', '', 'g'
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
