-- Lucky Jambo - SECURITY FIX: lock down apply_wallet_transaction
--
-- apply_wallet_transaction takes p_user_id as a plain parameter and
-- never checks it against auth.uid(). That's intentional for the
-- internal RPCs (create_match, settle_match, etc.) which look up the
-- real participants themselves and call it via `perform` - safe,
-- because they validate who should be paid before calling it.
--
-- But the function was also reachable directly over PostgREST by any
-- authenticated user (supabase.rpc('apply_wallet_transaction', ...)
-- from a logged-in session), because Postgres grants EXECUTE on new
-- functions to PUBLIC by default. That meant any logged-in player
-- could open browser dev tools and call:
--   supabase.rpc('apply_wallet_transaction', {
--     p_user_id: 'someone-elses-uuid', p_type: 'admin_adjustment',
--     p_amount: 999999, ...
--   })
-- and credit themselves or debit another player directly, bypassing
-- every match/withdrawal RPC entirely. This revokes that direct path
-- while keeping it fully usable by the other SECURITY DEFINER
-- functions that call it internally (their internal calls execute as
-- the function owner, not as the originating PostgREST role, so the
-- revoke below does not affect them).

revoke execute on function public.apply_wallet_transaction(uuid, text, numeric, text, text) from public;
revoke execute on function public.apply_wallet_transaction(uuid, text, numeric, text, text) from authenticated;
revoke execute on function public.apply_wallet_transaction(uuid, text, numeric, text, text) from anon;

-- service_role (used by the webhook handler and admin API routes via
-- the service-role client) still needs to call it directly for
-- deposit crediting and admin withdrawal payouts.
grant execute on function public.apply_wallet_transaction(uuid, text, numeric, text, text) to service_role;

-- The chess and tic-tac-toe move routes previously called
-- apply_wallet_transaction directly (twice, once per player) from the
-- authenticated user's own session to refund a draw. That's exactly
-- the kind of direct call the revoke above now blocks (correctly -
-- the route was trusting state.white_player_id / state.black_player_id
-- read out of game_state, which a user could tamper with client-side
-- before it ever reaches the server, though the server does re-fetch
-- from the DB so this particular path was lower-risk - still, direct
-- access to the raw wallet RPC is the wrong shape regardless).
--
-- This RPC replaces those direct calls: it looks up the real match
-- participants itself, confirms the match is active, and refunds both
-- sides atomically. Only a participant of the match may call it.
create or replace function public.refund_draw(
  p_match_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match matches%rowtype;
  v_participants uuid[];
begin
  select * into v_match from matches where id = p_match_id for update;
  if not found then raise exception 'Match not found'; end if;
  if v_match.status != 'active' then raise exception 'Match is not active'; end if;

  select array_agg(user_id) into v_participants
  from match_participants where match_id = p_match_id;

  if not (auth.uid() = any(v_participants)) then
    raise exception 'Only a match participant can refund this match';
  end if;
  if array_length(v_participants, 1) != 2 then
    raise exception 'Match does not have exactly two participants';
  end if;

  perform public.apply_wallet_transaction(
    v_participants[1], 'refund', v_match.stake_amount, p_match_id::text, 'Draw - stake refunded'
  );
  perform public.apply_wallet_transaction(
    v_participants[2], 'refund', v_match.stake_amount, p_match_id::text, 'Draw - stake refunded'
  );

  update matches set status = 'cancelled' where id = p_match_id;

  perform public.notify_user(v_participants[1], 'Match drawn', 'Your stake was refunded.');
  perform public.notify_user(v_participants[2], 'Match drawn', 'Your stake was refunded.');
end;
$$;
