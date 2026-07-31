import re

def main():
    # Read 071 for create_match
    with open('supabase/migrations/071_repair_join_and_wallets.sql', 'r') as f:
        content_071 = f.read()

    create_match_start = content_071.find('create or replace function public.create_match(')
    # create_match ends with 'end;\n$$;' followed by the comment for join_match
    create_match_end = content_071.find('$$;', create_match_start) + 3
    create_match_sql = content_071[create_match_start:create_match_end]

    # Add archery to create_match
    archery_create_state = """    when 'archery' then jsonb_build_object(
      'game_type', 'archery',
      'a_player_id', auth.uid(),
      'b_player_id', null,
      'current_turn', 'A',
      'round', 1,
      'a_score', 0,
      'b_score', 0,
      'a_shots', '[]'::jsonb,
      'b_shots', '[]'::jsonb,
      'wind_x', 0,
      'wind_y', 0,
      'target_dist', 1,
      'winner', null,
      'game_over', false
    )
"""
    create_match_sql = create_match_sql.replace("when 'word-rush' then jsonb_build_object(", archery_create_state + "      when 'word-rush' then jsonb_build_object(")

    # Read 073 for join_match
    with open('supabase/migrations/073_word_rush_join_fix.sql', 'r') as f:
        content_073 = f.read()
        
    join_match_start = content_073.find('create or replace function public.join_match(')
    join_match_end = content_073.find('$$;', join_match_start) + 3
    join_match_sql = content_073[join_match_start:join_match_end]

    archery_join_state = """      when 'archery' then jsonb_set(coalesce(game_state, '{}'::jsonb), '{b_player_id}', to_jsonb(auth.uid()::text))
"""
    join_match_sql = join_match_sql.replace("when 'word-rush' then jsonb_set(", archery_join_state + "      when 'word-rush' then jsonb_set(")

    # New RPCs and games insert
    apply_shot_rpc = """
create or replace function public.apply_archery_shot_result(
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

  if v_match.updated_at != p_expected_updated_at then
    raise exception 'Match state has changed - please refresh and retry';
  end if;

  update matches set game_state = p_new_state where id = p_match_id;

  if p_game_over then
    v_winner_id := case when p_winner = 'A' then v_a when p_winner = 'B' then v_b else null end;
    
    if v_winner_id is not null then
      perform public.settle_match(p_match_id, v_winner_id);
    else
      -- Usually we can pass null to settle_match for a draw
      perform public.settle_match(p_match_id, null);
    end if;
  end if;

  return jsonb_build_object('success', true, 'game_state', p_new_state);
end;
$$;

revoke execute on function public.apply_archery_shot_result(uuid, timestamptz, jsonb, text, boolean) from public;
revoke execute on function public.apply_archery_shot_result(uuid, timestamptz, jsonb, text, boolean) from anon;
grant execute on function public.apply_archery_shot_result(uuid, timestamptz, jsonb, text, boolean) to authenticated;
"""

    insert_game = """
insert into games (name, slug, min_stake, max_stake, is_active)
values ('Archery', 'archery', 50, 100000, true)
on conflict (slug) do nothing;
"""

    with open('supabase/migrations/074_archery.sql', 'w') as f:
        f.write("-- Lucky Jambo - Archery\n\n")
        f.write(create_match_sql)
        f.write("\n\n")
        f.write("revoke execute on function public.create_match(text, numeric, uuid) from public;\nrevoke execute on function public.create_match(text, numeric, uuid) from anon;\ngrant execute on function public.create_match(text, numeric, uuid) to authenticated;\n")
        f.write("\n\n")
        f.write(join_match_sql)
        f.write("\n\n")
        f.write("grant execute on function public.join_match(uuid) to authenticated;\n")
        f.write("\n\n")
        f.write(apply_shot_rpc)
        f.write("\n\n")
        f.write(insert_game)

if __name__ == '__main__':
    main()
