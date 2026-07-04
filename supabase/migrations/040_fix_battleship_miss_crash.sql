-- Lucky Jambo - Fix battleship crash on a miss
--
-- Bug: submit_battleship_shot declared `v_ship battleship_ships%rowtype`
-- (well, an untyped `record`) and only ever populated it inside the
-- `if v_is_hit then ... end if;` branch. On a MISS, that select never
-- runs, so v_ship is left completely unassigned. The final `return`
-- statement at the bottom of the function unconditionally reads
-- `v_ship.ship_name` to build the `sunk_ship` field of the response -
-- and reading a field off a record that was never assigned raises
-- "record \"v_ship\" is not assigned yet" in plpgsql, regardless of
-- whether the value is actually needed. That's exactly the crash
-- reported when a player fires at an empty cell.
--
-- Fix: stop using a bare `record` for this. Two plain, always-defined
-- scalars (v_ship_name text, v_ship_cells int[]) default to NULL when
-- unassigned instead of erroring, which is exactly the behavior we
-- want on a miss (no ship, so sunk_ship should just come back null).

create or replace function public.submit_battleship_shot(
  p_match_id uuid,
  p_cell int
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match matches%rowtype;
  v_state jsonb;
  v_player_a uuid;
  v_player_b uuid;
  v_current_turn uuid;
  v_grid_size int;
  v_target_id uuid;
  v_shots_key text;
  v_sunk_key text;
  v_alive_key text;
  v_shots jsonb;
  v_sunk_ships jsonb;
  v_ships_alive int;
  v_is_hit boolean;
  v_ship_name text;
  v_ship_cells int[];
  v_all_hit boolean;
  v_game_over boolean := false;
  v_new_state jsonb;
begin
  select * into v_match from matches where id = p_match_id for update;
  if not found then raise exception 'Match not found'; end if;
  if v_match.status != 'active' then raise exception 'Match is not active'; end if;

  v_state := v_match.game_state;
  if v_state->>'game_type' != 'battleship' then
    raise exception 'Not a battleship match';
  end if;

  v_player_a := nullif(v_state->>'player_a_id', '')::uuid;
  v_player_b := nullif(v_state->>'player_b_id', '')::uuid;
  v_current_turn := nullif(v_state->>'current_turn', '')::uuid;
  v_grid_size := (v_state->>'grid_size')::int;

  if auth.uid() != v_player_a and auth.uid() != v_player_b then
    raise exception 'Not a participant';
  end if;

  if v_current_turn is null or auth.uid() != v_current_turn then
    raise exception 'Not your turn';
  end if;

  if p_cell < 0 or p_cell >= v_grid_size * v_grid_size then
    raise exception 'Invalid cell';
  end if;

  if auth.uid() = v_player_a then
    v_target_id := v_player_b;
    v_shots_key := 'shots_on_b';
    v_sunk_key := 'sunk_ships_b';
    v_alive_key := 'ships_alive_b';
  else
    v_target_id := v_player_a;
    v_shots_key := 'shots_on_a';
    v_sunk_key := 'sunk_ships_a';
    v_alive_key := 'ships_alive_a';
  end if;

  v_shots := coalesce(v_state->v_shots_key, '{}'::jsonb);
  if v_shots ? p_cell::text then
    raise exception 'That cell has already been targeted';
  end if;

  select exists (
    select 1 from battleship_ships
    where match_id = p_match_id and user_id = v_target_id and p_cell = any(cells)
  ) into v_is_hit;

  v_shots := v_shots || jsonb_build_object(p_cell::text, case when v_is_hit then 'hit' else 'miss' end);
  v_sunk_ships := coalesce(v_state->v_sunk_key, '[]'::jsonb);
  v_ships_alive := coalesce((v_state->>v_alive_key)::int, 0);

  if v_is_hit then
    v_ships_alive := v_ships_alive - 1;

    select ship_name, cells into v_ship_name, v_ship_cells
    from battleship_ships
    where match_id = p_match_id and user_id = v_target_id and p_cell = any(cells);

    select bool_and(v_shots ? c::text) into v_all_hit
    from unnest(v_ship_cells) c;

    if v_all_hit then
      update battleship_ships set sunk = true
      where match_id = p_match_id and user_id = v_target_id and ship_name = v_ship_name;
      v_sunk_ships := v_sunk_ships || to_jsonb(v_ship_name);
    end if;
  end if;

  v_game_over := v_ships_alive <= 0;

  v_new_state := v_state
    || jsonb_build_object(v_shots_key, v_shots)
    || jsonb_build_object(v_sunk_key, v_sunk_ships)
    || jsonb_build_object(v_alive_key, v_ships_alive)
    || jsonb_build_object('current_turn', case when v_game_over then 'null'::jsonb else to_jsonb(v_target_id::text) end)
    || jsonb_build_object('game_over', v_game_over)
    || jsonb_build_object('winner_id', case when v_game_over then to_jsonb(auth.uid()::text) else 'null'::jsonb end);

  update matches set game_state = v_new_state where id = p_match_id;

  if v_game_over then
    perform public.settle_match(p_match_id, auth.uid());
  end if;

  -- v_ship_name/v_all_hit are simply NULL on a miss (never assigned
  -- above), which coalesce() and a plain NULL jsonb field both handle
  -- fine - no more "record not assigned" crash.
  return jsonb_build_object(
    'success', true,
    'state', v_new_state,
    'hit', v_is_hit,
    'cell', p_cell,
    'sunk_ship', v_ship_name,
    'ship_fully_sunk', coalesce(v_all_hit, false)
  );
end;
$$;
