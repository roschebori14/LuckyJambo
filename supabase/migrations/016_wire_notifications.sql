-- Lucky Jambo - Wire notifications into existing RPCs
--
-- Redefines join_match and settle_match (defined in 007/008, then
-- redefined in 013) one more time to fire notify_user() calls at the
-- key moments: someone joins your match, your match was settled
-- (win or lose), and a withdrawal you requested was auto-processed.
-- CREATE OR REPLACE keeps this safe to layer on top of prior versions.

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
  v_joiner_username text;
begin
  select * into v_match from matches where id = p_match_id for update;

  if not found then raise exception 'Match not found'; end if;
  if v_match.status != 'waiting' then raise exception 'Match is no longer open'; end if;
  if v_match.creator_id = auth.uid() then raise exception 'You cannot join your own match'; end if;
  if v_match.invited_user_id is not null and v_match.invited_user_id != auth.uid() then
    raise exception 'This match is a private challenge for another player';
  end if;

  perform public.apply_wallet_transaction(
    auth.uid(), 'match_stake', v_match.stake_amount, null, 'Stake to join match'
  );

  insert into match_participants (match_id, user_id) values (p_match_id, auth.uid());

  update matches set status = 'active' where id = p_match_id returning * into v_match;

  select username into v_joiner_username from profiles where id = auth.uid();
  perform public.notify_user(
    v_match.creator_id, 'Opponent found!',
    v_joiner_username || ' joined your match. Good luck!'
  );

  return v_match;
end;
$$;

create or replace function public.settle_match(
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
  v_loser_id uuid;
  v_fee_percent numeric;
  v_prize_pool numeric;
  v_commission numeric;
  v_net_payout numeric;
  v_first_id uuid;
  v_second_id uuid;
begin
  select * into v_match from matches where id = p_match_id for update;

  if not found then raise exception 'Match not found'; end if;
  if v_match.status != 'active' then raise exception 'Match is not active'; end if;

  select array_agg(user_id) into v_participants
  from match_participants where match_id = p_match_id;

  if array_length(v_participants, 1) != 2 then
    raise exception 'Match does not have exactly two participants';
  end if;
  if not (auth.uid() = any(v_participants)) then
    raise exception 'Only a match participant can settle this match';
  end if;
  if not (p_winner_id = any(v_participants)) then
    raise exception 'Winner must be a match participant';
  end if;

  v_loser_id := (select user_id from unnest(v_participants) as user_id where user_id != p_winner_id);

  select coalesce(value::numeric, 5) into v_fee_percent from settings where key = 'platform_fee_percent';

  v_prize_pool := v_match.stake_amount * 2;
  v_commission := round(v_prize_pool * v_fee_percent / 100, 2);
  v_net_payout := v_prize_pool - v_commission;

  if p_winner_id < v_loser_id then v_first_id := p_winner_id; v_second_id := v_loser_id;
  else v_first_id := v_loser_id; v_second_id := p_winner_id; end if;

  perform 1 from wallets where user_id = v_first_id for update;
  perform 1 from wallets where user_id = v_second_id for update;

  perform public.apply_wallet_transaction(
    v_loser_id, 'match_loss', v_match.stake_amount, p_match_id::text, 'Lost match'
  );

  update wallets set locked_balance = locked_balance - v_match.stake_amount, updated_at = now()
  where user_id = p_winner_id;

  perform public.apply_wallet_transaction(
    p_winner_id, 'match_win', v_net_payout, p_match_id::text,
    'Won match (pool ' || v_prize_pool || ', commission ' || v_commission || ')'
  );

  update matches
  set status = 'completed', winner_id = p_winner_id, commission_amount = v_commission
  where id = p_match_id
  returning * into v_match;

  perform public.notify_user(p_winner_id, 'You won! 🏆',
    'You won ' || v_net_payout || ' XAF. Funds added to your wallet.');
  perform public.notify_user(v_loser_id, 'Match result',
    'You lost this match. Better luck next time!');

  return v_match;
end;
$$;
