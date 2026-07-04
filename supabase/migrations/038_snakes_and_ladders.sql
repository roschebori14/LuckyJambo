-- Lucky Jambo - Snakes & Ladders (Phase 11)
--
-- The simplest possible shape of "simple": one token per player (no
-- multi-token choice problem like Ludo), roll a die, move forward, land
-- on a ladder or snake, done. State is barely bigger than Battleship's:
-- just each player's position on a 100-square path plus whose turn it
-- is - no board/grid to store at all, since the ladder/snake layout is
-- a fixed lookup table, not per-match data.
--
-- Design choices made explicit here:
--   1. Classic exact-landing rule: a roll that would overshoot square
--      100 is wasted (token stays put, turn passes) rather than
--      snapping to 100 or being clipped. This is the standard rule
--      most players expect, and costs nothing extra to implement.
--   2. No "extra turn on rolling a 6" - turns simply alternate every
--      roll. This is a deliberate simplification: it keeps state
--      trivial (no "same player goes again" branch) and, combined with
--      the round cap below, gives a hard ceiling on how long a
--      real-money match can possibly run.
--   3. Round cap (the one real design decision flagged for this game):
--      snakes can in principle bounce a player around for a very long
--      time on unlucky rolls. `max_rolls` (default 200, i.e. up to 100
--      rolls each) bounds this - if nobody has reached square 100 by
--      then, the match ends in a draw and both stakes are refunded via
--      the existing refund_draw() helper (same mechanism already used
--      for tic-tac-toe/chess stalemates). 200 is generous - real games
--      almost always finish well under 40 total rolls - so this is a
--      backstop against pathological luck, not a normal outcome.
--
-- Server-authoritative by construction: the client only ever sends
-- "roll for me" with no parameters, the die roll itself happens with
-- Postgres's random() inside this SECURITY DEFINER function (same
-- pattern already used for the dice_duel instant game in
-- 028_fix_move_persistence_and_instant_games.sql), so there is nothing
-- for a tampered client to influence.

-- ---------------------------------------------------------------
-- Fixed ladder/snake layout. A plain SQL lookup, not per-match data -
-- internal helper only, same "revoke from everyone, still callable
-- from inside a SECURITY DEFINER caller" trick as
-- _place_battleship_fleet in 035_battleship.sql.
-- ---------------------------------------------------------------
create or replace function public._snakes_ladders_landing(p_pos int)
returns int
language sql
immutable
as $$
  select case p_pos
    -- Ladders (bottom -> top)
    when 2  then 23
    when 8  then 34
    when 20 then 77
    when 32 then 68
    when 41 then 79
    when 74 then 88
    when 82 then 100
    -- Snakes (head -> tail)
    when 17 then 4
    when 54 then 34
    when 62 then 19
    when 64 then 60
    when 87 then 24
    when 93 then 68
    when 95 then 75
    when 99 then 78
    else p_pos
  end;
$$;

revoke execute on function public._snakes_ladders_landing(int) from public;
revoke execute on function public._snakes_ladders_landing(int) from anon;
revoke execute on function public._snakes_ladders_landing(int) from authenticated;

