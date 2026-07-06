# Lucky Jambo Phase 9

## Goal

Three big, mostly-independent workstreams requested together:
1. Use `boardgame.io` for **new** games going forward. **Decision as of
   this slice: do NOT migrate the existing games (tic-tac-toe, chess,
   draughts, battleship, snakes & ladders) onto it.** They stay exactly
   as they are - their own Postgres RPCs + hand-rolled React boards.
   `boardgame.io` is only for games built from here on out.
2. Friend-to-friend direct messages that arrive as a toast notification
   anywhere in the app.
3. `freesound.org`-powered sound effects, plus general UI polish/effects.

Given the size of this, work is being done in shippable slices - each
slice gets its own zip so nothing is lost if a session runs out of room
mid-way. This file is the single source of truth for what's done vs.
still open; keep it updated at the end of every slice.

## Status

### 📋 Authoritative build order as of this slice

The user supplied a dedicated roadmap doc (`lucky-jambo-new-games-roadmap.md`)
covering the full new-games plan in more detail than this file did -
treat that doc as authoritative for architecture rationale and the
per-game checklist. Build order:

1. ✅ Four in a Row (Connect 4) - done (prior slice)
2. ✅ Dots and Boxes - done (this slice)
3. ⏳ Gomoku - not started (next up)
4. ⏳ Word Game (iMessage-style) - not started
5. ⏳ Penalty Shootout - not started
6. ⏳ Archery - not started
7. ⏳ Cup Pong - not started
8. ⏳ 8-Ball Pool - not started (do last, most complex)
9. ⏳ Phase 2 (enhance existing games) - not started, see the roadmap
   doc's "Phase 2" section

(A couple of stale entries further down this file - e.g. one that says
"Penalty Shootout" is the first boardgame.io game - predate the roadmap
doc and are superseded by the order above.)

### ✅ Done - Dots and Boxes (this slice)

Built following the exact architecture Four in a Row established
(headless boardgame.io `Game` object as the rules authority, run
per-request from a Next.js API route, persisted via a SECURITY DEFINER
Postgres RPC with optimistic concurrency - see that game's `engine.ts`
for the full rationale, not repeated per-game):

