-- Fix: handle_new_user() previously threw a raw unique_violation when the
-- chosen/derived username collided with an existing one, which aborted the
-- whole auth.users insert and surfaced to the client as the generic
-- "Database error saving new user" (unexpected_failure) error.
--
-- This migration:
--   1. Makes handle_new_user() catch that collision and retry once with a
--      short random suffix instead of failing signup outright.
--   2. Adds an is_username_available() RPC so the signup form can check
--      availability up front (from an anonymous client) and show a clear
--      "username taken" message before ever calling auth.signUp().

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
    insert into public.profiles (id, email, username)
    values (new.id, new.email, v_username)
    on conflict (id) do nothing;
  exception when unique_violation then
    -- username was taken; retry once with a short random suffix so
    -- signup still succeeds instead of aborting the whole trigger.
    insert into public.profiles (id, email, username)
    values (new.id, new.email, v_username || '_' || substr(new.id::text, 1, 6))
    on conflict (id) do nothing;
  end;

  insert into public.wallets (user_id, available_balance, locked_balance)
  values (new.id, 0, 0)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

-- ==========================================
-- USERNAME AVAILABILITY CHECK
-- ==========================================
-- Only ever returns true/false, so it's safe to expose to anon/authenticated
-- callers (i.e. before an account exists, on the signup form itself).

create or replace function public.is_username_available(p_username text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select not exists (
    select 1 from public.profiles where username = p_username
  );
$$;

grant execute on function public.is_username_available(text) to anon, authenticated;