-- ---------------------------------------------------------------
-- create_match / join_match - full redefinition (same convention as
-- migrations 029/035) with a 'snakes-ladders' branch added to each.
-- Creator is seated as player_1 and rolls first once player_2 joins.
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
      when 'battleship' then jsonb_set(
        jsonb_set(coalesce(game_state, '{}'::jsonb), '{player_b_id}', to_jsonb(auth.uid()::text)),
        '{current_turn}', coalesce(game_state->'player_a_id', 'null'::jsonb)
      )
      when 'snakes-ladders' then jsonb_set(
        jsonb_set(coalesce(game_state, '{}'::jsonb), '{player_2_id}', to_jsonb(auth.uid()::text)),
        '{positions}',
        coalesce(game_state->'positions', '{}'::jsonb) || jsonb_build_object(auth.uid()::text, 0)
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
-- Roll the die. Fully server-authoritative: the client sends nothing
-- but the match id, the roll itself is generated here, and the
-- resulting position (including any ladder/snake) is computed and
-- persisted atomically so a tampered client can't influence or spoof
-- the outcome.
-- ---------------------------------------------------------------
create or replace function public.submit_snakes_ladders_roll(
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
  v_p1 uuid;
  v_p2 uuid;
  v_current_turn uuid;
  v_opponent uuid;
  v_positions jsonb;
  v_my_pos int;
  v_max_rolls int;
  v_rolls_used int;
  v_roll int;
  v_raw_pos int;
  v_landed_pos int;
  v_used_ladder boolean := false;
  v_used_snake boolean := false;
  v_game_over boolean := false;
  v_winner uuid;
  v_new_state jsonb;
begin
  select * into v_match from matches where id = p_match_id for update;
  if not found then raise exception 'Match not found'; end if;
  if v_match.status != 'active' then raise exception 'Match is not active'; end if;

  v_state := v_match.game_state;
  if v_state->>'game_type' != 'snakes_ladders' then
    raise exception 'Not a Snakes & Ladders match';
  end if;

  v_p1 := nullif(v_state->>'player_1_id', '')::uuid;
  v_p2 := nullif(v_state->>'player_2_id', '')::uuid;
  v_current_turn := nullif(v_state->>'current_turn', '')::uuid;

  if auth.uid() != v_p1 and auth.uid() != v_p2 then
    raise exception 'Not a participant';
  end if;
  if v_current_turn is null or auth.uid() != v_current_turn then
    raise exception 'Not your turn';
  end if;

  v_opponent := case when auth.uid() = v_p1 then v_p2 else v_p1 end;
  v_positions := coalesce(v_state->'positions', '{}'::jsonb);
  v_my_pos := coalesce((v_positions->>auth.uid()::text)::int, 0);
  v_max_rolls := coalesce((v_state->>'max_rolls')::int, 200);
  v_rolls_used := coalesce((v_state->>'rolls_used')::int, 0) + 1;

  v_roll := floor(random() * 6 + 1)::int;
  v_raw_pos := v_my_pos + v_roll;

  if v_raw_pos > 100 then
    -- Classic exact-landing rule: overshooting 100 wastes the roll.
    v_landed_pos := v_my_pos;
  else
    v_landed_pos := public._snakes_ladders_landing(v_raw_pos);
    v_used_ladder := v_landed_pos > v_raw_pos;
    v_used_snake := v_landed_pos < v_raw_pos;
  end if;

  v_positions := jsonb_set(v_positions, array[auth.uid()::text], to_jsonb(v_landed_pos));

  if v_landed_pos = 100 then
    v_game_over := true;
    v_winner := auth.uid();
  elsif v_rolls_used >= v_max_rolls then
    -- Round cap reached with nobody home - end in a draw rather than
    -- let a real-money match run forever on bad luck.
    v_game_over := true;
  end if;

  v_new_state := v_state
    || jsonb_build_object('positions', v_positions)
    || jsonb_build_object('rolls_used', v_rolls_used)
    || jsonb_build_object('last_roll', jsonb_build_object(
         'player_id', auth.uid()::text,
         'roll', v_roll,
         'from', v_my_pos,
         'to', v_landed_pos,
         'used_ladder', v_used_ladder,
         'used_snake', v_used_snake
       ))
    || jsonb_build_object('current_turn', case when v_game_over then 'null'::jsonb else to_jsonb(v_opponent::text) end)
    || jsonb_build_object('game_over', v_game_over)
    || jsonb_build_object('winner_id', case when v_winner is not null then to_jsonb(v_winner::text) else 'null'::jsonb end);

  update matches set game_state = v_new_state where id = p_match_id;

  if v_game_over and v_winner is not null then
    perform public.settle_match(p_match_id, v_winner);
  elsif v_game_over then
    perform public.refund_draw(p_match_id);
  end if;

  return jsonb_build_object('success', true, 'state', v_new_state, 'roll', v_roll);
end;
$$;

revoke execute on function public.submit_snakes_ladders_roll(uuid) from public;
revoke execute on function public.submit_snakes_ladders_roll(uuid) from anon;
grant execute on function public.submit_snakes_ladders_roll(uuid) to authenticated;

-- ---------------------------------------------------------------
-- Register the game
-- ---------------------------------------------------------------
insert into games (name, slug, min_stake, max_stake, is_active)
values ('Snakes & Ladders', 'snakes-ladders', 50, 100000, true)
on conflict (slug) do nothing;
