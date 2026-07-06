-- Lucky Jambo - Ludo fixes (Part 1 items 2 & an extra money-correctness bug)
--
-- Bug found while building forfeit (not in the original task list, but
-- directly touches the same settlement path): create_ludo_match sets
-- total_pot = stake_amount * p_max_players at CREATE time, before
-- anyone but the creator has actually joined/staked. start_ludo_match
-- lets the creator start with as few as 2 of e.g. 4 seats filled - in
-- that case only 2 stakes were ever actually collected, but
-- settle_multiplayer_match paid out total_pot as if 4 were. That's a
-- real overpay (the platform eats the difference) whenever a match
-- starts early with fewer than max_players. Fixed by having
-- settle_multiplayer_match compute the pot from the actual number of
-- participants who staked, not the stored (possibly stale) total_pot.

create or replace function public.settle_multiplayer_match(
  p_match_id uuid,
  p_winner_id uuid
)
returns matches
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match matches%rowtype;
  v_participants uuid[];
  v_fee_percent numeric;
  v_actual_pot numeric;
  v_commission numeric;
  v_net_payout numeric;
  v_loser_id uuid;
  v_sorted uuid[];
begin
  select * into v_match from matches where id = p_match_id for update;
  if not found then raise exception 'Match not found'; end if;
  if v_match.status != 'active' then raise exception 'Match is not active'; end if;

  select array_agg(user_id) into v_participants from match_participants where match_id = p_match_id;
  if array_length(v_participants, 1) < 2 then
    raise exception 'Match does not have enough participants to settle';
  end if;
  if not (p_winner_id = any(v_participants)) then
    raise exception 'Winner must be a match participant';
  end if;

  select array_agg(x order by x) into v_sorted from unnest(v_participants) x;
  for v_loser_id in select unnest(v_sorted) loop
    perform 1 from wallets where user_id = v_loser_id for update;
  end loop;

  -- Actual pot = stake * however many people really staked, not the
  -- max_players-based figure stored at creation - see bug note above.
  v_actual_pot := v_match.stake_amount * array_length(v_participants, 1);

  select coalesce(value::numeric, 5) into v_fee_percent from settings where key = 'platform_fee_percent';
  v_commission := round(v_actual_pot * v_fee_percent / 100, 2);
  v_net_payout := v_actual_pot - v_commission;

  foreach v_loser_id in array v_participants loop
    if v_loser_id != p_winner_id then
      perform public.apply_wallet_transaction(
        v_loser_id, 'match_loss', v_match.stake_amount, p_match_id::text, 'Lost match'
      );
      perform public.notify_user(v_loser_id, 'Match result', 'You lost this match. Better luck next time!');
    end if;
  end loop;

  update wallets set locked_balance = locked_balance - v_match.stake_amount, updated_at = now()
  where user_id = p_winner_id;

  perform public.apply_wallet_transaction(
    p_winner_id, 'match_win', v_net_payout, p_match_id::text,
    'Won match (pool ' || v_actual_pot || ', commission ' || v_commission || ')'
  );

  update matches
  set status = 'completed', winner_id = p_winner_id, commission_amount = v_commission, total_pot = v_actual_pot
  where id = p_match_id
  returning * into v_match;

  perform public.notify_user(p_winner_id, 'You won! 🏆', 'You won ' || v_net_payout || ' XAF. Funds added to your wallet.');

  return v_match;
end;
$$;

-- ---------------------------------------------------------------
-- Voluntary forfeit. Unlike pass_ludo_turn (idle-only, doesn't
-- eliminate anyone), this lets a player quit outright at any time:
-- their stake is NOT refunded (this is a quit, not a cancellation -
-- matches resign_match's convention for every other game), their seat
-- is cleared so _ludo_next_seat's null-seat check skips them
-- permanently, and their live tokens are pulled off the board. If only
-- one seat remains after the forfeit, that player wins by default and
-- the match settles immediately - a 1-seat "active" match nobody could
-- ever finish would otherwise leave the remaining player's funds
-- locked forever.
-- ---------------------------------------------------------------

create or replace function public.forfeit_ludo_seat(
  p_match_id uuid
)
returns matches
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match matches%rowtype;
  v_state jsonb;
  v_seats jsonb;
  v_tokens jsonb;
  v_my_seat int;
  v_seat_count int;
  v_remaining_count int;
  v_sole_survivor_seat int;
  v_next_seat int;
begin
  select * into v_match from matches where id = p_match_id for update;
  if not found then raise exception 'Match not found'; end if;
  if v_match.status != 'active' then raise exception 'Match is not active'; end if;

  v_state := v_match.game_state;
  if v_state->>'game_type' != 'ludo' then raise exception 'Not a Ludo match'; end if;
  if coalesce((v_state->>'game_over')::boolean, false) then raise exception 'This match has already ended'; end if;

  v_seats := v_state->'seats';
  v_seat_count := v_match.max_players;

  select i into v_my_seat from generate_series(0, v_seat_count - 1) i
  where v_seats->i->>'user_id' = auth.uid()::text;
  if v_my_seat is null then raise exception 'Not a participant'; end if;

  v_tokens := jsonb_set(v_state->'tokens', array[v_my_seat::text], jsonb_build_array(-1, -1, -1, -1));
  v_seats := jsonb_set(v_seats, array[v_my_seat::text], 'null'::jsonb);

  select count(*) into v_remaining_count from jsonb_array_elements(v_seats) s where s != 'null'::jsonb;

  if v_remaining_count < 1 then
    raise exception 'Cannot forfeit - no other players remain';
  elsif v_remaining_count = 1 then
    select i into v_sole_survivor_seat from generate_series(0, v_seat_count - 1) i
    where v_seats->i is distinct from 'null'::jsonb;

    v_state := v_state || jsonb_build_object(
      'seats', v_seats, 'tokens', v_tokens, 'game_over', true,
      'winner_seat', v_sole_survivor_seat, 'awaiting_move', false,
      'movable_tokens', '[]'::jsonb, 'dice_value', null
    );
    update matches set game_state = v_state where id = p_match_id;

    perform public.settle_multiplayer_match(p_match_id, (v_seats->v_sole_survivor_seat->>'user_id')::uuid);
  else
    if (v_state->>'current_seat')::int = v_my_seat then
      v_next_seat := public._ludo_next_seat(v_seats, v_my_seat, v_seat_count);
    else
      v_next_seat := (v_state->>'current_seat')::int;
    end if;

    v_state := v_state || jsonb_build_object(
      'seats', v_seats, 'tokens', v_tokens, 'current_seat', v_next_seat,
      'awaiting_move', false, 'movable_tokens', '[]'::jsonb, 'dice_value', null,
      'consecutive_sixes', 0
    );
    update matches set game_state = v_state where id = p_match_id;
  end if;

  select * into v_match from matches where id = p_match_id;
  return v_match;
end;
$$;

revoke execute on function public.forfeit_ludo_seat(uuid) from public, anon;
grant execute on function public.forfeit_ludo_seat(uuid) to authenticated;