- `lib/games/dots-and-boxes/game.ts` (boardgame.io `Game` definition:
  4x4 boxes / 5x5 dots, `drawLine` move, win/draw `endIf`) + `engine.ts`
  (headless runner; also owns the "complete a box, go again" turn rule,
  since that's turn-order logic the headless approach handles itself
  rather than through boardgame.io's own turn/event system).
- `supabase/migrations/051_dots_and_boxes.sql`: `create_match`/
  `join_match` branches, `apply_dots_and_boxes_move_result` RPC
  (optimistic concurrency checked against both line arrays), game
  registration.
- `types/dots-and-boxes.ts`, `app/api/dots-and-boxes/{create,state,move}`,
  `components/games/dots-and-boxes-board.tsx` (dot grid with clickable
  line segments, filled boxes, score display, uses the shared
  `useMatchResultSound` hook for win/lose/draw sound - Four in a Row's
  board doesn't use that hook yet, worth a quick follow-up fix there),
  a new `box-complete` sound effect, wired into `game-client.tsx`,
  `game-card.tsx`, and `game-icons.tsx`. New cover art at
  `public/images/dots-and-boxes.png`.

**Drive-by fix**: `app/api/four-in-a-row/create/route.ts` had a
leftover `supabase.from("matches").update(...)` call using the
player's own session client, right after already correctly creating
the match via the `create_match` RPC - that update is a guaranteed
no-op (no RLS UPDATE policy on `matches`, the same footgun this
project has hit repeatedly). Harmless here since `create_match` had
already seeded the right state, but confusing/wrong code. Didn't touch
`four-in-a-row`'s copy (out of scope for this slice) but made sure
`dots-and-boxes/create/route.ts` doesn't repeat it.

**Also worth knowing**: neither `/api/four-in-a-row/create` nor
`/api/dots-and-boxes/create` are actually called by the real UI - match
creation goes through the generic `/api/matches/create` route (see
`create-match-form.tsx` / `challenge-friend-form.tsx`), which calls
`create_match` directly with whatever `game_slug` was picked. Both
per-game `create` routes are therefore dead code today, consistent
with (if not ideal alongside) how Four in a Row already shipped. Not
fixed in this slice since it's pre-existing and harmless; worth a
cleanup pass later.

### ✅ Done - Direct Messages + Toast Notifications (this slice)

- `direct_messages` table (migration `048_direct_messages.sql`):
  free-text, friends-only (RLS mirrors the `friends` table, same pattern
  as `match_chat_messages` in `047_match_chat.sql`), realtime-enabled,
  1-message-per-second rate limit trigger.
- `get_dm_conversations()` RPC: one row per conversation (last message +
  unread count) for the inbox list.
- `lib/messages/message-service.ts`, `/api/messages/send`,
  `/api/messages/conversations`, `/api/messages/[friendId]` (GET
  history, POST mark-read).
- `hooks/use-direct-message-realtime.ts` - mirrors
  `use-match-chat-realtime.ts`'s unique-per-instance-channel pattern so
  the global listener and an open conversation thread can both
  subscribe at once safely.
- `components/ui/toast-provider.tsx` - generic, reusable toast system
  (not DM-specific) - mounted once in `(protected)/layout.tsx`. Any
  future feature (sound-effect unlocks, achievements, etc.) can call
  `useToast().pushToast(...)` from anywhere in the app.
- `components/messages/dm-toast-listener.tsx` - mounted globally,
  listens for new DMs addressed to the current user across every
  conversation (not just an open thread) and pushes a toast, so a
  message is noticeable no matter what page the recipient is on.
- `/messages` (inbox) and `/messages/[friendId]` (conversation thread,
  with optimistic send + live realtime updates) pages.
- "Message" button added to `FriendCard`; `Messages` added to the nav
  (desktop sidebar + mobile bottom bar, now 8 columns).

**Not done yet, worth adding in a follow-up slice:** an unread-count
badge on the Messages nav icon (the data is already there via
`get_dm_conversations()`'s `unread_count` - just needs wiring into
`navbar.tsx`/`sidebar.tsx`), and letting a message push a row into the
existing `notifications` table too (so it also shows on `/notifications`
for anyone who doesn't have the toast in view, e.g. a fresh page load
right after the toast auto-dismissed).

### ✅ Done - boardgame.io installed

`boardgame.io` is now in `package.json`/`package-lock.json`. **Not yet
used anywhere** - no game has been built with it yet. See "Next:
boardgame.io - new games" below. **Scope note:** per an explicit
decision this slice, this is additive only - none of the five existing
games are being touched or ported.

### ✅ Done - freesound.org sound effects + first UI effect (this slice)

- `.env.example`: added `FREESOUND_API_KEY` + `FREESOUND_CACHE_TTL`.
  Get a free key at https://freesound.org/apiv2/apply/.
- `lib/sound/effect-catalog.ts` - single source of truth for every
  effect name used in the app (`move`, `dice-roll`, `coin-flip`,
  `match-win/lose/draw`, `message-received`, `notification`,
  `button-tap`, `match-found`, `deposit-success`,
  `withdrawal-success`), each with a Freesound search query + default
  volume. Add new effects here first.
- `lib/sound/freesound-client.ts` (server-only, `import "server-only"`
  guards it from ever being bundled client-side) - queries Freesound's
  text search, filtered to `CC0`/`Attribution` licensed clips only (no
  NC content in a commercial product), with an optional pinned
  `fallbackId` per effect for once you've hand-picked good sounds.
- `lib/sound/sound-cache.ts` - process-local cache + in-flight
  de-duplication in front of the Freesound client, so N players
  triggering the same effect doesn't mean N Freesound API calls.
- `app/api/sound/resolve/route.ts` - the only endpoint the browser
  talks to (`GET /api/sound/resolve?effect=match-win`). Auth-gated like
  every other route here. The Freesound API key never reaches the
  client - only a resolved preview URL does.
- `lib/sound/sound-manager.tsx` - `SoundProvider` (mounted in
  `(protected)/layout.tsx`, alongside `ToastProvider`) + `useSound()`
  hook. Resolves each effect once per session, caches the `<audio>`
  element, and persists mute + master-volume preference to
  `localStorage`.
- `components/ui/sound-toggle.tsx` - mute button, wired into
  `components/layout/navbar.tsx` next to the notification bell.
- `lib/sound/use-match-result-sound.ts` - one-line hook
  (`useMatchResultSound(result)`) that fires `match-win` /
  `match-lose` / `match-draw` exactly once when a board's existing
  `result` state resolves. Wired into
  `components/games/instant-game-board.tsx` (covers dice, RPS, coin
  flip - all three share this component).
- `components/ui/confetti.tsx` - dependency-free CSS confetti burst
  (matches the "no extra dependency" style of `toast-provider.tsx`).
  Wired into the win banner in `instant-game-board.tsx`.
- `message-received` sound wired into `dm-toast-listener.tsx` so an
  incoming DM is audible, not just a toast.

**Not yet wired (do these next, same one-line pattern each time):**
- `useMatchResultSound(result)` + `<Confetti fire={result.you_won} />`
  into the other five boards - `chess-board.tsx`, `draughts-board.tsx`,
  `tic-tac-toe-board.tsx`, `battleship-board.tsx`,
  `snakes-ladders-board.tsx`. Each already tracks an equivalent result
  object; check the exact shape per board before assuming it matches
  `instant-game-board.tsx`'s `{status, you_won}`.
- `move` sound on each board's own move-submit handler (not just
  win/lose) - one `play("move")` call per board, right where the move
  request succeeds.
- `deposit-success` / `withdrawal-success` - wire once those flows call
  `pushToast(...)`; right now neither deposits nor withdrawals push a
  toast at all yet, so there's no hook point - add the toast call first,
  then `play(...)` next to it, same as `dm-toast-listener.tsx` does.
- `notification` - generic fallback for any future toast that isn't a
  DM (friend request accepted, etc.) - same pattern.
- `button-tap` - decorative, lowest priority; wrap the shared button
  component (if one exists) or skip entirely if it turns out too noisy
  in practice.
- Verify licensing on whatever Freesound actually resolves for each
  query once a real `FREESOUND_API_KEY` is in `.env.local` - the code
  filters to CC0/Attribution, but eyeball the actual matches and pin a
  `fallbackId` in `effect-catalog.ts` for any effect that's core to the
  feel of the app (win/lose especially) so it doesn't drift if
  Freesound's top search result changes later.

### ⏳ Not started - first boardgame.io game: Penalty Shootout

In-progress design discussion (answers not yet locked in when this
slice was cut - resolve these first in the next session):
- Simultaneous-blind rounds (both players pick a corner/side at once,
  like Rock-Paper-Scissors) vs. turn-based reveal (shooter picks, then
  keeper picks, shown before the next kick).
- Best-of-5 kicks with sudden death on a tie (real shootout rules) vs.
  a simpler fixed-round format.

### ⏳ Not started - freesound.org sound effects + UI effects

## ✅ Fixed - DM toast notification + sound not appearing (this slice)

**Root cause #1 - toast/realtime never firing:** `postgres_changes`
realtime events are filtered server-side using the *websocket's own*
JWT for RLS, not the reader's cookies session directly - and that
token is only attached to the socket once
`supabase.auth.getSession()` resolves (it reads cookies, which is
async). `DmToastListener` mounts at the very root of
`(protected)/layout.tsx`, so `useDirectMessageRealtime`'s old code
called `.channel(...).subscribe()` synchronously in `useEffect`,
which usually won a race against session hydration on a fresh page
load. The socket then opened with no user token, `auth.uid()`
evaluated to `NULL` for the "view own direct messages" policy, and
`receiver_id = auth.uid()` matched nothing - **silently**: channel
status still logs `SUBSCRIBED` (that's just the topic join succeeding),
there's no error, and no `INSERT` event ever arrives. This exactly
matches log line (1) firing and log line (2) never firing in the
diagnostics that were added last slice.

Fix, in `hooks/use-direct-message-realtime.ts`: explicitly
`await supabase.auth.getSession()` and call
`supabase.realtime.setAuth(session.access_token)` *before*
`.channel(...).subscribe()`, plus an `onAuthStateChange` listener that
re-calls `setAuth` on token refresh (otherwise the same silent-drop
symptom would reappear ~1hr into a session when the access token
expires). Compounding factor fixed in `lib/supabase/client.ts`:
`createClient()` used to construct a brand-new `SupabaseClient` (and
therefore a brand-new GoTrueClient + Realtime client) on every call
site - `PresenceProvider`, `SoundProvider`,
`useDirectMessageRealtime`, every conversation page, etc. each had
their own copy racing to hydrate its own session independently. It's
now a module-level singleton, so there's exactly one session/socket to
keep in sync. This wasn't strictly required for the fix but removes a
"Multiple GoTrueClient instances" condition and closes the same race
for every other realtime hook in the app (`use-match-chat-realtime.ts`,
presence), even though those weren't touched otherwise per the
existing-games scope note.

**Root cause #2 - `message-received` sound never playing:**
`FREESOUND_API_KEY` was never actually set in `.env` (only documented
in `.env.example` as a placeholder). Every call to
`/api/sound/resolve` was throwing inside `freesound-client.ts`'s
`apiKey()` guard, `sound-manager.tsx`'s `resolveUrl()` catches that
and resolves `null`, and `play()` no-ops on a `null` URL - so every
sound effect (not just DM) was silently failing the exact same way.
Fixed by adding the real key to `.env` (kept out of `.env.example`,
which stays a placeholder for other environments/deploys).

**Not independently verified in this session** (no network access in
this container - `npm install` hit a registry 403, so `next build`
and `eslint` could not be run here): the actual live Freesound
response for each catalog query, and a real end-to-end DM send/receive
test. Recommended before calling this fully closed:
1. Run `npm install && npx next build && npx eslint .` in an
   environment with registry access.
2. Re-run the test protocol from last slice (recipient tab open,
   devtools console open, friend sends a DM) - all three
   `[useDirectMessageRealtime]` / `[DmToastListener]` log lines should
   now appear, and both the toast and the `message-received` sound
   should fire.
3. Once `FREESOUND_API_KEY` is confirmed live, eyeball what Freesound
   actually resolves for `message-received` and the rest of
   `effect-catalog.ts`'s queries and pin a `fallbackId` for any that
   drift from a good match - this was already flagged as open work
   before this bugfix slice and still applies.

## 🐛 Open bug - DM toast notification not appearing (superseded above)

Reported: recipient does not see a toast when a friend sends them a
DM. They only see the message if/when they navigate to the messages
page themselves (i.e. it's not being pushed live).

**Confirmed NOT the cause:**
- Not a "recipient's tab wasn't open" issue - confirmed the recipient's
  tab was already open and logged in at the moment the message was sent.
- Not a missing-publication issue - confirmed via
  `select schemaname, tablename from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'direct_messages';`
  returns the row, so `direct_messages` IS in the realtime publication
  on the live project (migration 048 was applied correctly).
- Fixed along the way (real bug, but probably not THE bug): `@keyframes
  toast-in` was referenced by `toast-provider.tsx`
  (`animate-[toast-in_0.2s_ease-out]`) but never defined anywhere in
  `app/globals.css`. Now added. Cosmetic only - Tailwind silently
  no-ops an unknown arbitrary animation name rather than hiding the
  element, so this alone would not explain a fully invisible toast.

**Diagnostics added, NOT YET USED (do this first in the next session):**
`hooks/use-direct-message-realtime.ts` and
`components/messages/dm-toast-listener.tsx` now have `console.log`s at
every stage of the chain:
1. `[useDirectMessageRealtime] channel status for <id>: SUBSCRIBED` -
   logs on mount. If this never appears (or shows `CHANNEL_ERROR` /
   `TIMED_OUT` instead), the channel itself never opened - check RLS
   next (the `"view own direct messages"` select policy in
   `048_direct_messages.sql`), and double check **Database →
   Replication** in the Supabase dashboard has `direct_messages`
   toggled on there too - some Supabase versions keep this as a
   separate switch from `pg_publication_tables` membership even though
   logically it should be redundant.
2. `[useDirectMessageRealtime] INSERT received: {...}` - logs the
   instant a matching row is inserted. If (1) logged `SUBSCRIBED` but
   this never fires when a real message is sent, the row isn't
   reaching the client - RLS is the top suspect (the receiver's JWT
   might not be evaluating `auth.uid() = receiver_id` correctly over
   the realtime websocket the same way it does over a normal
   `supabase.from(...).select()` call - worth testing directly with
   the Supabase Realtime inspector/logs if the dashboard has one).
3. `[DmToastListener] handling incoming DM, about to push toast: <id>`
   - logs right before `pushToast(...)` is called. If (2) fired but
     this doesn't, the bug is in `DmToastListener` itself (e.g. it's
     not actually mounted in the tree for the recipient's session -
     double check the `{user && <DmToastListener userId={user.id} />}`
     line in `app/(protected)/layout.tsx` is actually rendering, e.g.
     `user` isn't null). If ALL THREE log, but nothing is visually
     seen, the bug is downstream in `ToastProvider`'s render
     (`components/ui/toast-provider.tsx`) - check z-index stacking
     against other fixed-position elements (`SupportChatWidget`,
     `Sidebar` on mobile), and check the toast div's computed
     styles/opacity in devtools while it should be on screen.

**Test protocol for next session:** have the recipient open the app
with devtools console open and logged in, have a friend send them a
message, and report back exactly which of the 3 log lines above
appeared and which didn't - that determines which of RLS / component
mounting / CSS rendering to fix. Do not guess-fix without that
information; the point of the added logging is to make this
deterministic instead of trial-and-error.



The existing games are explicitly out of scope for this - see the
scope note above. This is purely additive infrastructure for games
that don't exist yet.

1. **Scaffold + Penalty Shootout as the first game.** Add a
   `lib/boardgame/` folder with: a `Game` definition, a thin
   `Client`-wrapped React board component, and a server-authoritative
   move-validation bridge so boardgame.io's client-side state is never
   trusted for money-moving outcomes (moves still get validated/settled
   via a Postgres RPC the same way every existing game does - see rule
   #1 in the very first continuation brief this project has been using:
   *never persist match/wallet state without a SECURITY DEFINER RPC*).
   Lock in the two open design questions above before building.
2. **Additional new games** on the same pattern, each its own slice,
   as they come up - e.g. Connect Four, a simple card game. No fixed
   list yet.

## Next: freesound.org + UI effects plan

1. Add `FREESOUND_API_KEY` to `.env.example`, a small
   `lib/sound/freesound-client.ts` wrapper, and an API route that
   proxies search/download (never expose the API key to the browser).
2. A small `lib/sound/sound-manager.ts` (or a React context) for
   playing cached effect clips (move, win, lose, message-received,
   button-tap) without re-fetching from Freesound on every play.
3. Wire sound triggers into: match moves, match end (win/lose/draw),
   the new DM toast, deposit/withdrawal success.
4. UI effects: confetti/pulse on a win, subtle haptic-style button
   press animations, etc. - lower priority, do last.

## Handoff prompt

If a session runs out of room mid-slice, use this prompt verbatim in a
fresh session (with the most recently delivered zip attached):

> Continue work on the Lucky Jambo project (attached zip). Read
> `docs/phase-9-notes.md` first - it has the full plan and exactly
> what's done vs. not done. Pick up at the first unchecked item -
> right now that's the "Not yet wired" list under the sound-effects
> section (wiring `useMatchResultSound` + move sounds into the
> remaining 5 boards), then move on to the Penalty Shootout
> boardgame.io scaffold once that's done. Implement one slice, verify
> with `npm install` + `npx next build` + `npx eslint` (all must pass
> clean - if your environment has no network access, say so explicitly
> instead of skipping verification silently), zip the whole project
> (excluding node_modules/.next/.git), update `docs/phase-9-notes.md`
> with what you just finished, and deliver the zip before doing
> anything else. Repeat slice by slice.

## ✅ Fixed - Most sounds never played / dice-roll played several seconds late (this slice)

Root causes found and fixed:

1. **No server-side pre-warming ever ran.** `warmSoundCache()` existed
   in `sound-cache.ts` specifically for this purpose (its own doc
   comment says so) but nothing ever called it - no `instrumentation.ts`
   existed. Added one; it calls `warmSoundCache()` on server startup.
2. **No client-side prefetching either.** Every effect was purely lazy:
   first `play()` call did resolve-fetch + audio-download + play, all
   in sequence - exactly why a dice roll's sound trailed a few seconds
   behind the visual result. `SoundProvider` now prefetches every
   catalog effect in the background on mount; `play()` still falls back
   to on-demand resolution if a prefetch hasn't finished, so nothing
   regresses if that background fetch is slow.
3. **A failed search retried on every single play(), forever.** Negative
   results weren't cached at all. Now cached for 5 minutes so a bad
   moment doesn't get hammered on every attempt.
4. **A query with zero results had no fallback** - permanently silent
   for that effect. Added a same-request fallback to a simplified
   (first-word) query.
5. **Several effects were defined but never triggered anywhere**:
   `match-found`, `deposit-success`, `withdrawal-success`, generic
   `notification`. Wired `match-found` centrally in `game-client.tsx`
   (fires once on the real waiting→active transition, shared by every
   game type) and `deposit-success` centrally in `deposit-form.tsx`.
6. **Bigger gap found while fixing #5**: `notifications` rows
   (`notify_user()` has populated this table from all over the app for
   ages - match settled, withdrawal auto-processed, friend requests...)
   were never surfaced live at all, and had no realtime enabled
   (migration `055_realtime_notifications.sql`). Only DMs got a toast.
   Added `NotificationToastListener` (mirrors `DmToastListener`) so
   every existing `notify_user()` call site now shows a toast + plays
   either a specific sound (withdrawal/deposit/match-found, sniffed
   from the notification title) or the generic `notification` chime.

**Not done / worth a follow-up**: pinning `fallbackId`s in
`effect-catalog.ts` for a few effects once someone has manually vetted
specific Freesound sound IDs in the Freesound UI - more reliable than
any text search, first-word fallback included.
