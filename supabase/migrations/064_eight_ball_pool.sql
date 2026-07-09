-- Lucky Jambo - 8-Ball Pool (2D, Phaser + Matter.js)
--
-- Standard 2-player game - uses the existing generic create_match /
-- join_match / resign_match / settle_match, exactly like every other
-- 2-player game (only Ludo needed its own lobby functions, because it
-- supports 3-4 seats). Only a persistence RPC is added here, same
-- split as every game since Four in a Row: lib/games/pool/engine.ts
-- validates a submitted shot's outcome (whose turn, was it a foul,
-- did the 8-ball go in legally) headlessly in
-- app/api/pool/shot/route.ts, and this RPC just persists the result
-- atomically with an optimistic-concurrency check, then settles the
-- match if the shot ended the game.
--
-- IMPORTANT - what this does and doesn't verify: the actual ball
-- physics (cue angle/power, collisions, where every ball ends up)
-- runs client-side in Matter.js for real-time feel - there is no
-- server-side physics replay to independently re-derive "did that
-- shot really happen." The engine only validates the *outcome* a
-- client reports is internally consistent and legal: final ball
-- positions are within the table and non-overlapping, pocketed balls
-- are actually near a pocket, the first ball contacted is legal for
-- the current turn/assignment, and turn/foul/win logic follows from
-- that. A sufficiently motivated cheat could still misreport ball
-- positions in ways that pass these checks. Full trajectory replay
-- (re-running the same physics step-for-step server-side) would close
-- that gap but is real additional work, deliberately out of scope for
-- this pass - flagged here rather than silently pretended away.

create or replace function public.apply_pool_shot_result(
  p_match_id uuid,
  p_expected_updated_at timestamptz,
  p_new_state jsonb,
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
  v_winner_id uuid;
begin
  select * into v_match from matches where id = p_match_id for update;
  if not found then raise exception 'Match not found'; end if;
  if v_match.status != 'active' then raise exception 'Match is not active'; end if;

  v_state := v_match.game_state;
  v_a := (v_state->>'a_player_id')::uuid;
  v_b := nullif(v_state->>'b_player_id', '')::uuid;
  v_current_turn := v_state->>'current_turn';

  if auth.uid() != v_a and auth.uid() != v_b then
    raise exception 'Not a participant';
  end if;

  v_mover_id := case when v_current_turn = 'A' then v_a else v_b end;
  if auth.uid() != v_mover_id then
    raise exception 'Not your turn';
  end if;

  -- Optimistic concurrency: refuse a shot submitted against a stale
  -- view of the table (e.g. a duplicate/replayed request).
  if v_match.updated_at != p_expected_updated_at then
    raise exception 'Match state has changed - please refresh and retry';
  end if;

  update matches set game_state = p_new_state where id = p_match_id;

  if p_game_over then
    v_winner_id := case when p_winner = 'A' then v_a else v_b end;
    perform public.settle_match(p_match_id, v_winner_id);
  end if;

  return jsonb_build_object('success', true, 'game_state', p_new_state);
end;
$$;

revoke execute on function public.apply_pool_shot_result(uuid, timestamptz, jsonb, text, boolean) from public;
revoke execute on function public.apply_pool_shot_result(uuid, timestamptz, jsonb, text, boolean) from anon;
grant execute on function public.apply_pool_shot_result(uuid, timestamptz, jsonb, text, boolean) to authenticated;

insert into games (name, slug, min_stake, max_stake, is_active)
values ('8-Ball Pool', 'eight-ball-pool', 50, 100000, true)
on conflict (slug) do nothing;
