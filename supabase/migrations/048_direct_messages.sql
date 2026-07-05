-- Lucky Jambo - Direct messages between friends
--
-- Free-text DMs between two people who are already friends (unlike
-- match_chat_messages' fixed preset list - this is a different,
-- lower-stakes surface: a private 1:1 conversation, not a public-ish
-- in-match channel, so free text is reasonable here). Modeled closely
-- on match_chat_messages (047_match_chat.sql) for the realtime +
-- RLS + rate-limit pattern.

create table if not exists direct_messages (
    id uuid primary key default gen_random_uuid(),

    sender_id uuid references profiles(id) not null,
    receiver_id uuid references profiles(id) not null,

    message text not null
    check (char_length(trim(message)) > 0 and char_length(message) <= 1000),

    is_read boolean default false,

    created_at timestamptz default now()
);

create index if not exists idx_dm_conversation
on direct_messages(least(sender_id, receiver_id), greatest(sender_id, receiver_id), created_at);

create index if not exists idx_dm_receiver_unread
on direct_messages(receiver_id, is_read) where is_read = false;

alter table direct_messages enable row level security;

-- Either side of the conversation can read it - never a third party.
create policy "view own direct messages"
on direct_messages
for select
using (auth.uid() = sender_id or auth.uid() = receiver_id);

-- Can only send as yourself, only to someone you're actually friends
-- with (mirrors the friends table's symmetric row-per-direction
-- design - see 015_friend_requests_and_notify.sql), and not if your
-- own account is banned.
create policy "send direct messages to friends"
on direct_messages
for insert
with check (
    auth.uid() = sender_id
    and sender_id <> receiver_id
    and not exists (
        select 1 from profiles p where p.id = auth.uid() and p.is_banned is true
    )
    and exists (
        select 1 from friends f
        where f.user_id = auth.uid() and f.friend_id = direct_messages.receiver_id
    )
);

-- Only the recipient can mark a message read (used by the
-- conversation view when it's opened).
create policy "mark received messages read"
on direct_messages
for update
using (auth.uid() = receiver_id)
with check (auth.uid() = receiver_id);

-- Basic anti-spam: at most one DM every 1 second per sender (a real
-- conversation is naturally slower than that; this only blocks
-- scripted flooding), same trigger-based approach as match chat.
create or replace function enforce_direct_message_cooldown()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_last_sent timestamptz;
begin
    select created_at into v_last_sent
    from direct_messages
    where sender_id = new.sender_id
    order by created_at desc
    limit 1;

    if v_last_sent is not null and now() - v_last_sent < interval '1 second' then
        raise exception 'Sending messages too quickly - please wait a moment.'
        using errcode = 'P0001';
    end if;

    return new;
end;
$$;

drop trigger if exists trg_direct_message_cooldown on direct_messages;
create trigger trg_direct_message_cooldown
before insert on direct_messages
for each row
execute function enforce_direct_message_cooldown();

-- Realtime, same pattern as match_chat_messages/matches.
do $$
begin
    if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'direct_messages'
    ) then
        alter publication supabase_realtime add table public.direct_messages;
    end if;
end $$;

-- A lightweight per-conversation summary (last message + unread count)
-- for the inbox list. SECURITY INVOKER (default) is fine and correct
-- here - it should only ever see what the calling user's own RLS
-- policies above already allow them to see, unlike the leaderboard
-- RPCs (031_leaderboard_rpcs.sql) which deliberately need to bypass
-- per-user RLS to aggregate across everyone.
create or replace function public.get_dm_conversations()
returns table (
    friend_id uuid,
    friend_username text,
    friend_avatar_url text,
    last_message text,
    last_message_at timestamptz,
    last_message_sender_id uuid,
    unread_count bigint
)
language sql
stable
as $$
    with my_messages as (
        select
            case when sender_id = auth.uid() then receiver_id else sender_id end as friend_id,
            message,
            created_at,
            sender_id,
            is_read
        from direct_messages
        where auth.uid() in (sender_id, receiver_id)
    ),
    ranked as (
        select *,
            row_number() over (partition by friend_id order by created_at desc) as rn
        from my_messages
    )
    select
        r.friend_id,
        p.username,
        p.avatar_url,
        r.message,
        r.created_at,
        r.sender_id,
        (
            select count(*) from my_messages m2
            where m2.friend_id = r.friend_id and m2.is_read = false and m2.sender_id != auth.uid()
        )
    from ranked r
    join profiles p on p.id = r.friend_id
    where r.rn = 1
    order by r.created_at desc;
$$;

grant execute on function public.get_dm_conversations() to authenticated;
