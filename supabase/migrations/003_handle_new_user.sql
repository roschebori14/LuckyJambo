-- Lucky Jambo - Auto-provision profile + wallet on signup
-- Phase 3A fix

-- Without this, a new auth.users row was never followed by a profiles
-- or wallets row, so WalletService.getWallet() threw for every new user.

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

  insert into public.profiles (id, email, username)
  values (new.id, new.email, v_username)
  on conflict (id) do nothing;

  insert into public.wallets (user_id, available_balance, locked_balance)
  values (new.id, 0, 0)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();
