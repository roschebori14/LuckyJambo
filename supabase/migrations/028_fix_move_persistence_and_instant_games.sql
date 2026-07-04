-- Lucky Jambo - Fix move persistence for every game type
--
-- Three separate root causes were making moves not actually happen:
--
-- 1. INSTANT GAMES (rock_paper_scissors, coin_flip, dice) always said
--    "Move failed". submit_instant_move() reads
--    v_match.game_state->>'game_type' to know which game it's
--    resolving - but migration 027 (and the original create_match
--    before it) never set a 'game_type' key for these games, so it
--    was always null and hit the `else raise exception 'Unsupported
--    game type %'` branch. This migration seeds game_state properly
--    for all three instant games at creation time.
--
-- 2. COIN FLIP specifically also referenced a game_state->>'creator_call'
--    key that nothing ever wrote (the real UI has no "call heads/tails
--    at creation" step - instant-game-board.tsx has both players pick
--    heads/tails as their own move, the same as RPS). This migration
--    resolves coin_flip from each player's actual submitted move
--    instead of a field that was never populated.
--
-- 3. CHESS and TIC-TAC-TOE moves appeared to register (the piece/mark
--    showed briefly) then reverted, and the opponent never saw them.
--    Root cause: app/api/chess/move and app/api/tictactoe/move persist
--    the result with `supabase.from("matches").update(...)` using the
--    player's own session - but there is no RLS UPDATE policy on
--    matches (by design, so players can't rewrite stakes/winners
--    directly). That update silently affects 0 rows while the route
--    still returns success:true with the locally computed state, so
--    the client shows the move for a moment until the next state
--    refetch shows the real (unchanged) row. The same routes also
--    called apply_wallet_transaction directly for draw refunds, which
--    migration 017 correctly locked down to service_role only - so
--    draws were silently failing too. This migration adds two
--    SECURITY DEFINER RPCs that do the persistence + settlement
--    atomically and server-side (the same pattern submit_instant_move
--    already uses), and the accompanying route changes call those
--    instead of writing to the table directly.

-- ---------------------------------------------------------------
-- 1 & 2: re-seed game_state on create_match to include instant games
-- ---------------------------------------------------------------
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
    when 'rock_paper_scissors' then jsonb_build_object('game_type', 'rock_paper_scissors')
    when 'coin_flip' then jsonb_build_object('game_type', 'coin_flip')
    when 'dice' then jsonb_build_object('game_type', 'dice_duel')
    else '{}'::jsonb
  end;

  insert into matches (game_id, creator_id, stake_amount, total_pot, status, invited_user_id, game_state)
  values (v_game.id, auth.uid(), p_stake_amount, p_stake_amount * 2, 'waiting', p_invited_user_id, v_game_state)
  returning * into v_match;

  insert into match_participants (match_id, user_id)
  values (v_match.id, auth.uid());

  return v_match;
end;
$$;

-- join_match: keep the black_player_id / o_player_id patch from 027,
-- and restore the notify_user call from 016 that 027 accidentally
-- dropped when it redefined this function.
create or replace function public.join_match(
  p_match_id uuid
)
returns matches
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match matches%rowtype;
  v_game_slug text;
  v_joiner_username text;
begin
  select * into v_match from matches where id = p_match_id for update;

  if not found then
    raise exception 'Match not found';
  end if;

  if v_match.status != 'waiting' then
    raise exception 'Match is no longer open';
  end if;

  if v_match.creator_id = auth.uid() then
    raise exception 'You cannot join your own match';
  end if;

  if v_match.invited_user_id is not null and v_match.invited_user_id != auth.uid() then
    raise exception 'This match is a private challenge for another player';
  end if;

  select slug into v_game_slug from games where id = v_match.game_id;

  perform public.apply_wallet_transaction(
    auth.uid(), 'match_stake', v_match.stake_amount, null, 'Stake to join match'
  );

  insert into match_participants (match_id, user_id)
  values (p_match_id, auth.uid());

  update matches
  set
    status = 'active',
    game_state = case v_game_slug
      when 'chess' then jsonb_set(coalesce(game_state, '{}'::jsonb), '{black_player_id}', to_jsonb(auth.uid()::text))
      when 'tic-tac-toe' then jsonb_set(coalesce(game_state, '{}'::jsonb), '{o_player_id}', to_jsonb(auth.uid()::text))
      else game_state
    end
  where id = p_match_id
  returning * into v_match;

  select username into v_joiner_username from profiles where id = auth.uid();
  perform public.notify_user(
    v_match.creator_id, 'Opponent found!',
    coalesce(v_joiner_username, 'Someone') || ' joined your match. Good luck!'
  );

  return v_match;
end;
$$;

