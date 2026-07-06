-- Lucky Jambo - Word Chain turn timer
--
-- Adds a per-turn countdown so a player can't stall indefinitely to
-- go look a word up elsewhere before submitting - each turn gets
-- `turn_seconds` (20s) from `turn_started_at`, and either participant
-- (not just whoever's turn it is - the whole point is the *other*
-- player can call this out) can report the timeout once it's actually
-- elapsed. The deadline is computed from turn_started_at + turn_seconds
-- using the database's own now(), never from anything the client
-- claims about elapsed time, so there's nothing to spoof by messing
-- with a local clock.
--
-- A timed-out turn behaves exactly like an invalid word (see
-- 053_word_chain.sql's design note): it costs the stalling player a
-- strike, the turn stays with them (fresh clock) so they get another
-- shot, and 3 strikes still ends the match in the opponent's favor.

-- ---------------------------------------------------------------
-- create_match: full function body (unchanged from 053_word_chain.sql)
-- except the word-chain branch now seeds turn_started_at/turn_seconds.
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
-- join_match: full function body (unchanged from 053_word_chain.sql)
-- except the word-chain branch also resets turn_started_at to the
-- moment the match actually goes active - otherwise a match that sat
-- in "waiting" for a while would start with an already-expired timer.
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
-- apply_word_chain_move_result: same signature/body as
-- 053_word_chain.sql's version, just also stamping turn_started_at =
-- now() (a fresh clock for whoever's turn it is next) and carrying
-- turn_seconds through unchanged, so those fields survive every move
-- instead of getting dropped by the rebuilt jsonb_build_object.
-- ---------------------------------------------------------------
create or replace function public.apply_word_chain_move_result(
  p_match_id uuid,
  p_expected_chain jsonb,
  p_new_chain jsonb,
  p_new_required_letter text,
  p_new_turn text,
  p_new_strikes_a int,
  p_new_strikes_b int,
  p_winner text,
  p_game_over boolean
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
  v_current_turn text;
  v_mover_id uuid;
  v_new_state jsonb;
  v_winner_id uuid;
  v_turn_seconds int;
begin
  select * into v_match from matches where id = p_match_id for update;
  if not found then raise exception 'Match not found'; end if;
  if v_match.status != 'active' then raise exception 'Match is not active'; end if;

  v_state := v_match.game_state;
  v_a := (v_state->>'a_player_id')::uuid;
  v_b := nullif(v_state->>'b_player_id', '')::uuid;
  v_current_turn := v_state->>'current_turn';
  v_turn_seconds := coalesce((v_state->>'turn_seconds')::int, 20);

  if auth.uid() != v_a and auth.uid() != v_b then
    raise exception 'Not a participant';
  end if;

  if v_state->'chain' != p_expected_chain then
    raise exception 'Match state has changed - please refresh and retry';
  end if;

  v_mover_id := case when v_current_turn = 'A' then v_a else v_b end;
  if auth.uid() != v_mover_id then
    raise exception 'Not your turn';
  end if;

  v_new_state := jsonb_build_object(
    'chain', p_new_chain,
    'required_letter', p_new_required_letter,
    'current_turn', p_new_turn,
    'strikes_a', p_new_strikes_a,
    'strikes_b', p_new_strikes_b,
    'max_strikes', 3,
    'winner', p_winner,
    'game_over', p_game_over,
    'a_player_id', v_a,
    'b_player_id', v_b,
    'turn_started_at', to_jsonb(now()),
    'turn_seconds', v_turn_seconds
  );

  update matches set game_state = v_new_state where id = p_match_id;

  if p_game_over then
    v_winner_id := case when p_winner = 'A' then v_a else v_b end;
    perform public.settle_match(p_match_id, v_winner_id);
  end if;

  return jsonb_build_object('success', true, 'game_state', v_new_state);
end;
$$;

-- ---------------------------------------------------------------
-- apply_word_chain_timeout: reports that the *current* player's turn
-- clock has run out. Deliberately callable by either participant, not
-- just the player on the clock - the entire point is that a player who
-- goes quiet to look a word up can't just also refuse to call this on
-- themselves. Everything that matters is re-derived from the row
-- itself (locked with FOR UPDATE, so two near-simultaneous calls can't
-- both apply a strike for the same expiry): whether the match is still
-- active, whose turn it actually is, and whether turn_started_at +
-- turn_seconds has actually passed according to the database's own
-- now() - nothing here trusts anything the caller claims.
-- ---------------------------------------------------------------
create or replace function public.apply_word_chain_timeout(
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
  v_current_turn text;
  v_turn_started_at timestamptz;
  v_turn_seconds int;
  v_strikes_a int;
  v_strikes_b int;
  v_max_strikes int;
  v_busted boolean;
  v_winner text;
  v_new_state jsonb;
  v_winner_id uuid;
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

  v_current_turn := v_state->>'current_turn';
  v_turn_started_at := (v_state->>'turn_started_at')::timestamptz;
  v_turn_seconds := coalesce((v_state->>'turn_seconds')::int, 20);

  if v_turn_started_at is null
     or now() < v_turn_started_at + (v_turn_seconds || ' seconds')::interval then
    raise exception 'Turn has not timed out yet';
  end if;

  v_strikes_a := coalesce((v_state->>'strikes_a')::int, 0);
  v_strikes_b := coalesce((v_state->>'strikes_b')::int, 0);
  v_max_strikes := coalesce((v_state->>'max_strikes')::int, 3);

  if v_current_turn = 'A' then
    v_strikes_a := v_strikes_a + 1;
  else
    v_strikes_b := v_strikes_b + 1;
  end if;

  v_busted := (case when v_current_turn = 'A' then v_strikes_a else v_strikes_b end) >= v_max_strikes;
  v_winner := case when v_busted then (case when v_current_turn = 'A' then 'B' else 'A' end) else null end;

  -- Merge rather than rebuild: chain/required_letter/current_turn/
  -- player ids/turn_seconds all stay exactly as they were - a timeout
  -- is a strike against whoever's turn it is, same as an invalid word,
  -- it doesn't touch the chain or pass the turn.
  v_new_state := v_state || jsonb_build_object(
    'strikes_a', v_strikes_a,
    'strikes_b', v_strikes_b,
    'winner', v_winner,
    'game_over', v_busted,
    'turn_started_at', to_jsonb(now())
  );

  update matches set game_state = v_new_state where id = p_match_id;

  if v_busted then
    v_winner_id := case when v_winner = 'A' then v_a else v_b end;
    perform public.settle_match(p_match_id, v_winner_id);
  end if;

  return jsonb_build_object('success', true, 'game_state', v_new_state);
end;
$$;

revoke execute on function public.apply_word_chain_timeout(uuid) from public;
revoke execute on function public.apply_word_chain_timeout(uuid) from anon;
grant execute on function public.apply_word_chain_timeout(uuid) to authenticated;
