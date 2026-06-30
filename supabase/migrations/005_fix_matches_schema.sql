-- Lucky Jambo - Fix matches schema + add match_moves
--
-- Problems being fixed:
-- 1. Application code (MatchService, join route) reads/writes
--    matches.creator_id and matches.opponent_id, neither of which
--    exist on the matches table. Adding creator_id (opponent is
--    derived from match_participants, which already exists for
--    exactly this purpose).
-- 2. Turn-based games (chess, tic-tac-toe) need somewhere to persist
--    board state. Adding a generic game_state jsonb column instead of
--    a one-off table per game (chess_matches, which the chess routes
--    reference but was never migrated, doesn't exist, and would crash
--    chess immediately).
-- 3. Instant games with a hidden simultaneous choice (rock-paper-
--    scissors, coin flip) can't store a player's pending move in
--    `matches` itself, because the existing "view matches" RLS policy
--    is public-read (using (true)) - the opponent could just query
--    Supabase directly and read your choice before submitting theirs.
--    match_moves is scoped so a player can only ever read their own
--    submitted move; resolution happens server-side in a function
--    that can see both.

alter table matches
add column if not exists creator_id uuid references profiles(id),
add column if not exists game_state jsonb not null default '{}'::jsonb;

create index if not exists idx_matches_creator on matches(creator_id);
create index if not exists idx_matches_status on matches(status);

create table if not exists match_moves (
    id uuid primary key default uuid_generate_v4(),
    match_id uuid references matches(id) on delete cascade not null,
    user_id uuid references profiles(id) not null,
    move text not null,
    created_at timestamptz default now(),
    unique (match_id, user_id)
);

alter table match_moves enable row level security;

create policy "view own submitted move"
on match_moves
for select
using (
  auth.uid() = user_id
);

-- Tighten matches read access to participants + admins. Board state
-- (game_state) for chess/tic-tac-toe is fine to be visible to both
-- players - it's the match_moves table above that protects hidden
-- instant-game choices, not this policy. This mainly stops a
-- completely unrelated user from browsing other people's matches.
drop policy if exists "view matches" on matches;

create policy "view own matches"
on matches
for select
using (
  auth.uid() = creator_id
  or auth.uid() in (
    select user_id from match_participants where match_id = matches.id
  )
  or status = 'waiting' -- open matches must stay visible so people can find & join them
);
