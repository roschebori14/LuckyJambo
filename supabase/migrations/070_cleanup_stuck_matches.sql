-- Lucky Jambo - Cleanup stuck matches
--
-- This script safely cleans up any broken, stuck, or testing matches
-- that are hanging in the 'waiting' or 'active' state (like the old Word Rush
-- matches created before the rematch fix). It refunds all stakes back to the players.

do $$
declare
  v_match record;
  v_participant record;
begin
  -- Loop through all matches that haven't been completed or cancelled
  for v_match in 
    select * from matches where status in ('waiting', 'active')
  loop
    -- Mark match as cancelled
    update matches set status = 'cancelled' where id = v_match.id;
    
    -- Refund the creator
    perform public.apply_wallet_transaction(
      v_match.creator_id, 
      'refund_draw', 
      v_match.stake_amount, 
      v_match.id, 
      'Refund for cancelled/stuck match'
    );
    
    -- Refund any other participants who joined
    for v_participant in 
      select user_id from match_participants 
      where match_id = v_match.id and user_id != v_match.creator_id
    loop
      perform public.apply_wallet_transaction(
        v_participant.user_id, 
        'refund_draw', 
        v_match.stake_amount, 
        v_match.id, 
        'Refund for cancelled/stuck match'
      );
    end loop;
  end loop;
end;
$$;
