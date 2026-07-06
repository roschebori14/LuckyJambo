-- Lucky Jambo - Ludo (2-4 players)
--
-- Every game before this one has exactly two seats and settle_match
-- assumes it (`if array_length(v_participants, 1) != 2 then raise
-- exception`). Ludo needs 2-4 seats and a payout that still works
-- when several people lose to one winner at once, so this migration:
--   1. Adds matches.max_players (default 2, so every existing game's
--      rows/behavior are untouched - only Ludo ever sets it above 2).
--   2. Adds settle_multiplayer_match: a NEW, separate function for
--      N-way settlement. It does not replace or touch settle_match -
--      every other game keeps using exactly what it used before this
--      migration.
--   3. Adds Ludo-only lobby RPCs (create_ludo_match / join_ludo_match /
--      start_ludo_match) rather than editing the shared create_match /
--      join_match functions every other game depends on - additive
--      only, zero blast radius on the other 10 games.
--   4. Adds the dice+move engine as two server-authoritative RPCs
--      (roll_ludo_dice, move_ludo_token), following the exact pattern
--      already used for Snakes & Ladders (038_snakes_and_ladders.sql):
--      the die roll happens with Postgres's own random() inside a
--      SECURITY DEFINER function, so there's nothing for a tampered
--      client to influence. Split into two calls (not one, unlike
--      Snakes & Ladders) because Ludo often has more than one legal
--      token to move for a given roll - the client needs to see the
--      roll and the set of legal tokens before choosing which to move.
--
-- Board model (relative-position, the standard approach used by every
-- digital Ludo implementation): each seat's 4 tokens are tracked as an
-- integer 0-57 *relative to that seat's own path*, not as an absolute
-- board square - this keeps the 4 colors symmetric and the SQL
-- color-agnostic.
--   -1       = in the yard (not yet in play)
--   0 - 50   = on the shared 52-square outer loop, counted from this
--              seat's own start square (so seat 0's relative-0 and
--              seat 1's relative-0 are different absolute squares)
--   51 - 56  = in this seat's private 6-square home column (no other
--              color's tokens or captures ever reach these squares)
--   57       = home / finished
-- Absolute square (for capture checks only, main loop squares only):
--   abs = (entry_offset[color] + relative) mod 52
-- Entry offsets (classic 4-arm cross board, arms 13 squares apart):
--   red=1, green=14, yellow=27, blue=40
-- Safe squares (no capture ever happens here - each color's own start
-- square plus one star square per arm): 1, 9, 14, 22, 27, 35, 40, 48.
--
-- Deliberate simplifications (flagged here the same way the round cap
-- is flagged in 038_snakes_and_ladders.sql, rather than silently
-- deviating from "real" Ludo):
--   - No blocking pairs: real Ludo forbids landing on a square already
--     holding 2+ of the same opponent color. Skipped for a first
--     version - any single opposing token on a landed-on unsafe square
--     is sent home, and if 2+ opposing tokens from *different* colors
--     happen to share a square, all are sent home. Same-color stacking
--     doesn't block movement here.
--   - Capturing doesn't grant a bonus roll (only rolling a 6 does).
--   - Three sixes in a row still completes the third move, then simply
--     passes the turn (real Ludo voids the whole turn instead) - this
--     avoids ever discarding a move the player already committed to.
--   - The match ends the instant one seat gets all 4 tokens home -
--     there's no 2nd/3rd/4th place payout split, matching every other
--     game on the platform (single winner takes the pot).

alter table matches
add column if not exists max_players int not null default 2;

-- ---------------------------------------------------------------
-- Fixed board layout lookups - not per-match data, so these are
-- immutable SQL functions rather than stored state, same convention
-- as _snakes_ladders_landing.
-- ---------------------------------------------------------------

create or replace function public._ludo_entry_offset(p_color text)
returns int
language sql
immutable
as $$
  select case p_color
    when 'red' then 1
    when 'green' then 14
    when 'yellow' then 27
    when 'blue' then 40
  end;
$$;

create or replace function public._ludo_abs_square(p_color text, p_relative int)
returns int
language sql
immutable
as $$
  -- Only meaningful for the shared outer loop (relative 0-50). Home
  -- column squares (51+) are private to their color and never
  -- participate in capture checks, so callers must guard that range
  -- themselves rather than relying on this to return null cleanly.
  select (public._ludo_entry_offset(p_color) + p_relative) % 52;
$$;

