-- Lucky Jambo - 8-Ball Pool: fix match creation/join wiring
--
-- 064_eight_ball_pool.sql added the shot-persistence RPC and the
-- `games` row for 'eight-ball-pool', but never gave create_match or
-- join_match a branch for it - the exact gap 029_draughts_board_wiring
-- and 059_fix_create_match_jsonb_agg_and_unknown_slug both called out
-- for other games:
--
--   1. Since 059, create_match's `else` branch raises instead of
--      silently creating an empty-state match - so right now,
--      calling create_match('eight-ball-pool', ...) fails outright
--      with "Game eight-ball-pool has no create_match state
--      initializer". app/api/pool/create/route.ts's plan to patch the
--      real rack in afterwards via a raw
--      `supabase.from("matches").update(...)` from the player's own
--      session never even gets there, and wouldn't have worked
--      anyway - same lesson as 029/028: there is no RLS UPDATE policy
--      on `matches`, so that call silently writes 0 rows.
--
--   2. join_match has the same gap for the second player: no
--      'eight-ball-pool' branch means b_player_id never gets set
--      server-side. app/api/pool/state/route.ts was working around
--      this by "backfilling" b_player_id onto the in-memory object it
--      returns for that one response, via that same broken
--      `.update()` call - so it *looked* fixed in whatever request
--      happened to trigger the backfill, but the actual DB row (and
--      therefore apply_pool_shot_result's own read of
--      game_state->>'b_player_id') never changed. Concretely: player
--      B could never take a shot, because apply_pool_shot_result
--      would compute v_b as null forever and "Not your turn" for
--      every shot B tried to submit.
--
-- Fix: give both functions a real 'eight-ball-pool' branch, and add a
-- dedicated seed_pool_rack RPC (security definer, same shape as every
-- other atomic persistence RPC in this codebase) instead of a raw
-- client-side update - so app/api/pool/create/route.ts's TypeScript
-- rack-building logic (lib/games/pool/engine.ts's createInitialState,
-- which needs actual shuffling/racking logic too fiddly to want to
-- duplicate correctly in plpgsql) can still be the source of truth
-- for the initial rack, atomically, through a path that's actually
-- allowed to write.
--
-- create_match itself seeds a *placeholder* pool state (correct
-- shape, empty rack) so a match is never left in the "no initializer"
-- error state even for the brief window before seed_pool_rack runs;
-- seed_pool_rack then overwrites it with the real shuffled rack.

-- ---------------------------------------------------------------
-- create_match: same full body as 059_fix_create_match_jsonb_agg_and_
-- unknown_slug.sql, plus an 'eight-ball-pool' branch.
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
    -- Placeholder only - a real shuffled rack is filled in by
    -- seed_pool_rack immediately after, from
    -- app/api/pool/create/route.ts. Kept in the correct shape (rather
    -- than '{}') so nothing crashes reading it in the brief window
    -- before that call lands, and so this branch never has to
    -- duplicate the actual racking logic in plpgsql.
    when 'eight-ball-pool' then jsonb_build_object(
      'game_type', 'eight-ball-pool',
      'a_player_id', auth.uid(),
      'b_player_id', null,
      'balls', '[]'::jsonb,
      'current_turn', 'A',
      'phase', 'break',
      'player_type', jsonb_build_object('A', null, 'B', null),
      'ball_in_hand', null,
      'winner', null,
      'game_over', false,
      'last_foul_reason', null,
      'shot_number', 0
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

-- ---------------------------------------------------------------
-- join_match: same full body as 056_word_chain_turn_timer.sql, plus
-- an 'eight-ball-pool' branch that actually records b_player_id
-- server-side (replacing the state-route "backfill" that could never
-- persist).
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
      when 'eight-ball-pool' then jsonb_set(coalesce(game_state, '{}'::jsonb), '{b_player_id}', to_jsonb(auth.uid()::text))
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
-- seed_pool_rack: lets the match creator overwrite the placeholder
-- pool state with the real shuffled rack built in TypeScript
-- (lib/games/pool/engine.ts's createInitialState), atomically and
-- through a path that's actually allowed to write to `matches` -
-- unlike the raw `supabase.from("matches").update(...)` the original
-- create route tried, which silently affects 0 rows (no RLS UPDATE
-- policy on matches, same gap 028/029 already documented for other
-- games).
--
-- Deliberately narrow: only the match's own creator, only while it's
-- still 'waiting' (i.e. only in the short window between create_match
-- and the opponent joining), and only for an eight-ball-pool match -
-- this is a one-shot rack seed, not a general state-patching backdoor.
-- ---------------------------------------------------------------
create or replace function public.seed_pool_rack(
  p_match_id uuid,
  p_state jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match matches%rowtype;
  v_game_slug text;
begin
  select * into v_match from matches where id = p_match_id for update;
  if not found then
    raise exception 'Match not found';
  end if;

  if v_match.creator_id != auth.uid() then
    raise exception 'Only the match creator can seed the rack';
  end if;

  if v_match.status != 'waiting' then
    raise exception 'Rack can only be seeded before an opponent joins';
  end if;

  select slug into v_game_slug from games where id = v_match.game_id;
  if v_game_slug != 'eight-ball-pool' then
    raise exception 'Not a pool match';
  end if;

  update matches set game_state = p_state where id = p_match_id;

  return p_state;
end;
$$;

revoke execute on function public.seed_pool_rack(uuid, jsonb) from public;
revoke execute on function public.seed_pool_rack(uuid, jsonb) from anon;
grant execute on function public.seed_pool_rack(uuid, jsonb) to authenticated;
