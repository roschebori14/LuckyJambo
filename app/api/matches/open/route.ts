-- Lucky Jambo - CRITICAL BUG FIX: refund_draw fails on every draw
--
-- idx_wallet_ledger_unique_refund_reference (migration 024) enforces
-- uniqueness of `reference` across all wallet_ledger rows where
-- type = 'refund'. refund_draw (migration 017) calls
-- apply_wallet_transaction(..., 'refund', ..., p_match_id::text, ...)
-- ONCE PER PARTICIPANT, passing the exact same reference
-- (p_match_id::text) both times.
--
-- The first call succeeds and inserts a refund row with that
-- reference. The second call - refunding the other participant of
-- the very same draw - tries to insert a second row with the SAME
-- reference and the SAME type, and the unique index rejects it:
--
--   duplicate key value violates unique constraint
--   "idx_wallet_ledger_unique_refund_reference"
--
-- Postgres then rolls back the entire refund_draw transaction,
-- including the first (otherwise-successful) refund and the
-- `update matches set status = 'cancelled'`. So on every single draw,
-- in every game (tic-tac-toe, chess, draughts, snakes & ladders,
-- battleship), neither player gets refunded, the match is left stuck
-- on status = 'active' forever, and the client never receives a draw
-- state to render - which is why there was no draw UI at all, not
-- just a missing message.
--
-- Fix: make the reference unique per (match, participant) instead of
-- per match alone, while keeping it traceable back to the match.
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
    v_participants[1], 'refund', v_match.stake_amount,
    p_match_id::text || ':' || v_participants[1]::text,
    'Draw - stake refunded'
  );
  perform public.apply_wallet_transaction(
    v_participants[2], 'refund', v_match.stake_amount,
    p_match_id::text || ':' || v_participants[2]::text,
    'Draw - stake refunded'
  );

  update matches set status = 'cancelled' where id = p_match_id;

  perform public.notify_user(v_participants[1], 'Match drawn', 'Your stake was refunded.');
  perform public.notify_user(v_participants[2], 'Match drawn', 'Your stake was refunded.');
end;
$$;