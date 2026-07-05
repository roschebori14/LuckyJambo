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

## 🐛 Open bug - DM toast notification not appearing

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
