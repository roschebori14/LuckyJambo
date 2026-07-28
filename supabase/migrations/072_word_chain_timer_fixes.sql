-- Lucky Jambo - Word Chain timer hardening
--
-- 1. apply_word_chain_move_result rejects moves after the turn deadline
--    (DB-authoritative, same clock as apply_word_chain_timeout).
-- 2. apply_word_chain_timeout uses <= for the "not yet expired" guard
--    so boundary behavior matches the move rejection check.

drop function if exists public.apply_word_chain_timeout(uuid);
drop function if exists public.apply_word_chain_move_result(uuid, jsonb, jsonb, text, text, int, int, text, boolean);

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
  v_turn_started_at timestamptz;
begin
  select * into v_match from matches where id = p_match_id for update;
  if not found then raise exception 'Match not found'; end if;
  if v_match.status != 'active' then raise exception 'Match is not active'; end if;

  v_state := v_match.game_state;
  v_a := (v_state->>'a_player_id')::uuid;
  v_b := nullif(v_state->>'b_player_id', '')::uuid;
  v_current_turn := v_state->>'current_turn';
  v_turn_seconds := coalesce((v_state->>'turn_seconds')::int, 20);
  v_turn_started_at := (v_state->>'turn_started_at')::timestamptz;

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

  if v_turn_started_at is not null
     and now() >= v_turn_started_at + (v_turn_seconds || ' seconds')::interval then
    raise exception 'Your turn timed out';
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
     or now() <= v_turn_started_at + (v_turn_seconds || ' seconds')::interval then
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

revoke execute on function public.apply_word_chain_move_result(uuid, jsonb, jsonb, text, text, int, int, text, boolean) from public;
revoke execute on function public.apply_word_chain_move_result(uuid, jsonb, jsonb, text, text, int, int, text, boolean) from anon;
grant execute on function public.apply_word_chain_move_result(uuid, jsonb, jsonb, text, text, int, int, text, boolean) to authenticated;

revoke execute on function public.apply_word_chain_timeout(uuid) from public;
revoke execute on function public.apply_word_chain_timeout(uuid) from anon;
grant execute on function public.apply_word_chain_timeout(uuid) to authenticated;
