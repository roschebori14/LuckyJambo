-- Lucky Jambo - Word Rush
--
-- A GamePigeon "Word Hunt"-style simultaneous, timed word-scramble
-- game. Genuinely different shape from every other game here
-- (chess/draughts/word-chain/etc): those are all turn-based, one
-- player acts and the turn passes. Word Rush has no turn order at
-- all - once the round starts, both players submit words
-- independently and concurrently against the same shared scramble
-- until the shared timer runs out, then scores are compared.
--
-- Design notes:
--   * The scramble (`letters`) is generated once, server-side, in
--     TypeScript (lib/games/word-rush/engine.ts's generateScramble) -
--     the same "SQL seeds a shape-only placeholder, the create API
--     route immediately overwrites it with the real TS-generated
--     value" pattern word-chain's create route already uses, since a
--     random scramble needs to be decided exactly once and letter
--     weighting/vowel-guarantee logic has no reason to be duplicated
--     in SQL.
--   * The round starts the instant the second player joins (mirrors
--     every other game here - there's no separate "both players
--     ready up" handshake anywhere in this codebase), so join_match
--     stamps round_started_at = now() directly.
--   * Because both players write to the same match row concurrently
--     (unlike every turn-based game's "only the mover writes" shape),
--     apply_word_rush_submit_word merges in only the acting player's
--     own found_words/score fields under a row lock, rather than
--     rebuilding the whole game_state from a client-supplied snapshot
--     the way apply_word_chain_move_result does - a concurrent
--     submission from the opponent must never be clobbered.
--   * A rejected word is not persisted at all and never reaches this
--     migration - engine.ts's applySubmitWord returns wordAccepted:
--     false straight back to the API response. There is no strike
--     concept here (see the build brief: misses are expected and
--     free in a real-time word hunt).

-- ---------------------------------------------------------------
-- create_match: full function body (every other branch unchanged
-- from 064_eight_ball_pool.sql) plus the new word-rush branch. The
-- word-rush game_state here is a placeholder shape only - the
-- `letters` scramble is always overwritten immediately afterward by
-- app/api/word-rush/create/route.ts with the real TS-generated draw.
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
      'cells', (select jsonb_agg(null) from generate_series(1, 42)),
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
      'h_lines', (select jsonb_agg(null) from generate_series(1, 20)),
      'v_lines', (select jsonb_agg(null) from generate_series(1, 20)),
      'box_owners', (select jsonb_agg(null) from generate_series(1, 16)),
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
    when 'word-rush' then jsonb_build_object(
      'letters', '[]'::jsonb,
      'round_started_at', null,
      'round_seconds', 80,
      'a_player_id', auth.uid(),
      'b_player_id', null,
      'a_found_words', '[]'::jsonb,
      'b_found_words', '[]'::jsonb,
      'a_score', 0,
      'b_score', 0,
      'winner', null,
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

-- ---------------------------------------------------------------
-- join_match: full function body (every other branch unchanged)
-- plus the word-rush branch, which both seats player B and starts
-- the round immediately (round_started_at = now()) - there is no
-- "waiting to start" step once both players are present, same as
-- every other game's current_turn already being live the instant the
-- match goes active.
-- ---------------------------------------------------------------
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
      when 'battleship' then jsonb_set(
        jsonb_set(coalesce(game_state, '{}'::jsonb), '{player_b_id}', to_jsonb(auth.uid()::text)),
        '{current_turn}', coalesce(game_state->'player_a_id', 'null'::jsonb)
      )
      when 'snakes-ladders' then jsonb_set(
        jsonb_set(coalesce(game_state, '{}'::jsonb), '{player_2_id}', to_jsonb(auth.uid()::text)),
        '{positions}',
        coalesce(game_state->'positions', '{}'::jsonb) || jsonb_build_object(auth.uid()::text, 0)
      )
      when 'four-in-a-row' then jsonb_set(coalesce(game_state, '{}'::jsonb), '{y_player_id}', to_jsonb(auth.uid()::text))
      when 'dots-and-boxes' then jsonb_set(coalesce(game_state, '{}'::jsonb), '{y_player_id}', to_jsonb(auth.uid()::text))
      when 'word-chain' then jsonb_set(
        jsonb_set(coalesce(game_state, '{}'::jsonb), '{b_player_id}', to_jsonb(auth.uid()::text)),
        '{turn_started_at}', to_jsonb(now())
      )
      when 'word-rush' then jsonb_set(
        jsonb_set(coalesce(game_state, '{}'::jsonb), '{b_player_id}', to_jsonb(auth.uid()::text)),
        '{round_started_at}', to_jsonb(now())
      )
      else game_state
    end
  where id = p_match_id
  returning * into v_match;

  if v_game_slug = 'battleship' then
    perform public._place_battleship_fleet(p_match_id, auth.uid());
  end if;

  select username into v_joiner_username from profiles where id = auth.uid();
  perform public.notify_user(
    v_match.creator_id, 'Opponent found!',
    coalesce(v_joiner_username, 'Someone') || ' joined your match. Good luck!'
  );

  return v_match;
end;
$$;

-- ---------------------------------------------------------------
-- apply_word_rush_submit_word: persists one already-validated word
-- submission (engine.ts's applySubmitWord is the rules authority -
-- dictionary, scramble-formability, and already-found checks all
-- happen there before this RPC is ever called). Unlike
-- apply_word_chain_move_result, this does NOT rebuild the whole
-- game_state from a client-supplied snapshot - both players can call
-- this concurrently against the same row, so it locks the row,
-- re-derives the caller's seat and the current round deadline from
-- what's actually persisted, and merges in only that seat's own
-- found_words/score. The opponent's fields are only ever touched by
-- the opponent's own concurrent call, never by this one.
-- ---------------------------------------------------------------
create or replace function public.apply_word_rush_submit_word(
  p_match_id uuid,
  p_word text,
  p_points int
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match matches%rowtype;
  v_state jsonb;
  v_a uuid;
  v_b uuid;
  v_seat text;
  v_round_started_at timestamptz;
  v_round_seconds int;
  v_found_words jsonb;
  v_new_state jsonb;
begin
  select * into v_match from matches where id = p_match_id for update;
  if not found then raise exception 'Match not found'; end if;
  if v_match.status != 'active' then raise exception 'Match is not active'; end if;

  v_state := v_match.game_state;
  v_a := (v_state->>'a_player_id')::uuid;
  v_b := nullif(v_state->>'b_player_id', '')::uuid;

  if auth.uid() != v_a and auth.uid() != v_b then
    raise exception 'Not a participant';
  end if;

  if coalesce((v_state->>'game_over')::boolean, false) then
    raise exception 'This match has already ended';
  end if;

  v_round_started_at := (v_state->>'round_started_at')::timestamptz;
  v_round_seconds := coalesce((v_state->>'round_seconds')::int, 80);

  if v_round_started_at is null
     or now() >= v_round_started_at + (v_round_seconds || ' seconds')::interval then
    raise exception 'The round has already ended';
  end if;

  v_seat := case when auth.uid() = v_a then 'a' else 'b' end;
  v_found_words := coalesce(v_state->(v_seat || '_found_words'), '[]'::jsonb);

  -- Word Chain-style duplicate re-check, re-derived from the locked
  -- row rather than trusted from the caller, in case two rapid
  -- submissions of the same word from the same player raced each
  -- other past engine.ts's own check.
  if v_found_words @> to_jsonb(p_word) then
    raise exception 'Word already found this round';
  end if;

  v_new_state := v_state
    || jsonb_build_object(v_seat || '_found_words', v_found_words || to_jsonb(p_word))
    || jsonb_build_object(
         v_seat || '_score',
         coalesce((v_state->>(v_seat || '_score'))::int, 0) + p_points
       );

  update matches set game_state = v_new_state where id = p_match_id;

  return jsonb_build_object('success', true, 'game_state', v_new_state);
end;
$$;

revoke execute on function public.apply_word_rush_submit_word(uuid, text, int) from public;
revoke execute on function public.apply_word_rush_submit_word(uuid, text, int) from anon;
grant execute on function public.apply_word_rush_submit_word(uuid, text, int) to authenticated;

-- ---------------------------------------------------------------
-- apply_word_rush_end_round: reports that the shared round timer has
-- elapsed. Callable by either participant (same reasoning as
-- apply_word_chain_timeout - whoever's client notices first), and
-- re-derives the deadline from round_started_at + round_seconds
-- against the database's own now(), never from anything the caller
-- claims. Ties refund both stakes via refund_draw (this project's
-- existing draw convention - see 017_security_lockdown_wallet_rpc.sql),
-- a decisive score difference settles via settle_match.
-- ---------------------------------------------------------------
create or replace function public.apply_word_rush_end_round(
  p_match_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match matches%rowtype;
  v_state jsonb;
  v_a uuid;
  v_b uuid;
  v_round_started_at timestamptz;
  v_round_seconds int;
  v_a_score int;
  v_b_score int;
  v_winner text;
  v_winner_id uuid;
  v_new_state jsonb;
begin
  select * into v_match from matches where id = p_match_id for update;
  if not found then raise exception 'Match not found'; end if;
  if v_match.status != 'active' then raise exception 'Match is not active'; end if;

  v_state := v_match.game_state;
  v_a := (v_state->>'a_player_id')::uuid;
  v_b := nullif(v_state->>'b_player_id', '')::uuid;

  if auth.uid() != v_a and auth.uid() != v_b then
    raise exception 'Not a participant';
  end if;

  if coalesce((v_state->>'game_over')::boolean, false) then
    raise exception 'This match has already ended';
  end if;

  v_round_started_at := (v_state->>'round_started_at')::timestamptz;
  v_round_seconds := coalesce((v_state->>'round_seconds')::int, 80);

  if v_round_started_at is null
     or now() < v_round_started_at + (v_round_seconds || ' seconds')::interval then
    raise exception 'The round has not ended yet';
  end if;

  v_a_score := coalesce((v_state->>'a_score')::int, 0);
  v_b_score := coalesce((v_state->>'b_score')::int, 0);
  v_winner := case
    when v_a_score = v_b_score then null
    when v_a_score > v_b_score then 'A'
    else 'B'
  end;

  v_new_state := v_state || jsonb_build_object(
    'winner', v_winner,
    'game_over', true
  );

  update matches set game_state = v_new_state where id = p_match_id;

  if v_winner is null then
    perform public.refund_draw(p_match_id);
  else
    v_winner_id := case when v_winner = 'A' then v_a else v_b end;
    perform public.settle_match(p_match_id, v_winner_id);
  end if;

  return jsonb_build_object('success', true, 'game_state', v_new_state);
end;
$$;

revoke execute on function public.apply_word_rush_end_round(uuid) from public;
revoke execute on function public.apply_word_rush_end_round(uuid) from anon;
grant execute on function public.apply_word_rush_end_round(uuid) to authenticated;

-- ---------------------------------------------------------------
-- Register the game
-- ---------------------------------------------------------------
insert into games (name, slug, min_stake, max_stake, is_active)
values ('Word Rush', 'word-rush', 50, 100000, true)
on conflict (slug) do nothing;
