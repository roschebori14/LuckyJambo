-- Lucky Jambo - Default new accounts to is_verified = true
--
-- is_verified is purely cosmetic today (only used to show a shield-check
-- badge on the profile page - it does not gate deposits, withdrawals,
-- or any KYC/AML flow). Per request, every new signup should show as
-- verified by default. Existing accounts are left untouched.

alter table public.profiles
  alter column is_verified set default true;
