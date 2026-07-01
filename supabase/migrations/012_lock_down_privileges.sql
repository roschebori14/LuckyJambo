-- Lucky Jambo - Lock down function privileges + public profile visibility
--
-- 1. CRITICAL: apply_wallet_transaction(p_user_id, ...) takes the target
--    user id as a plain argument instead of deriving it from auth.uid().
--    Postgres grants EXECUTE on new functions to PUBLIC by default, and
--    nothing in the earlier migrations revoked that. Since it's exposed
--    over PostgREST as an RPC, ANY logged-in user (or, if PUBLIC really
--    is wide open, even anon) could currently call it directly from the
--    browser with an arbitrary p_user_id and p_type='deposit' to credit
--    themselves (or anyone) unlimited funds, completely bypassing Fapshi.
--    This locks it down to service_role only - callers must go through
--    server-side code that uses the service-role client after doing its
--    own authorization check (webhook handlers, admin routes, the
--    post-payout wallet update in withdrawals/create).
--
-- 2. create_match / join_match / cancel_match / request_withdrawal all
--    derive identity from auth.uid() internally, so they can't be used
--    to act as someone else - but there's still no reason for anon
--    (logged-out) callers to be able to invoke them. Restrict to
--    authenticated.
--
-- 3. Matchmaking and "challenge a friend" need to show who a match
--    belongs to / who a friend is by username. profiles currently only
--    allows a user to select their own row, so any query joining a
--    match or friendship to profiles.username silently returns nothing
--    for other users. Add a policy that lets any authenticated user
--    read profile rows - callers must still only select non-sensitive
--    columns (username, avatar_url, is_verified) in shared contexts;
--    this policy controls row visibility, not column visibility.

revoke execute on function public.apply_wallet_transaction(uuid, text, numeric, text, text) from public;
revoke execute on function public.apply_wallet_transaction(uuid, text, numeric, text, text) from anon;
revoke execute on function public.apply_wallet_transaction(uuid, text, numeric, text, text) from authenticated;
grant execute on function public.apply_wallet_transaction(uuid, text, numeric, text, text) to service_role;

revoke execute on function public.create_match(text, numeric) from public;
revoke execute on function public.create_match(text, numeric) from anon;
grant execute on function public.create_match(text, numeric) to authenticated;

revoke execute on function public.join_match(uuid) from public;
revoke execute on function public.join_match(uuid) from anon;
grant execute on function public.join_match(uuid) to authenticated;

revoke execute on function public.cancel_match(uuid) from public;
revoke execute on function public.cancel_match(uuid) from anon;
grant execute on function public.cancel_match(uuid) to authenticated;

revoke execute on function public.request_withdrawal(numeric, text, text) from public;
revoke execute on function public.request_withdrawal(numeric, text, text) from anon;
grant execute on function public.request_withdrawal(numeric, text, text) to authenticated;

revoke execute on function public.settle_match(uuid, uuid) from public;
revoke execute on function public.settle_match(uuid, uuid) from anon;
grant execute on function public.settle_match(uuid, uuid) to authenticated;

revoke execute on function public.submit_instant_move(uuid, text) from public;
revoke execute on function public.submit_instant_move(uuid, text) from anon;
grant execute on function public.submit_instant_move(uuid, text) to authenticated;

create policy "authenticated can view public profiles"
on profiles
for select
to authenticated
using (true);