create or replace function public._ludo_is_safe_square(p_abs int)
returns boolean
language sql
immutable
as $$
  select p_abs in (1, 9, 14, 22, 27, 35, 40, 48);
$$;

revoke execute on function public._ludo_entry_offset(text) from public, anon, authenticated;
revoke execute on function public._ludo_abs_square(text, int) from public, anon, authenticated;
revoke execute on function public._ludo_is_safe_square(int) from public, anon, authenticated;

-- Next occupied seat after p_from, wrapping around - shared by the
-- roll-passes-with-no-moves case and the real move application below.
create or replace function public._ludo_next_seat(p_seats jsonb, p_from int, p_seat_count int)
returns int
language plpgsql
immutable
as $$
declare
  v_next int := p_from;
  i int;
begin
  for i in 1..p_seat_count loop
    v_next := (v_next + 1) % p_seat_count;
    if p_seats->v_next is distinct from 'null'::jsonb then
      return v_next;
    end if;
  end loop;
  return p_from; -- unreachable in practice (always >= 2 seated to be active)
end;
$$;

revoke execute on function public._ludo_next_seat(jsonb, int, int) from public, anon, authenticated;

-- ---------------------------------------------------------------
-- Lobby: create / join / start. Kept entirely separate from the
-- shared create_match/join_match so every other game is unaffected.
-- ---------------------------------------------------------------

