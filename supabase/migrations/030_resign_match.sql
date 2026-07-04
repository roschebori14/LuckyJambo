-- Lucky Jambo - Voluntary resign
--
-- claim_forfeit_win (013) already covers "opponent went quiet, give me
-- the win after a timeout" - but there was no way for a player to
-- voluntarily give up an active match right now (forfeiting their own
-- stake) except the chess-only /api/chess/resign route, which reads
-- white_player_id/black_player_id out of that game's own game_state
-- shape and therefore only works for chess.
--
-- resign_match is the game-agnostic version: it looks the other
-- participant up from match_participants (works for chess, draughts,
-- tic-tac-toe, and the instant games alike), confirms the caller is
-- actually in the match, and then reuses settle_match so the payout,
-- commission, wallet updates, and notifications all happen exactly the
-- same way a normal win/loss does.
create or replace function public.resign_match(
  p_match_id uuid
)
returns matches
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match matches%rowtype;
  v_participants uuid[];
  v_winner_id uuid;
begin
  select * into v_match from matches where id = p_match_id for update;

  if not found then
    raise exception 'Match not found';
  end if;

  if v_match.status != 'active' then
    raise exception 'Match is not active';
  end if;

  select array_agg(user_id) into v_participants
  from match_participants where match_id = p_match_id;

  if not (auth.uid() = any(v_participants)) then
    raise exception 'Only a match participant can resign';
  end if;

  v_winner_id := (
    select user_id from unnest(v_participants) as user_id
    where user_id != auth.uid()
  );

  if v_winner_id is null then
    raise exception 'Cannot resign a match with no opponent';
  end if;

  -- The resigning player forfeits, so the other participant is the winner.
  return public.settle_match(p_match_id, v_winner_id);
end;
$$;

grant execute on function public.resign_match(uuid) to authenticated;
