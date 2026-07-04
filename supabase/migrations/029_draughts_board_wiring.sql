-- Lucky Jambo - Draughts board UI wiring (Phase 9)
--
-- The DraughtsEngine (lib/games/draughts-engine.ts) already fully
-- implements English draughts rules - mandatory captures, multi-jump
-- chains, king promotion, win detection - and is well-isolated/pure,
-- so it's kept as the rules authority (same approach as chess.js for
-- chess: too much logic to re-implement safely in plpgsql). What was
-- missing:
--   1. create_match never seeded a draughts game_state (same gap that
--      hit every other game before migrations 027/028).
--   2. join_match never recorded the joining player's id.
--   3. There was no atomic, RLS-safe persistence path - following the
--      same lesson from 028 (chess.js/TicTacToeEngine can decide *that*
--      a move is legal, but a raw `supabase.from("matches").update()`
--      from the player's own session silently writes nothing because
--      there's no UPDATE policy on matches). This adds
--      apply_draughts_move_result, mirroring apply_chess_move_result.
--
-- Convention (matching chess white=creator, tic-tac-toe X=creator):
-- DraughtsEngine.createGame() always starts with current_turn = 'b',
-- so the creator is seated as 'b' (moves first) and the joiner as 'r'.

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
      when 'draughts' then jsonb_set(coalesce(game_state, '{}'::jsonb), '{r_player_id}', to_jsonb(auth.uid()::text))
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
-- Atomic, authoritative persistence for draughts moves.
-- DraughtsEngine.makeMove() (server-side, in the API route) is still
-- the rules authority - this RPC re-checks turn order and that the
-- board hasn't changed since the client last read it, then persists
-- the already-validated result and settles the match if it ended.
-- Draughts has no draw outcome (a player loses when they have no
-- legal moves), so unlike chess/tic-tac-toe there's no refund path.
-- ---------------------------------------------------------------
create or replace function public.apply_draughts_move_result(
  p_match_id uuid,
  p_expected_board jsonb,
  p_new_board jsonb,
  p_new_turn text,
  p_game_over boolean,
  p_winner text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match matches%rowtype;
  v_state jsonb;
  v_r uuid;
  v_b uuid;
  v_current_turn text;
  v_mover_id uuid;
  v_new_state jsonb;
  v_winner_id uuid;
begin
  select * into v_match from matches where id = p_match_id for update;
  if not found then raise exception 'Match not found'; end if;
  if v_match.status != 'active' then raise exception 'Match is not active'; end if;

  v_state := v_match.game_state;
  v_r := (v_state->>'r_player_id')::uuid;
  v_b := (v_state->>'b_player_id')::uuid;
  v_current_turn := v_state->>'current_turn';

  if auth.uid() != v_r and auth.uid() != v_b then
    raise exception 'Not a participant';
  end if;

  if v_state->'board' != p_expected_board then
    raise exception 'Match state has changed - please refresh and retry';
  end if;

  v_mover_id := case when v_current_turn = 'r' then v_r else v_b end;
  if auth.uid() != v_mover_id then
    raise exception 'Not your turn';
  end if;

  v_new_state := jsonb_build_object(
    'board', p_new_board,
    'current_turn', p_new_turn,
    'winner', p_winner,
    'game_over', p_game_over,
    'r_player_id', v_r,
    'b_player_id', v_b
  );

  update matches set game_state = v_new_state where id = p_match_id;

  if p_game_over then
    v_winner_id := case when p_winner = 'r' then v_r else v_b end;
    perform public.settle_match(p_match_id, v_winner_id);
  end if;

  return jsonb_build_object('success', true, 'game_state', v_new_state);
end;
$$;
