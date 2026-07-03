-- Lucky Jambo - Fix "Match creation failed" on every match/challenge
--
-- 007_match_lifecycle_functions.sql created:
--     create_match(p_game_slug text, p_stake_amount numeric)
-- and granted EXECUTE on that exact signature to authenticated
-- (012_lock_down_privileges.sql).
--
-- 013_match_lifecycle_extras.sql later added a third, defaulted
-- parameter to support friend challenges:
--     create_match(p_game_slug text, p_stake_amount numeric,
--                  p_invited_user_id uuid default null)
--
-- `create or replace function` only replaces a function with the same
-- name AND the same argument types. Adding a parameter changes the
-- signature, so this did not replace the original two-argument
-- function - it created a second, overloaded one alongside it. From
-- then on the database has had two functions named create_match.
--
-- The app only ever calls supabase.rpc("create_match", { p_game_slug,
-- p_stake_amount }) - both CreateMatchForm and ChallengeFriendForm
-- omit p_invited_user_id. That call matches the two-arg function
-- exactly, but it *also* matches the three-arg function (whose third
-- parameter has a default and can be omitted). PostgREST cannot tell
-- which one the caller wants and rejects the call outright with a
-- "Could not choose the best candidate function" error - which
-- lib/matchmaking's caller (app/api/matches/create/route.ts) reports
-- to the client as the generic "Match creation failed". This fires on
-- every single match creation and friend challenge, regardless of
-- input, which matches the reported symptom.
--
-- Fix: drop the superseded two-argument overload so create_match has
-- exactly one signature again, and make sure that signature has the
-- grants 012 intended (authenticated only, not anon/public - the
-- three-arg version never had its own explicit grants, so it was
-- relying on Postgres's "grant to PUBLIC on creation" default, which
-- is wider than intended for a function that moves money).

drop function if exists public.create_match(text, numeric);

revoke execute on function public.create_match(text, numeric, uuid) from public;
revoke execute on function public.create_match(text, numeric, uuid) from anon;
grant execute on function public.create_match(text, numeric, uuid) to authenticated;
