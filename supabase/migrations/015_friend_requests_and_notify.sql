-- Lucky Jambo - Friend requests + notifications
--
-- friend_requests and friends had SELECT-only RLS policies - no way
-- for the application to actually insert a request or accept one
-- without going through a security definer function. notifications
-- had the same gap for inserts. Fixing both here.

create or replace function public.send_friend_request(
  p_receiver_username text
)
returns friend_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_receiver_id uuid;
  v_request friend_requests%rowtype;
  v_existing_friend boolean;
begin
  select id into v_receiver_id from profiles where username = p_receiver_username;
  if v_receiver_id is null then
    raise exception 'User not found';
  end if;
  if v_receiver_id = auth.uid() then
    raise exception 'You cannot add yourself';
  end if;

  select exists(
    select 1 from friends
    where (user_id = auth.uid() and friend_id = v_receiver_id)
       or (user_id = v_receiver_id and friend_id = auth.uid())
  ) into v_existing_friend;
  if v_existing_friend then
    raise exception 'You are already friends';
  end if;

  if exists(
    select 1 from friend_requests
    where sender_id = auth.uid() and receiver_id = v_receiver_id and status = 'pending'
  ) then
    raise exception 'Friend request already sent';
  end if;

  insert into friend_requests (sender_id, receiver_id, status)
  values (auth.uid(), v_receiver_id, 'pending')
  returning * into v_request;

  insert into notifications (user_id, title, message)
  values (v_receiver_id, 'New friend request',
    (select username from profiles where id = auth.uid()) || ' wants to be your friend');

  return v_request;
end;
$$;

create or replace function public.respond_friend_request(
  p_request_id uuid,
  p_accept boolean
)
returns friend_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request friend_requests%rowtype;
begin
  select * into v_request from friend_requests where id = p_request_id for update;
  if not found then raise exception 'Request not found'; end if;
  if v_request.receiver_id != auth.uid() then raise exception 'Not your request to respond to'; end if;
  if v_request.status != 'pending' then raise exception 'Request already handled'; end if;

  if p_accept then
    update friend_requests set status = 'accepted' where id = p_request_id returning * into v_request;
    insert into friends (user_id, friend_id) values (v_request.sender_id, v_request.receiver_id);
    insert into friends (user_id, friend_id) values (v_request.receiver_id, v_request.sender_id);
    insert into notifications (user_id, title, message)
    values (v_request.sender_id, 'Friend request accepted',
      (select username from profiles where id = auth.uid()) || ' accepted your friend request');
  else
    update friend_requests set status = 'rejected' where id = p_request_id returning * into v_request;
  end if;

  return v_request;
end;
$$;

-- Server-side helper for inserting notifications from API routes via
-- the user's own session (instead of needing the service-role client
-- for every notification, which would be an overly broad permission
-- grant just to write a row the recipient already has SELECT on).
create or replace function public.notify_user(
  p_user_id uuid,
  p_title text,
  p_message text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into notifications (user_id, title, message)
  values (p_user_id, p_title, p_message);
end;
$$;
