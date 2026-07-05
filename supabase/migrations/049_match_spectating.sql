-- Lucky Jambo - Match spectating
--
-- Goal: any logged-in user can watch an in-progress or finished match,
-- not just its two participants. Two things currently block that:
--
-- 1. matches RLS ("view own matches", 005_fix_matches_schema.sql) only
--    lets a match be read by its creator, a participant, or - for
--    'waiting' matches only - anyone (so the open lobby works). Once a
--    match goes 'active' it disappears from everyone else's view
--    entirely, so a spectate link 404s ("Match not found") for anyone
--    who isn't already playing.
--
-- 2. match_participants RLS ("view own match participation",
--    002_rls_policies.sql) only ever lets a row be read by the user_id
--    on that exact row. This means even the two *players* in a match
--    can't see each other's participant row today - only their own -
--    which is why opponent-name lookups (rematch button, "vs" display)
--    have been silently resolving to null. Widening this is required
--    for spectating (a spectator needs both participants to render
--    "playerA vs playerB"), and incidentally fixes that existing bug
--    for real participants too.
--
-- What stays private regardless of these changes:
--   - match_moves (hidden per-player choice for RPS/coin-flip/dice)
--     keeps its existing "only the submitting player can read their
--     own row" policy, untouched by this migration. A spectator (or
--     the opponent) still can't see a pending hidden move early -
--     matches.game_state for instant games only ever holds the public
--     outcome once both sides have moved and the match resolves (see
--     app/api/games/state/route.ts), never the in-flight private pick.
--   - match_chat_messages keeps its existing participant-only read/
--     write policies (047_match_chat.sql) - spectators can watch the
--     board but not the players' private banter.
--   - 'cancelled' matches remain visible only to the creator/
--     participants (nothing for a spectator to watch there anyway).

drop policy if exists "view own matches" on matches;

create policy "view own or spectatable matches"
on matches
for select
using (
  auth.uid() = creator_id
  or auth.uid() in (
    select user_id from match_participants where match_id = matches.id
  )
  or status in ('waiting', 'active', 'completed') -- open to join, live to watch, or finished to review
);

drop policy if exists "view own match participation" on match_participants;

create policy "view participants of viewable matches"
on match_participants
for select
using (
  auth.uid() = user_id
  or exists (
    select 1 from matches m
    where m.id = match_participants.match_id
      and (
        m.creator_id = auth.uid()
        or m.status in ('waiting', 'active', 'completed')
      )
  )
);
