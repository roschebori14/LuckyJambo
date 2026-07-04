-- Lucky Jambo - Notify invited player on direct challenge
--
-- create_match has supported p_invited_user_id (a direct challenge to
-- a specific friend, as opposed to an open match anyone can join)
-- since early on, but it never actually told that person about it -
-- they'd only find out if the challenger separately sent them the
-- match link some other way. This went unnoticed because the open-
-- match path (the lobby list) doesn't need a notification, and direct
-- challenges are a smaller, newer path.
--
-- This matters more now that there's a "Rematch" action (challenges
-- the same opponent again via create_match with invited_user_id set) -
-- without a notification, the other player has no way to discover the
-- rematch invite exists unless the winner manually shares the link
-- again.
--
-- Note: migration numbering has a gap (037 is missing from what was
-- supplied) - this is intentionally numbered 039 to continue after the
-- highest existing migration (038) rather than reuse 037, since a gap
-- in an already-applied history is harmless but reusing a number is
-- not.

create or replace function public.create_match(
  p_game_slug text,
  p_stake_amount numeric,
  p_invited_user_id uuid default null
)
returns matches
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game games%rowtype;
  v_match matches%rowtype;
  v_game_state jsonb;
  v_draughts_board jsonb;
  v_challenger_username text;
begin
  select * into v_game from games where slug = p_game_slug and is_active = true;

  if not found then
    raise exception 'Unknown or inactive game %', p_game_slug;
  end if;

  if p_stake_amount < v_game.min_stake or p_stake_amount > v_game.max_stake then
    raise exception 'Stake must be between % and %', v_game.min_stake, v_game.max_stake;
  end if;

  if p_invited_user_id is not null and p_invited_user_id = auth.uid() then
    raise exception 'You cannot challenge yourself';
  end if;

  perform public.apply_wallet_transaction(
    auth.uid(), 'match_stake', p_stake_amount, null, 'Stake for new ' || v_game.name || ' match'
  );

  if p_game_slug = 'draughts' then
    select
      (select jsonb_object_agg(i::text, 'b') from generate_series(1, 12) i)
      || (select jsonb_object_agg(i::text, 'r') from generate_series(21, 32) i)
    into v_draughts_board;
  end if;

  v_game_state := case p_game_slug
    when 'chess' then jsonb_build_object(
      'fen', 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      'pgn', '',
      'current_turn', 'w',
      'white_player_id', auth.uid(),
      'black_player_id', null,
      'status', 'waiting'
    )
    when 'tic-tac-toe' then jsonb_build_object(
      'board', jsonb_build_array(null, null, null, null, null, null, null, null, null),
      'current_turn', 'X',
      'winner', null,
      'is_draw', false,
      'game_over', false,
      'x_player_id', auth.uid(),
      'o_player_id', null
    )
    when 'draughts' then jsonb_build_object(
      'board', v_draughts_board,
      'current_turn', 'b',
      'winner', null,
      'game_over', false,
      'r_player_id', null,
      'b_player_id', auth.uid()
    )
    when 'battleship' then jsonb_build_object(
      'game_type', 'battleship',
      'grid_size', 8,
      'player_a_id', auth.uid(),
      'player_b_id', null,
      'current_turn', null,
      'shots_on_a', '{}'::jsonb,
      'shots_on_b', '{}'::jsonb,
      'ships_alive_a', 12,
      'ships_alive_b', 12,
      'sunk_ships_a', '[]'::jsonb,
      'sunk_ships_b', '[]'::jsonb,
      'winner_id', null,
      'game_over', false
    )
    when 'snakes-ladders' then jsonb_build_object(
      'game_type', 'snakes_ladders',
      'player_1_id', auth.uid(),
      'player_2_id', null,
      'current_turn', auth.uid(),
      'positions', jsonb_build_object(auth.uid()::text, 0),
      'last_roll', null,
      'rolls_used', 0,
      'max_rolls', 200,
      'winner_id', null,
      'game_over', false
    )
    when 'rock_paper_scissors' then jsonb_build_object('game_type', 'rock_paper_scissors')
    when 'coin_flip' then jsonb_build_object('game_type', 'coin_flip')
    when 'dice' then jsonb_build_object('game_type', 'dice_duel')
    else '{}'::jsonb
  end;

  insert into matches (game_id, creator_id, stake_amount, total_pot, status, invited_user_id, game_state)
  values (v_game.id, auth.uid(), p_stake_amount, p_stake_amount * 2, 'waiting', p_invited_user_id, v_game_state)
  returning * into v_match;

  if p_game_slug = 'battleship' then
    perform public._place_battleship_fleet(v_match.id, auth.uid());
  end if;

  insert into match_participants (match_id, user_id)
  values (v_match.id, auth.uid());

  if p_invited_user_id is not null then
    select username into v_challenger_username from profiles where id = auth.uid();
    perform public.notify_user(
      p_invited_user_id,
      'New challenge!',
      coalesce(v_challenger_username, 'Someone') || ' challenged you to a ' ||
        v_game.name || ' match for ' || p_stake_amount || ' XAF. Tap to accept.'
    );
  end if;

  return v_match;
end;
$$;
