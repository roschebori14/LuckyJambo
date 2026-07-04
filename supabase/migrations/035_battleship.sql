-- Lucky Jambo - Battleship (Phase 10)
--
-- Battleship is different from every other game on the platform in one
-- important way: it has HIDDEN information. Chess/draughts/tic-tac-toe
-- board state is fully public to both players, so it's safe to store
-- it in matches.game_state (which both participants can select
-- directly). Ship positions are NOT safe to store there - if they sat
-- in game_state, either player could just read the raw API response
-- (or query the row themselves) and see exactly where every enemy ship
-- is, defeating the entire game.
--
-- So ship layouts live in their own table (battleship_ships) with RLS
-- enabled and NO policies granted to anon/authenticated at all - every
-- single read and write goes through SECURITY DEFINER functions below,
-- which run as the table owner and bypass RLS. The client only ever
-- learns: (a) its own ship positions (via get_my_battleship_ships,
-- which checks the caller owns them), and (b) hit/miss results on the
-- cells it has actually fired at (via matches.game_state, which is
-- safe to expose since it never contains unrevealed ship cells).
--
-- Grid: 8x8 (indices 0-63). Fleet: Carrier(4), Cruiser(3),
-- Destroyer(3), Patrol Boat(2) - 12 ship cells total, sized down from
-- the classic 10x10/17-cell fleet so a real-money match resolves in a
-- reasonable number of turns.

-- ---------------------------------------------------------------
-- Ship storage - deny-all RLS, SECURITY DEFINER functions only
-- ---------------------------------------------------------------
create table battleship_ships (
  match_id  uuid not null references matches(id) on delete cascade,
  user_id   uuid not null references profiles(id) on delete cascade,
  ship_name text not null,
  size      int not null,
  cells     int[] not null,
  sunk      boolean not null default false,
  primary key (match_id, user_id, ship_name)
);

alter table battleship_ships enable row level security;
-- Intentionally no policies. RLS enabled + zero policies = every
-- select/insert/update/delete is denied to anon and authenticated.

-- ---------------------------------------------------------------
-- Random, non-overlapping fleet placement. Internal helper only -
-- execute is revoked from every client-facing role below so it can
-- only ever be invoked from within create_match/join_match (which run
-- as the function owner, so the call succeeds regardless of the
-- revoke - the revoke only blocks direct RPC calls from a client).
-- ---------------------------------------------------------------
create or replace function public._place_battleship_fleet(
  p_match_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ships text[] := array['carrier', 'cruiser', 'destroyer', 'patrol_boat'];
  v_sizes int[]  := array[4, 3, 3, 2];
  v_occupied int[] := array[]::int[];
  v_cells int[];
  v_horizontal boolean;
  v_row int;
  v_col int;
  v_ok boolean;
  v_attempts int;
  i int;
begin
  for i in 1..array_length(v_ships, 1) loop
    v_ok := false;
    v_attempts := 0;

    while not v_ok and v_attempts < 300 loop
      v_attempts := v_attempts + 1;
      v_horizontal := random() < 0.5;

      if v_horizontal then
        v_row := floor(random() * 8)::int;
        v_col := floor(random() * (8 - v_sizes[i] + 1))::int;
        select array_agg(v_row * 8 + v_col + g) into v_cells
        from generate_series(0, v_sizes[i] - 1) g;
      else
        v_row := floor(random() * (8 - v_sizes[i] + 1))::int;
        v_col := floor(random() * 8)::int;
        select array_agg((v_row + g) * 8 + v_col) into v_cells
        from generate_series(0, v_sizes[i] - 1) g;
      end if;

      select not exists (
        select 1 from unnest(v_cells) c where c = any(v_occupied)
      ) into v_ok;
    end loop;

    if not v_ok then
      raise exception 'Could not place fleet - please try creating the match again';
    end if;

    v_occupied := v_occupied || v_cells;

    insert into battleship_ships (match_id, user_id, ship_name, size, cells, sunk)
    values (p_match_id, p_user_id, v_ships[i], v_sizes[i], v_cells, false);
  end loop;
end;
$$;

revoke execute on function public._place_battleship_fleet(uuid, uuid) from public;
revoke execute on function public._place_battleship_fleet(uuid, uuid) from anon;
revoke execute on function public._place_battleship_fleet(uuid, uuid) from authenticated;

-- ---------------------------------------------------------------
-- create_match / join_match - full redefinition (same convention as
-- migration 029) with a 'battleship' branch added to each.
-- Creator is seated as player_a and fires first once player_b joins.
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
-- Read my own fleet. Never returns the opponent's ships - checks the
-- caller is a participant, then only ever selects rows keyed to
-- auth.uid().
-- ---------------------------------------------------------------
create or replace function public.get_my_battleship_ships(p_match_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match matches%rowtype;
  v_result jsonb;
begin
  select * into v_match from matches where id = p_match_id;
  if not found then raise exception 'Match not found'; end if;

  if auth.uid() != nullif(v_match.game_state->>'player_a_id', '')::uuid
     and auth.uid() != nullif(v_match.game_state->>'player_b_id', '')::uuid then
    raise exception 'Not a participant';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'name', ship_name,
    'size', size,
    'cells', cells,
    'sunk', sunk
  )), '[]'::jsonb)
  into v_result
  from battleship_ships
  where match_id = p_match_id and user_id = auth.uid();

  return v_result;
end;
$$;

-- ---------------------------------------------------------------
-- Fire a shot. Fully server-authoritative: the client only ever sends
-- a cell index, hit/miss/sunk/turn/win are all computed here from the
-- locked-down ships table, so a tampered client can never see or
-- influence anything about ship placement.
-- ---------------------------------------------------------------
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
  v_ship record;
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

    select ship_name, cells into v_ship
    from battleship_ships
    where match_id = p_match_id and user_id = v_target_id and p_cell = any(cells);

    select bool_and(v_shots ? c::text) into v_all_hit
    from unnest(v_ship.cells) c;

    if v_all_hit then
      update battleship_ships set sunk = true
      where match_id = p_match_id and user_id = v_target_id and ship_name = v_ship.ship_name;
      v_sunk_ships := v_sunk_ships || to_jsonb(v_ship.ship_name);
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

  return jsonb_build_object('success', true, 'state', v_new_state, 'hit', v_is_hit, 'cell', p_cell, 'sunk_ship', v_ship.ship_name, 'ship_fully_sunk', coalesce(v_all_hit, false));
end;
$$;

revoke execute on function public.get_my_battleship_ships(uuid) from public;
revoke execute on function public.get_my_battleship_ships(uuid) from anon;
grant execute on function public.get_my_battleship_ships(uuid) to authenticated;

revoke execute on function public.submit_battleship_shot(uuid, int) from public;
revoke execute on function public.submit_battleship_shot(uuid, int) from anon;
grant execute on function public.submit_battleship_shot(uuid, int) to authenticated;

-- ---------------------------------------------------------------
-- Register the game
-- ---------------------------------------------------------------
insert into games (name, slug, min_stake, max_stake, is_active)
values ('Battleship', 'battleship', 50, 100000, true)
on conflict (slug) do nothing;
