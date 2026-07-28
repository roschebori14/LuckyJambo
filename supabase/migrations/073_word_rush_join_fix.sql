-- Lucky Jambo - Fix Word Rush join failures
--
-- ROOT CAUSE
-- supabase/migrations/word rush fix.sql runs AFTER 071 (lexicographic
-- order: "word..." > "072_...") and overwrites join_match with a
-- word-rush branch that calls public._generate_word_rush_letters(),
-- which was never defined in any numbered migration. Every join then
-- fails with "function ... does not exist".
--
-- That same file also reverted create_match's word-rush game_state to
-- the wrong field names (found_words_a/score_a instead of
-- a_found_words/a_score), breaking the TS engine and RPCs.
--
-- FIX
--   1. Re-assert join_match from 068/071 (letters-seeded guard, no
--      missing helper).
--   2. Re-assert seed_word_rush_letters from 067.
--   3. Add create_word_rush_match so create + letter seed happen in
--      one transaction (no joinable-but-unseeded window).
--   4. Cancel + refund word-rush waiting matches stuck with empty
--      letters (unjoinable orphans from the broken deploy).

-- ---------------------------------------------------------------
-- 1. Cancel unjoinable word-rush waiting matches (empty letters)
-- ---------------------------------------------------------------
do $$
declare
  v_match record;
begin
  for v_match in
    select m.*
    from matches m
    join games g on g.id = m.game_id
    where g.slug = 'word-rush'
      and m.status = 'waiting'
      and coalesce(jsonb_array_length(m.game_state->'letters'), 0) = 0
  loop
    update matches set status = 'cancelled' where id = v_match.id;

    perform public.apply_wallet_transaction(
      v_match.creator_id,
      'refund',
      v_match.stake_amount,
      v_match.id::text,
      'Refund for unjoinable word-rush match (letters never seeded)'
    );
  end loop;
end;
$$;

-- ---------------------------------------------------------------
-- 2. Atomic word-rush create: create_match + seed in one RPC
-- ---------------------------------------------------------------
create or replace function public.create_word_rush_match(
  p_stake_amount numeric,
  p_state jsonb,
  p_invited_user_id uuid default null
)
returns matches
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match matches%rowtype;
begin
  if coalesce(jsonb_array_length(p_state->'letters'), 0) = 0 then
    raise exception 'Word rush state must include seeded letters';
  end if;

  v_match := public.create_match('word-rush', p_stake_amount, p_invited_user_id);

  update matches
  set game_state = p_state
  where id = v_match.id
    and creator_id = auth.uid()
    and status = 'waiting';

  select * into v_match from matches where id = v_match.id;
  return v_match;
end;
$$;

revoke execute on function public.create_word_rush_match(numeric, jsonb, uuid) from public;
revoke execute on function public.create_word_rush_match(numeric, jsonb, uuid) from anon;
grant execute on function public.create_word_rush_match(numeric, jsonb, uuid) to authenticated;

-- ---------------------------------------------------------------
-- 3. seed_word_rush_letters (067) - kept for backwards compat
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

-- ---------------------------------------------------------------
-- 4. join_match (068/071) - correct word-rush branch, no missing fn
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

  if v_game_slug = 'word-rush'
     and coalesce(jsonb_array_length(v_match.game_state->'letters'), 0) = 0 then
    raise exception 'This match is still being set up - please try joining again in a moment';
  end if;

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

grant execute on function public.join_match(uuid) to authenticated;
