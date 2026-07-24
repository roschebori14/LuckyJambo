-- Lucky Jambo - Fix regressions introduced by 066_word_rush.sql
--
-- ROOT CAUSE
-- 066_word_rush.sql's own header says "every other branch unchanged
-- from 064_eight_ball_pool.sql". That's the bug: 064 was NOT the
-- latest version of create_match/join_match at the time - 065
-- (eight_ball_pool_fixes) was, and it contains two previously-shipped
-- bug fixes plus the actual eight-ball-pool branch. Branching off 064
-- instead of 065 silently reverted all of it:
--
--   1. jsonb_agg(null) without a cast, reintroduced in the
--      four-in-a-row/dots-and-boxes branches. This is the exact bug
--      fixed in 054/059 ("could not determine polymorphic type") -
--      and per that migration's own postmortem, a plpgsql CASE
--      assignment is type-checked as ONE expression across every
--      branch the first time it's planned in a session, so a bad cast
--      in the four-in-a-row branch breaks create_match() for every
--      slug, including word-rush - intermittently, depending on which
--      pooled connection/cached plan a given request lands on. This
--      is almost certainly why matches (of any game) have been
--      randomly failing to create or join since 066 shipped.
--
--   2. The silent `else '{}'::jsonb` fallback for unhandled slugs,
--      which 059 deliberately replaced with a hard exception (that
--      migration's "BUG 2" - an unrecognized slug used to create a
--      match with an empty, crash-inducing game_state instead of
--      failing loudly). 066 brought the silent version back.
--
--   3. The entire 'eight-ball-pool' branch is missing from both
--      functions. Since 066, creating or joining a pool match falls
--      through to '{}'::jsonb / an unmodified game_state - pool is
--      currently broken the same way it was before 065.
--
-- This migration restores all three (still keeping every word-rush
-- branch exactly as 066 added it - that part was fine) and adds the
-- missing seed RPC word-rush needs for the same reason pool needed
-- seed_pool_rack: app/api/word-rush/create/route.ts currently tries
-- to persist the real letter scramble via a raw
-- `supabase.from("matches").update(...)` from the player's own
-- session, which silently writes 0 rows (no RLS UPDATE policy on
-- `matches` - see 029/065 for the same gap hitting draughts and pool).
-- So today, every word-rush match is created with `letters: []`
-- forever, regardless of what app/api/word-rush/create/route.ts thinks
-- it just saved.

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
    -- app/api/pool/create/route.ts.
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
    -- Placeholder only - a real shuffled scramble is filled in by
    -- seed_word_rush_letters immediately after, from
    -- app/api/word-rush/create/route.ts.
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
-- seed_word_rush_letters: lets the match creator overwrite the
-- placeholder word-rush state with the real letter scramble built in
-- TypeScript (lib/games/word-rush/engine.ts's createInitialState),
-- atomically and through a path that's actually allowed to write to
-- `matches` - unlike the raw `supabase.from("matches").update(...)`
-- the create route currently uses, which silently affects 0 rows (no
-- RLS UPDATE policy on matches - same gap 029/065 already documented
-- for draughts and pool). Mirrors seed_pool_rack exactly.
--
-- Deliberately narrow: only the match's own creator, only while it's
-- still 'waiting' (the short window between create_match and the
-- opponent joining), and only for a word-rush match.
-- ---------------------------------------------------------------
create or replace function public.seed_word_rush_letters(
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
    raise exception 'Only the match creator can seed the letters';
  end if;

  if v_match.status != 'waiting' then
    raise exception 'Letters can only be seeded before an opponent joins';
  end if;

  select slug into v_game_slug from games where id = v_match.game_id;
  if v_game_slug != 'word-rush' then
    raise exception 'Not a word-rush match';
  end if;

  update matches set game_state = p_state where id = p_match_id;

  return p_state;
end;
$$;

revoke execute on function public.seed_word_rush_letters(uuid, jsonb) from public;
revoke execute on function public.seed_word_rush_letters(uuid, jsonb) from anon;
grant execute on function public.seed_word_rush_letters(uuid, jsonb) to authenticated;
