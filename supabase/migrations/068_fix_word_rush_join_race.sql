-- Lucky Jambo - close the word-rush create/seed race in join_match
--
-- app/api/word-rush/create/route.ts does two sequential calls:
-- create_match (row created, status 'waiting', game_state.letters is
-- still the [] placeholder) then seed_word_rush_letters (overwrites
-- game_state with the real TS-generated scramble). In the brief
-- window between those two calls, the match already exists and is
-- joinable.
--
-- If an opponent's join_match lands in that window, it activates the
-- match (status -> 'active') using whatever game_state exists at that
-- instant - the still-empty placeholder, since join_match's word-rush
-- branch only touches b_player_id/round_started_at via jsonb_set and
-- has no reason to expect letters might not be there yet. The
-- creator's own seed_word_rush_letters call then finds
-- status != 'waiting' and raises its own guard exception ("Letters
-- can only be seeded before an opponent joins"), which the create
-- route surfaces as a failed match creation on the creator's screen -
-- but the match is already live and joined on the opponent's side,
-- permanently stuck with an empty letters array. Nothing ever retries
-- the seed after that point.
--
-- Fix: join_match now refuses to activate a word-rush match whose
-- letters haven't been seeded yet, so a same-instant join fails
-- cleanly (and retriably a moment later) instead of succeeding into a
-- match nothing can ever fix. This is the same "fail loudly rather
-- than silently produce something broken" principle 059 already
-- established for unknown slugs, just applied to this narrower race.

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
