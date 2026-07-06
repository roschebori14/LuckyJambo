-- Lucky Jambo - Fix: create_match is currently broken for EVERY game
--
-- Reported symptom: creating a Ludo match and opening it produces
-- "Something went wrong loading this match" (the match/[matchId]/
-- error.tsx boundary). Root cause traced end to end against a real
-- Postgres instance running this project's full migration chain:
--
-- BUG 1 - jsonb_agg(null) is broken on its own, for any game
--   select jsonb_agg(null) from generate_series(1, 5);
--   ERROR:  could not determine polymorphic type because input has
--   type unknown
--
--   A bare `null` literal has no type, and jsonb_agg (like any
--   aggregate) needs a concrete input type to plan against. This
--   pattern was introduced for Four in a Row's 'cells' field and
--   copied into Dots and Boxes' h_lines/v_lines/box_owners
--   (050_four_in_a_row.sql, 051_dots_and_boxes.sql). Both migrations
--   fully redefine the shared create_match() function, and a plpgsql
--   CASE assignment is type-checked as a whole at prepare time across
--   *every* branch, not just the one that ends up executing - so this
--   doesn't just break create_match('four-in-a-row', ...) and
--   create_match('dots-and-boxes', ...), it breaks create_match() for
--   every single slug. Confirmed directly: create_match('chess', 500)
--   throws the exact same error against the current function.
--   Fix: `jsonb_agg(null::jsonb)` - confirmed working in isolation.
--
-- BUG 2 - unknown/unhandled slugs fail silently
--   Ludo needs its own create_ludo_match RPC (2-4 seats, its own
--   token/board shape - see 057_ludo.sql) and was never given a
--   branch in this generic function, which is correct - it shouldn't
--   have one. The problem is the `else '{}'::jsonb` fallback: calling
--   create_match('ludo', ...) doesn't raise an error, it just creates
--   a match with an *empty* game_state. The board then crashes trying
--   to read state.seats/state.tokens off `{}`, and that render
--   exception is what error.tsx is actually catching. (Separately,
--   the frontend page that was calling the generic endpoint for Ludo
--   in the first place has its own fix routing Ludo through
--   /api/ludo/create instead - see games/[id]/page.tsx. But this
--   function should never silently mis-create a match for *any* slug
--   it doesn't recognize, regardless of what the frontend does -
--   that's what let this go unnoticed.)
--   Fix: the else branch now raises an exception naming the slug,
--   so a future new game that's added to `games` before its
--   create_match branch (or dedicated RPC) is wired up fails loudly
--   at match-creation time instead of silently producing a match
--   nothing can render.
--
-- Nothing else about the function changes - this is the same body as
-- 056_word_chain_turn_timer.sql with those two fixes applied.

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
    when 'four-in-a-row' then jsonb_build_object(
      'cells', (select jsonb_agg(null::jsonb) from generate_series(1, 42)),
      'column_heights', jsonb_build_array(0, 0, 0, 0, 0, 0, 0),
      'current_turn', 'R',
      'winner', null,
      'winning_line', null,
      'is_draw', false,
      'game_over', false,
      'r_player_id', auth.uid(),
      'y_player_id', null
    )
    when 'dots-and-boxes' then jsonb_build_object(
      'h_lines', (select jsonb_agg(null::jsonb) from generate_series(1, 20)),
      'v_lines', (select jsonb_agg(null::jsonb) from generate_series(1, 20)),
      'box_owners', (select jsonb_agg(null::jsonb) from generate_series(1, 16)),
      'scores', jsonb_build_object('R', 0, 'Y', 0),
      'current_turn', 'R',
      'winner', null,
      'is_draw', false,
      'game_over', false,
      'r_player_id', auth.uid(),
      'y_player_id', null
    )
    when 'word-chain' then jsonb_build_object(
      'chain', '[]'::jsonb,
      'required_letter', null,
      'current_turn', 'A',
      'strikes_a', 0,
      'strikes_b', 0,
      'max_strikes', 3,
      'winner', null,
      'game_over', false,
      'a_player_id', auth.uid(),
      'b_player_id', null,
      'turn_started_at', to_jsonb(now()),
      'turn_seconds', 20
    )
    when 'rock_paper_scissors' then jsonb_build_object('game_type', 'rock_paper_scissors')
    when 'coin_flip' then jsonb_build_object('game_type', 'coin_flip')
    when 'dice' then jsonb_build_object('game_type', 'dice_duel')
    else null
  end;

  if v_game_state is null then
    raise exception 'Game % has no create_match state initializer - this is a server bug, not a user error', p_game_slug;
  end if;

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
