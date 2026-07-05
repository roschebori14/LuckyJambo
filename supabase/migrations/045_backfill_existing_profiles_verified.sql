-- Lucky Jambo - Mark all existing accounts as verified too
--
-- Migration 044 set is_verified default to true for new signups.
-- This backfills every existing profile that is currently false,
-- so all accounts (old and new) show as verified consistently.

update public.profiles
set is_verified = true
where is_verified = false;