-- ---------------------------------------------------------------
-- 2: fix coin_flip resolution to use each player's actual move
-- ---------------------------------------------------------------
create or replace function public.submit_instant_move(
  p_match_id uuid,
  p_move text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match matches%rowtype;
  v_participants uuid[];
  v_opponent_id uuid;
  v_opponent_move text;
  v_result jsonb;
  v_winner_id uuid;
  v_game_type text;
  v_my_roll int;
  v_opp_roll int;
begin
  select * into v_match from matches where id = p_match_id for update;
  if not found then raise exception 'Match not found'; end if;
  if v_match.status != 'active' then raise exception 'Match is not active'; end if;

  select array_agg(user_id) into v_participants
  from match_participants where match_id = p_match_id;

  if not (auth.uid() = any(v_participants)) then
    raise exception 'Not a participant';
  end if;

  v_game_type := v_match.game_state->>'game_type';

  if v_game_type = 'rock_paper_scissors' then
    if p_move not in ('rock','paper','scissors') then
      raise exception 'Move must be rock, paper, or scissors';
    end if;
  elsif v_game_type = 'coin_flip' then
    if p_move not in ('heads','tails') then
      raise exception 'Move must be heads or tails';
    end if;
  elsif v_game_type = 'dice_duel' then
    null;
  else
    raise exception 'Unsupported game type %', v_game_type;
  end if;

  insert into match_moves (match_id, user_id, move)
  values (p_match_id, auth.uid(), p_move)
  on conflict (match_id, user_id) do nothing;

  v_opponent_id := (
    select user_id from unnest(v_participants) as user_id where user_id != auth.uid()
  );

  select move into v_opponent_move
  from match_moves where match_id = p_match_id and user_id = v_opponent_id;

  if v_opponent_move is null then
    return jsonb_build_object('status', 'waiting', 'message', 'Waiting for opponent');
  end if;

  if v_game_type = 'rock_paper_scissors' then
    declare
      v_my_move text := (select move from match_moves where match_id = p_match_id and user_id = auth.uid());
    begin
      if v_my_move = v_opponent_move then
        perform public.apply_wallet_transaction(auth.uid(), 'refund', v_match.stake_amount, p_match_id::text, 'RPS draw');
        perform public.apply_wallet_transaction(v_opponent_id, 'refund', v_match.stake_amount, p_match_id::text, 'RPS draw');
        update matches set status = 'completed', game_state = game_state || '{"outcome":"draw"}'::jsonb where id = p_match_id;
        return jsonb_build_object('status', 'draw', 'my_move', v_my_move, 'opponent_move', v_opponent_move);
      end if;

      v_winner_id := case
        when (v_my_move='rock'     and v_opponent_move='scissors')
          or (v_my_move='paper'    and v_opponent_move='rock')
          or (v_my_move='scissors' and v_opponent_move='paper')
        then auth.uid()
        else v_opponent_id
      end;
    end;

  elsif v_game_type = 'coin_flip' then
    -- Both players called heads/tails as their own move (see
    -- instant-game-board.tsx). The flip is server-side and random;
    -- whoever's call matches the flip wins. If both call the same
    -- side, or both call differently but neither matches the flip
    -- (impossible with only two options, but handled defensively),
    -- fall back to a coin-toss between the two calls.
    declare
      v_flip text := case when random() < 0.5 then 'heads' else 'tails' end;
      v_my_move text := (select move from match_moves where match_id = p_match_id and user_id = auth.uid());
      v_my_correct boolean := v_my_move = v_flip;
      v_opp_correct boolean := v_opponent_move = v_flip;
    begin
      if v_my_correct and not v_opp_correct then
        v_winner_id := auth.uid();
      elsif v_opp_correct and not v_my_correct then
        v_winner_id := v_opponent_id;
      else
        -- Both right or both wrong (i.e. both called the same side) -
        -- treat as a fair coin toss between the two players.
        v_winner_id := case when random() < 0.5 then auth.uid() else v_opponent_id end;
      end if;
    end;

  elsif v_game_type = 'dice_duel' then
    loop
      v_my_roll  := floor(random() * 6 + 1)::int;
      v_opp_roll := floor(random() * 6 + 1)::int;
      exit when v_my_roll != v_opp_roll;
    end loop;
    v_winner_id := case when v_my_roll > v_opp_roll then auth.uid() else v_opponent_id end;
  end if;

  perform public.settle_match(p_match_id, v_winner_id);

  v_result := jsonb_build_object(
    'status', 'resolved',
    'winner_id', v_winner_id,
    'you_won', v_winner_id = auth.uid()
  );

  return v_result;
end;
$$;

-- ---------------------------------------------------------------
-- 3: atomic, authoritative persistence for chess moves
-- ---------------------------------------------------------------
create or replace function public.apply_chess_move_result(
  p_match_id uuid,
  p_expected_fen text,
  p_new_fen text,
  p_new_pgn text,
  p_new_turn text,
  p_is_checkmate boolean,
  p_is_draw boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match matches%rowtype;
  v_state jsonb;
  v_white uuid;
  v_black uuid;
  v_current_turn text;
  v_mover_id uuid;
  v_new_state jsonb;
begin
  select * into v_match from matches where id = p_match_id for update;
  if not found then raise exception 'Match not found'; end if;
  if v_match.status != 'active' then raise exception 'Match is not active'; end if;

  v_state := v_match.game_state;
  v_white := (v_state->>'white_player_id')::uuid;
  v_black := (v_state->>'black_player_id')::uuid;
  v_current_turn := v_state->>'current_turn';

  if auth.uid() != v_white and auth.uid() != v_black then
    raise exception 'Not a participant';
  end if;

  if v_state->>'fen' != p_expected_fen then
    raise exception 'Match state has changed - please refresh and retry';
  end if;

  v_mover_id := case when v_current_turn = 'w' then v_white else v_black end;
  if auth.uid() != v_mover_id then
    raise exception 'Not your turn';
  end if;

  v_new_state := jsonb_build_object(
    'fen', p_new_fen,
    'pgn', p_new_pgn,
    'current_turn', p_new_turn,
    'white_player_id', v_white,
    'black_player_id', v_black,
    'status', case when p_is_checkmate then 'checkmate' when p_is_draw then 'draw' else 'active' end
  );

  update matches set game_state = v_new_state where id = p_match_id;

  if p_is_checkmate then
    perform public.settle_match(p_match_id, auth.uid());
  elsif p_is_draw then
    perform public.refund_draw(p_match_id);
  end if;

  return jsonb_build_object('success', true, 'game_state', v_new_state);
end;
$$;

-- ---------------------------------------------------------------
-- 3: atomic, authoritative move + win/draw resolution for tic-tac-toe
--    (computed entirely server-side, so a tampered client board can't
--    influence the result - only the cell index is trusted as input)
-- ---------------------------------------------------------------
create or replace function public.submit_tictactoe_move(
  p_match_id uuid,
  p_cell_index int
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match matches%rowtype;
  v_state jsonb;
  v_board jsonb;
  v_current_turn text;
  v_x_player uuid;
  v_o_player uuid;
  v_mover_id uuid;
  v_new_board jsonb;
  v_winner text := null;
  v_is_draw boolean := false;
  v_game_over boolean := false;
  v_new_turn text;
  v_new_state jsonb;
  v_winner_id uuid;
  v_line int[];
  v_lines int[][] := array[
    array[0,1,2], array[3,4,5], array[6,7,8],
    array[0,3,6], array[1,4,7], array[2,5,8],
    array[0,4,8], array[2,4,6]
  ];
  v_board_full boolean;
begin
  select * into v_match from matches where id = p_match_id for update;
  if not found then raise exception 'Match not found'; end if;
  if v_match.status != 'active' then raise exception 'Match is not active'; end if;

  v_state := v_match.game_state;
  v_board := v_state->'board';
  v_current_turn := v_state->>'current_turn';
  v_x_player := (v_state->>'x_player_id')::uuid;
  v_o_player := (v_state->>'o_player_id')::uuid;

  if auth.uid() != v_x_player and auth.uid() != v_o_player then
    raise exception 'Not a participant';
  end if;

  v_mover_id := case when v_current_turn = 'X' then v_x_player else v_o_player end;
  if auth.uid() != v_mover_id then
    raise exception 'Not your turn';
  end if;

  if p_cell_index < 0 or p_cell_index > 8 then
    raise exception 'Cell index must be 0-8';
  end if;

  if jsonb_typeof(v_board->p_cell_index) != 'null' then
    raise exception 'Cell is already occupied';
  end if;

  v_new_board := jsonb_set(v_board, array[p_cell_index::text], to_jsonb(v_current_turn));

  foreach v_line slice 1 in array v_lines
  loop
    if v_new_board->>v_line[1] is not null
       and v_new_board->>v_line[1] = v_new_board->>v_line[2]
       and v_new_board->>v_line[1] = v_new_board->>v_line[3]
    then
      v_winner := v_new_board->>v_line[1];
    end if;
  end loop;

  select not exists (
    select 1 from jsonb_array_elements(v_new_board) as cell where cell = 'null'::jsonb
  ) into v_board_full;

  v_is_draw := (v_winner is null) and v_board_full;
  v_game_over := (v_winner is not null) or v_is_draw;
  v_new_turn := case when v_current_turn = 'X' then 'O' else 'X' end;

  v_new_state := jsonb_build_object(
    'board', v_new_board,
    'current_turn', v_new_turn,
    'winner', v_winner,
    'is_draw', v_is_draw,
    'game_over', v_game_over,
    'x_player_id', v_x_player,
    'o_player_id', v_o_player
  );

  update matches set game_state = v_new_state where id = p_match_id;

  if v_winner is not null then
    v_winner_id := case when v_winner = 'X' then v_x_player else v_o_player end;
    perform public.settle_match(p_match_id, v_winner_id);
  elsif v_is_draw then
    perform public.refund_draw(p_match_id);
  end if;

  return jsonb_build_object('success', true, 'state', v_new_state);
end;
$$;
