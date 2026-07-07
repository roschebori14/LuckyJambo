-- Lucky Jambo - Lock down the voice-chat signaling channel
--
-- The voice chat feature (hooks/use-webrtc-voice.ts) signals WebRTC
-- offers/answers/ICE candidates over a Supabase Realtime broadcast
-- channel named `voice:{matchId}`. As first shipped, that channel had
-- no access control at all - matchId is not a secret (it's the exact
-- id in every match/spectate URL players already share), so anyone
-- with a match link could open a websocket straight to that channel
-- name and:
--   - see both real players' SDP/ICE signaling, which leaks IP
--     addresses (ICE candidates always contain them)
--   - inject fake offer/answer/bye messages to disrupt the real call
--   - track presence under a spoofed user id and potentially insert
--     themselves into the negotiation
-- The client only ever hid the "Enable Voice" button from spectators
-- (isSpectator check in game-client.tsx) - that's a UI nicety, not a
-- security boundary; nothing stopped a direct websocket connection
-- from bypassing it entirely.
--
-- Fix: Supabase Realtime Authorization. Marking the channel
-- `{ config: { private: true } }` client-side (already done) makes
-- Realtime check RLS policies on realtime.messages before allowing a
-- connection to subscribe to, read from, or write to a given topic,
-- the same way table RLS already gates every other feature in this
-- app - so the same match_participants check used everywhere else
-- now applies here too.
--
-- IMPORTANT - this could not be tested against a live project from
-- here. Two things to verify against your actual Supabase project
-- before trusting this:
--   1. "Realtime Authorization" / private channels must be an
--      available feature on your Realtime version - it's been GA on
--      Supabase Cloud since 2024, but confirm if self-hosting.
--   2. The exact policy shape below (realtime.topic(), the
--      realtime.messages table) matches Supabase's documented
--      pattern as of when this was written - Supabase has iterated
--      this API before. If migration apply fails on this file,
--      check Supabase's current "Realtime Authorization" docs for
--      any renamed function/table and adjust accordingly.

alter table realtime.messages enable row level security;

-- One combined helper so the read and write policies below can't
-- silently drift apart from each other.
create or replace function public._voice_topic_is_authorized()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    realtime.topic() like 'voice:%'
    and exists (
      select 1
      from match_participants mp
      where mp.match_id = (split_part(realtime.topic(), ':', 2))::uuid
        and mp.user_id = (select auth.uid())
    );
$$;

revoke execute on function public._voice_topic_is_authorized() from public, anon, authenticated;

create policy "voice channel - participants can read"
on realtime.messages
for select
to authenticated
using (public._voice_topic_is_authorized());

create policy "voice channel - participants can write"
on realtime.messages
for insert
to authenticated
with check (public._voice_topic_is_authorized());
