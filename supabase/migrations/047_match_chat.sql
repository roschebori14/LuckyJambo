-- Lucky Jambo - Match quick-chat (preset emoji/slang only)
--
-- Players can send each other a short reaction while a match is active
-- (e.g. "GG", "Unlucky!", "🔥"). This is intentionally NOT free-text
-- chat: the `message` column is constrained by a CHECK against the
-- exact preset list in lib/games/match-chat-presets.ts, so there's no
-- freeform text surface to moderate, no profanity filter to build or
-- maintain, and no way to smuggle in something outside that list even
-- by calling the insert directly and skipping the picker UI entirely.
--
-- IMPORTANT: if MATCH_CHAT_PRESETS in
-- lib/games/match-chat-presets.ts is ever changed, this CHECK
-- constraint must be updated to match via a follow-up migration - the
-- two lists are not derived from a single source of truth.

create table if not exists match_chat_messages (
    id uuid primary key default gen_random_uuid(),

    match_id uuid references matches(id) on delete cascade not null,

    user_id uuid references profiles(id) not null,

    message text not null
    check (
        message in (
            'GG', 'Nice one!', 'Well played', 'Unlucky!',
            'So close!', 'Good luck!', 'Rematch?', 'Nooo!',
            '👍', '🔥', '😂', '😅', '👏', '😢', '🤝', '💪'
        )
    ),

    created_at timestamptz default now()
);

create index if not exists idx_match_chat_match_created
on match_chat_messages(match_id, created_at);

alter table match_chat_messages enable row level security;

-- Read access mirrors "view own matches" (005_fix_matches_schema.sql)
-- exactly - a match's chat is never visible to anyone who couldn't
-- already see the match itself.
create policy "view own match chat"
on match_chat_messages
for select
using (
    exists (
        select 1 from matches m
        where m.id = match_chat_messages.match_id
        and (
            m.creator_id = auth.uid()
            or auth.uid() in (
                select user_id from match_participants where match_id = m.id
            )
        )
    )
);

-- A player can only post as themselves, only into a match they're a
-- participant of, only while it's active (no chatting into a match
-- that hasn't started or has already settled/cancelled), and only if
-- their account isn't banned.
create policy "send match chat as participant"
on match_chat_messages
for insert
with check (
    auth.uid() = user_id
    and not exists (
        select 1 from profiles p where p.id = auth.uid() and p.is_banned is true
    )
    and exists (
        select 1 from matches m
        where m.id = match_chat_messages.match_id
        and m.status = 'active'
        and (
            m.creator_id = auth.uid()
            or auth.uid() in (
                select user_id from match_participants where match_id = m.id
            )
        )
    )
);

-- Basic anti-spam: at most one message every 2 seconds per user per
-- match. Runs server-side as a trigger so it applies no matter how the
-- row gets inserted, not just through the app's own API route.
create or replace function enforce_match_chat_cooldown()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_last_sent timestamptz;
begin
    select created_at into v_last_sent
    from match_chat_messages
    where match_id = new.match_id and user_id = new.user_id
    order by created_at desc
    limit 1;

    if v_last_sent is not null and now() - v_last_sent < interval '2 seconds' then
        raise exception 'Sending messages too quickly - please wait a moment.'
        using errcode = 'P0001';
    end if;

    return new;
end;
$$;

drop trigger if exists trg_match_chat_cooldown on match_chat_messages;
create trigger trg_match_chat_cooldown
before insert on match_chat_messages
for each row
execute function enforce_match_chat_cooldown();

-- Realtime: broadcast new chat rows the same way match state updates
-- already are (036_realtime_matches.sql), so both players see a
-- message the instant it's sent instead of waiting on a poll. RLS
-- still governs the replication stream via the select policy above.
do $$
begin
    if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'match_chat_messages'
    ) then
        alter publication supabase_realtime add table public.match_chat_messages;
    end if;
end $$;
