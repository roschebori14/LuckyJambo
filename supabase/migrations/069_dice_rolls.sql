-- Lucky Jambo - Upgrade submit_instant_move for Dice Duel
--
-- Expose the actual dice values rolled during a dice duel so the frontend
-- can display them in a 3D animation, instead of just the binary won/lost outcome.

create or replace function public.submit_instant_move(
  p_match_id uuid,
  p_move text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match matches%rowtype;
  v_participants uuid[];
  v_opponent_id uuid;
  v_opponent_move text;
  v_result jsonb;
  v_winner_id uuid;
  v_game_type text;
  v_my_roll int;
  v_opp_roll int;
begin
  select * into v_match from matches where id = p_match_id for update;
  if not found then raise exception 'Match not found'; end if;
  if v_match.status != 'active' then raise exception 'Match is not active'; end if;

  select array_agg(user_id) into v_participants
  from match_participants where match_id = p_match_id;

  if not (auth.uid() = any(v_participants)) then
    raise exception 'Not a participant';
  end if;

  v_game_type := v_match.game_state->>'game_type';

  if v_game_type = 'rock_paper_scissors' then
    if p_move not in ('rock','paper','scissors') then
      raise exception 'Move must be rock, paper, or scissors';
    end if;
  elsif v_game_type = 'coin_flip' then
    if p_move not in ('heads','tails') then
      raise exception 'Move must be heads or tails';
    end if;
  elsif v_game_type = 'dice_duel' then
    null;
  else
    raise exception 'Unsupported game type %', v_game_type;
  end if;

  insert into match_moves (match_id, user_id, move)
  values (p_match_id, auth.uid(), p_move)
  on conflict (match_id, user_id) do nothing;

  v_opponent_id := (
    select user_id from unnest(v_participants) as user_id where user_id != auth.uid()
  );

  select move into v_opponent_move
  from match_moves where match_id = p_match_id and user_id = v_opponent_id;

  if v_opponent_move is null then
    return jsonb_build_object('status', 'waiting', 'message', 'Waiting for opponent');
  end if;

  if v_game_type = 'rock_paper_scissors' then
    declare
      v_my_move text := (select move from match_moves where match_id = p_match_id and user_id = auth.uid());
    begin
      if v_my_move = v_opponent_move then
        perform public.apply_wallet_transaction(auth.uid(), 'refund', v_match.stake_amount, p_match_id::text, 'RPS draw');
        perform public.apply_wallet_transaction(v_opponent_id, 'refund', v_match.stake_amount, p_match_id::text, 'RPS draw');
        update matches set status = 'completed', game_state = game_state || '{"outcome":"draw"}'::jsonb where id = p_match_id;
        return jsonb_build_object('status', 'draw', 'my_move', v_my_move, 'opponent_move', v_opponent_move);
      end if;

      v_winner_id := case
        when (v_my_move='rock'     and v_opponent_move='scissors')
          or (v_my_move='paper'    and v_opponent_move='rock')
          or (v_my_move='scissors' and v_opponent_move='paper')
        then auth.uid()
        else v_opponent_id
      end;
    end;

  elsif v_game_type = 'coin_flip' then
    declare
      v_flip text := case when random() < 0.5 then 'heads' else 'tails' end;
      v_my_move text := (select move from match_moves where match_id = p_match_id and user_id = auth.uid());
      v_my_correct boolean := v_my_move = v_flip;
      v_opp_correct boolean := v_opponent_move = v_flip;
    begin
      if v_my_correct and not v_opp_correct then
        v_winner_id := auth.uid();
      elsif v_opp_correct and not v_my_correct then
        v_winner_id := v_opponent_id;
      else
        v_winner_id := case when random() < 0.5 then auth.uid() else v_opponent_id end;
      end if;
    end;

  elsif v_game_type = 'dice_duel' then
    loop
      v_my_roll  := floor(random() * 6 + 1)::int;
      v_opp_roll := floor(random() * 6 + 1)::int;
      exit when v_my_roll != v_opp_roll;
    end loop;
    v_winner_id := case when v_my_roll > v_opp_roll then auth.uid() else v_opponent_id end;
  end if;

  perform public.settle_match(p_match_id, v_winner_id);

  v_result := jsonb_build_object(
    'status', 'resolved',
    'winner_id', v_winner_id,
    'you_won', v_winner_id = auth.uid()
  );

  if v_game_type = 'dice_duel' then
    v_result := v_result || jsonb_build_object('my_roll', v_my_roll, 'opp_roll', v_opp_roll);
  end if;

  return v_result;
end;
$$;
