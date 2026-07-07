-- Lucky Jambo - fix "column reference \"i\" is ambiguous" on every dice roll
--
-- roll_ludo_dice declares a plpgsql variable named `i` (used later as
-- the plain `for i in 0..3 loop` counter) and then, earlier in the
-- function, ALSO used `i` as the column alias for
-- `generate_series(0, v_seat_count - 1) i`:
--
--   select i into v_my_seat from generate_series(0, v_seat_count - 1) i
--   where v_seats->i->>'user_id' = auth.uid()::text;
--
-- Postgres can't tell whether `i` in the select-list/where-clause means
-- the generate_series column or the plpgsql variable of the same name,
-- so it raises "column reference \"i\" is ambiguous" and every roll
-- request fails with a 400. Fix: rename the throwaway FROM-clause alias
-- to something that doesn't collide with the declared variable (the
-- loop further down keeps using `i` as before - that's a plain integer
-- FOR loop, not a query, so it was never actually part of the bug).

create or replace function public.roll_ludo_dice(
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
  v_seats jsonb;
  v_my_seat int;
  v_seat_count int;
  v_roll int;
  v_tokens jsonb;
  v_my_tokens jsonb;
  v_movable int[] := '{}';
  v_pos int;
  i int;
  v_next_seat int;
begin
  select * into v_match from matches where id = p_match_id for update;
  if not found then raise exception 'Match not found'; end if;
  if v_match.status != 'active' then raise exception 'Match is not active'; end if;

  v_state := v_match.game_state;
  if v_state->>'game_type' != 'ludo' then raise exception 'Not a Ludo match'; end if;
  if coalesce((v_state->>'game_over')::boolean, false) then raise exception 'This match has already ended'; end if;
  if coalesce((v_state->>'awaiting_move')::boolean, false) then raise exception 'Resolve the current roll first'; end if;

  v_seats := v_state->'seats';
  v_seat_count := v_match.max_players;

  select gs into v_my_seat from generate_series(0, v_seat_count - 1) gs
  where v_seats->gs->>'user_id' = auth.uid()::text;

  if v_my_seat is null then raise exception 'Not a participant'; end if;
  if (v_state->>'current_seat')::int != v_my_seat then raise exception 'Not your turn'; end if;

  v_roll := floor(random() * 6 + 1)::int;
  v_tokens := v_state->'tokens';
  v_my_tokens := v_tokens->v_my_seat;

  for i in 0..3 loop
    v_pos := (v_my_tokens->>i)::int;
    if v_pos = -1 then
      if v_roll = 6 then v_movable := array_append(v_movable, i); end if;
    elsif v_pos + v_roll <= 57 then
      v_movable := array_append(v_movable, i);
    end if;
  end loop;

  if array_length(v_movable, 1) is null then
    -- Nothing legal to play - pass the turn immediately, same as a
    -- real Ludo player forfeiting a dead roll.
    v_next_seat := public._ludo_next_seat(v_seats, v_my_seat, v_seat_count);
    update matches set game_state = v_state || jsonb_build_object(
      'dice_value', v_roll,
      'awaiting_move', false,
      'movable_tokens', '[]'::jsonb,
      'current_seat', v_next_seat,
      'consecutive_sixes', 0
    ) where id = p_match_id;

    return jsonb_build_object('success', true, 'roll', v_roll, 'movable_tokens', '[]'::jsonb, 'passed', true);
  end if;

  update matches set game_state = v_state || jsonb_build_object(
    'dice_value', v_roll,
    'awaiting_move', true,
    'movable_tokens', to_jsonb(v_movable)
  ) where id = p_match_id;

  return jsonb_build_object('success', true, 'roll', v_roll, 'movable_tokens', to_jsonb(v_movable), 'passed', false);
end;
$$;