create or replace function public.create_ludo_match(
  p_stake_amount numeric,
  p_max_players int,
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
  v_seats jsonb;
  v_tokens jsonb;
  v_challenger_username text;
begin
  select * into v_game from games where slug = 'ludo' and is_active = true;
  if not found then raise exception 'Ludo is not currently available'; end if;

  if p_stake_amount < v_game.min_stake or p_stake_amount > v_game.max_stake then
    raise exception 'Stake must be between % and %', v_game.min_stake, v_game.max_stake;
  end if;

  if p_max_players not in (2, 3, 4) then
    raise exception 'Ludo supports 2 to 4 players';
  end if;

  if p_invited_user_id is not null and p_invited_user_id = auth.uid() then
    raise exception 'You cannot challenge yourself';
  end if;

  perform public.apply_wallet_transaction(
    auth.uid(), 'match_stake', p_stake_amount, null, 'Stake for new Ludo match'
  );

  v_seats := jsonb_build_array(
    jsonb_build_object('user_id', auth.uid(), 'color', 'red'),
    null, null, null
  );
  v_tokens := jsonb_build_array(
    jsonb_build_array(-1, -1, -1, -1),
    jsonb_build_array(-1, -1, -1, -1),
    jsonb_build_array(-1, -1, -1, -1),
    jsonb_build_array(-1, -1, -1, -1)
  );

  insert into matches (game_id, creator_id, stake_amount, total_pot, status, invited_user_id, max_players, game_state)
  values (
    v_game.id, auth.uid(), p_stake_amount, p_stake_amount * p_max_players, 'waiting',
    p_invited_user_id, p_max_players,
    jsonb_build_object(
      'game_type', 'ludo',
      'max_players', p_max_players,
      'seats', v_seats,
      'tokens', v_tokens,
      'current_seat', 0,
      'dice_value', null,
      'awaiting_move', false,
      'movable_tokens', '[]'::jsonb,
      'consecutive_sixes', 0,
      'winner_seat', null,
      'game_over', false
    )
  )
  returning * into v_match;

  insert into match_participants (match_id, user_id) values (v_match.id, auth.uid());

  if p_invited_user_id is not null then
    select username into v_challenger_username from profiles where id = auth.uid();
    perform public.notify_user(
      p_invited_user_id, 'New Ludo challenge!',
      coalesce(v_challenger_username, 'Someone') || ' invited you to a ' || p_max_players ||
        '-player Ludo match for ' || p_stake_amount || ' XAF. Tap to join.'
    );
  end if;

  return v_match;
end;
$$;

create or replace function public.join_ludo_match(
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
  v_seat_index int;
  v_joined_count int;
  v_color text;
  v_colors text[] := array['red', 'green', 'yellow', 'blue'];
  v_joiner_username text;
begin
  select * into v_match from matches where id = p_match_id for update;
  if not found then raise exception 'Match not found'; end if;
  if v_match.status != 'waiting' then raise exception 'Match is no longer open'; end if;

  v_state := v_match.game_state;
  if v_state->>'game_type' != 'ludo' then raise exception 'Not a Ludo match'; end if;

  if v_match.creator_id = auth.uid() then raise exception 'You cannot join your own match'; end if;
  if v_match.invited_user_id is not null and v_match.invited_user_id != auth.uid() then
    raise exception 'This match is a private challenge for another player';
  end if;
  if exists (select 1 from match_participants where match_id = p_match_id and user_id = auth.uid()) then
    raise exception 'You have already joined this match';
  end if;

  v_seats := v_state->'seats';
  select count(*) into v_joined_count from jsonb_array_elements(v_seats) s where s != 'null'::jsonb;

  if v_joined_count >= v_match.max_players then
    raise exception 'This match is already full';
  end if;

  -- First open seat, in order - seat index doubles as color index.
  select min(i) into v_seat_index
  from generate_series(0, v_match.max_players - 1) i
  where v_seats->i = 'null'::jsonb;

  v_color := v_colors[v_seat_index + 1];

  perform public.apply_wallet_transaction(
    auth.uid(), 'match_stake', v_match.stake_amount, null, 'Stake to join Ludo match'
  );

  insert into match_participants (match_id, user_id) values (p_match_id, auth.uid());

  v_seats := jsonb_set(v_seats, array[v_seat_index::text], jsonb_build_object('user_id', auth.uid(), 'color', v_color));
  v_joined_count := v_joined_count + 1;

  update matches
  set
    status = case when v_joined_count >= v_match.max_players then 'active' else 'waiting' end,
    game_state = v_state || jsonb_build_object('seats', v_seats)
  where id = p_match_id
  returning * into v_match;

  select username into v_joiner_username from profiles where id = auth.uid();
  perform public.notify_user(
    v_match.creator_id, 'Ludo lobby update',
    coalesce(v_joiner_username, 'Someone') || ' joined your Ludo match (' || v_joined_count || '/' || v_match.max_players || ').'
  );

  return v_match;
end;
$$;

-- ---------------------------------------------------------------
-- Dice roll: server-generated, nothing for the client to tamper with.
-- Also computes which of the roller's tokens can legally move with
-- this roll (yard tokens need a 6; a token can't move past relative
-- 57), so the client only ever offers legal choices. If nothing can
-- move, the turn is passed immediately here - no separate "pass" call
-- needed.
-- ---------------------------------------------------------------

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

  select i into v_my_seat from generate_series(0, v_seat_count - 1) i
  where v_seats->i->>'user_id' = auth.uid()::text;

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

-- ---------------------------------------------------------------
-- Move application: re-validates the roll and the chosen token
-- server-side (never trusts movable_tokens purely from the client),
-- moves it, resolves captures, checks for a win, and settles the
-- match via settle_multiplayer_match if this seat just got all 4
-- tokens home.
-- ---------------------------------------------------------------

create or replace function public.move_ludo_token(
  p_match_id uuid,
  p_token_index int
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
  v_tokens jsonb;
  v_my_seat int;
  v_seat_count int;
  v_dice int;
  v_cur_pos int;
  v_new_pos int;
  v_abs int;
  v_home_count int;
  v_game_over boolean := false;
  v_winner_user uuid;
  v_next_seat int;
  v_next_sixes int;
  s int;
  t int;
  v_other_pos int;
begin
  select * into v_match from matches where id = p_match_id for update;
  if not found then raise exception 'Match not found'; end if;
  if v_match.status != 'active' then raise exception 'Match is not active'; end if;

  v_state := v_match.game_state;
  if v_state->>'game_type' != 'ludo' then raise exception 'Not a Ludo match'; end if;
  if not coalesce((v_state->>'awaiting_move')::boolean, false) then
    raise exception 'Roll the dice first';
  end if;

  v_seats := v_state->'seats';
  v_seat_count := v_match.max_players;

  select i into v_my_seat from generate_series(0, v_seat_count - 1) i
  where v_seats->i->>'user_id' = auth.uid()::text;

  if v_my_seat is null then raise exception 'Not a participant'; end if;
  if (v_state->>'current_seat')::int != v_my_seat then raise exception 'Not your turn'; end if;
  if p_token_index < 0 or p_token_index > 3 then raise exception 'Invalid token'; end if;
  if not (v_state->'movable_tokens' @> to_jsonb(p_token_index)) then
    raise exception 'That token cannot legally move with this roll';
  end if;

  v_dice := (v_state->>'dice_value')::int;
  v_tokens := v_state->'tokens';
  v_cur_pos := (v_tokens->v_my_seat->>p_token_index)::int;
  v_new_pos := case when v_cur_pos = -1 then 0 else v_cur_pos + v_dice end;

  -- Capture check: only on the shared outer loop (0-50), never in a
  -- home column, and never on a safe square.
  if v_new_pos between 0 and 50 then
    v_abs := public._ludo_abs_square(v_seats->v_my_seat->>'color', v_new_pos);
    if not public._ludo_is_safe_square(v_abs) then
      for s in 0..3 loop
        if s != v_my_seat and v_seats->s is distinct from 'null'::jsonb then
          for t in 0..3 loop
            v_other_pos := (v_tokens->s->>t)::int;
            if v_other_pos between 0 and 50
              and public._ludo_abs_square(v_seats->s->>'color', v_other_pos) = v_abs
            then
              v_tokens := jsonb_set(v_tokens, array[s::text, t::text], to_jsonb(-1));
            end if;
          end loop;
        end if;
      end loop;
    end if;
  end if;

  v_tokens := jsonb_set(v_tokens, array[v_my_seat::text, p_token_index::text], to_jsonb(v_new_pos));

  select count(*) into v_home_count
  from jsonb_array_elements(v_tokens->v_my_seat) tok
  where tok::int = 57;

  if v_home_count = 4 then
    v_game_over := true;
    v_winner_user := (v_seats->v_my_seat->>'user_id')::uuid;
    v_next_seat := v_my_seat; -- irrelevant once game_over, kept for a valid current_seat value
    v_next_sixes := 0;
  elsif v_dice = 6 and coalesce((v_state->>'consecutive_sixes')::int, 0) < 2 then
    -- Bonus roll, same seat goes again.
    v_next_seat := v_my_seat;
    v_next_sixes := coalesce((v_state->>'consecutive_sixes')::int, 0) + 1;
  else
    v_next_seat := public._ludo_next_seat(v_seats, v_my_seat, v_seat_count);
    v_next_sixes := 0;
  end if;

  v_state := v_state || jsonb_build_object(
    'tokens', v_tokens,
    'current_seat', v_next_seat,
    'dice_value', null,
    'awaiting_move', false,
    'movable_tokens', '[]'::jsonb,
    'consecutive_sixes', v_next_sixes,
    'game_over', v_game_over,
    'winner_seat', case when v_game_over then v_my_seat else null end
  );

  update matches set game_state = v_state where id = p_match_id;

  if v_game_over then
    perform public.settle_multiplayer_match(p_match_id, v_winner_user);
  end if;

  return jsonb_build_object('success', true, 'state', v_state);
end;
$$;

revoke execute on function public.roll_ludo_dice(uuid) from public, anon;
grant execute on function public.roll_ludo_dice(uuid) to authenticated;
revoke execute on function public.move_ludo_token(uuid, int) from public, anon;
grant execute on function public.move_ludo_token(uuid, int) to authenticated;

-- ---------------------------------------------------------------
-- Generic N-player settlement. A new, separate function - existing
-- settle_match (2-player only) is completely untouched, so every
-- other game keeps behaving exactly as it did before this migration.
-- Winner takes the whole pot minus the platform fee; every other
-- participant simply forfeits their locked stake, the same "loser"
-- ledger entry settle_match already uses per player, just looped.
-- ---------------------------------------------------------------

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

  -- Lock every participant's wallet row in a stable order (sorted by
  -- id) to avoid deadlocking against a concurrent settlement on a
  -- different match sharing a player.
  select array_agg(x order by x) into v_sorted from unnest(v_participants) x;
  for v_loser_id in select unnest(v_sorted) loop
    perform 1 from wallets where user_id = v_loser_id for update;
  end loop;

  select coalesce(value::numeric, 5) into v_fee_percent from settings where key = 'platform_fee_percent';
  v_commission := round(v_match.total_pot * v_fee_percent / 100, 2);
  v_net_payout := v_match.total_pot - v_commission;

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
    'Won match (pool ' || v_match.total_pot || ', commission ' || v_commission || ')'
  );

  update matches
  set status = 'completed', winner_id = p_winner_id, commission_amount = v_commission
  where id = p_match_id
  returning * into v_match;

  perform public.notify_user(p_winner_id, 'You won! 🏆', 'You won ' || v_net_payout || ' XAF. Funds added to your wallet.');

  return v_match;
end;
$$;

revoke execute on function public.settle_multiplayer_match(uuid, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------
-- Cancel: only meaningful while still 'waiting' (nobody but the
-- creator locked funds yet is wrong here - other seats may have
-- already joined and locked stakes too, unlike the 2-player games
-- where "waiting" always means zero joiners). Refund every seated
-- player, not just the creator.
-- ---------------------------------------------------------------

create or replace function public.cancel_ludo_match(
  p_match_id uuid
)
returns matches
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match matches%rowtype;
  v_participant record;
begin
  select * into v_match from matches where id = p_match_id for update;
  if not found then raise exception 'Match not found'; end if;
  if v_match.creator_id != auth.uid() then raise exception 'Only the creator can cancel this match'; end if;
  if v_match.status != 'waiting' then raise exception 'Match already started and cannot be cancelled'; end if;

  for v_participant in select user_id from match_participants where match_id = p_match_id loop
    perform public.apply_wallet_transaction(
      v_participant.user_id, 'refund', v_match.stake_amount, null, 'Ludo match cancelled, stake released'
    );
  end loop;

  update matches set status = 'cancelled' where id = p_match_id returning * into v_match;
  return v_match;
end;
$$;

-- ---------------------------------------------------------------
-- Let the creator start early once at least 2 seats are filled,
-- instead of forcing a full table - a 4-player match with 2-3 people
-- ready shouldn't be stuck waiting forever for a 4th.
-- ---------------------------------------------------------------

create or replace function public.start_ludo_match(
  p_match_id uuid
)
returns matches
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match matches%rowtype;
  v_seats jsonb;
  v_joined_count int;
begin
  select * into v_match from matches where id = p_match_id for update;
  if not found then raise exception 'Match not found'; end if;
  if v_match.creator_id != auth.uid() then raise exception 'Only the creator can start this match'; end if;
  if v_match.status != 'waiting' then raise exception 'Match already started'; end if;

  v_seats := v_match.game_state->'seats';
  select count(*) into v_joined_count from jsonb_array_elements(v_seats) s where s != 'null'::jsonb;

  if v_joined_count < 2 then
    raise exception 'Need at least 2 players to start';
  end if;

  update matches set status = 'active' where id = p_match_id returning * into v_match;
  return v_match;
end;
$$;

-- ---------------------------------------------------------------
-- Inactivity safety valve. The generic resign_match/claim_forfeit_win
-- RPCs both hard-assume exactly two participants (they settle the
-- match to the "other" player) - wrong for 3-4 seats, where one
-- vanished player shouldn't end the match for everyone else. Instead,
-- if the seat whose turn it is has gone quiet, any other participant
-- can just skip their turn (not eliminate them, not settle anything)
-- once the match has been idle a while - this is exactly the kind of
-- gap that left real users with indefinitely locked funds elsewhere
-- (see the locked-funds audit), so Ludo gets this from day one instead
-- of bolted on later.
-- ---------------------------------------------------------------

create or replace function public.pass_ludo_turn(
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
  v_participants uuid[];
  v_next_seat int;
begin
  select * into v_match from matches where id = p_match_id for update;
  if not found then raise exception 'Match not found'; end if;
  if v_match.status != 'active' then raise exception 'Match is not active'; end if;

  v_state := v_match.game_state;
  if v_state->>'game_type' != 'ludo' then raise exception 'Not a Ludo match'; end if;

  select array_agg(user_id) into v_participants from match_participants where match_id = p_match_id;
  if not (auth.uid() = any(v_participants)) then raise exception 'Not a participant'; end if;

  if v_match.updated_at > now() - interval '2 minutes' then
    raise exception 'Give the current player a bit more time before skipping their turn';
  end if;

  v_seats := v_state->'seats';
  v_next_seat := public._ludo_next_seat(v_seats, (v_state->>'current_seat')::int, v_match.max_players);

  update matches set game_state = v_state || jsonb_build_object(
    'current_seat', v_next_seat, 'dice_value', null, 'awaiting_move', false,
    'movable_tokens', '[]'::jsonb, 'consecutive_sixes', 0
  )
  where id = p_match_id
  returning * into v_match;

  return v_match;
end;
$$;

grant execute on function public.pass_ludo_turn(uuid) to authenticated;

insert into games (name, slug, min_stake, max_stake, is_active)
values ('Ludo', 'ludo', 50, 100000, true)
on conflict (slug) do nothing;
