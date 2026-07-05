# Lucky Jambo Phase 9

## Goal

Three big, mostly-independent workstreams requested together:
1. Migrate the game engine to `boardgame.io` and use it for new games and
   to enhance the existing ones.
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
used anywhere** - no game has been migrated or built with it yet. See
"Next: boardgame.io migration" below for the concrete plan.

### ⏳ Not started - boardgame.io migration/new games

### ⏳ Not started - freesound.org sound effects + UI effects

## Next: boardgame.io migration plan

Recommended order (each is its own slice/zip):

1. **Scaffold + one new game as the template.** Add a
   `lib/boardgame/` folder with: a `Game` definition, a thin
   `Client`-wrapped React board component, and a server-authoritative
   move-validation bridge so boardgame.io's client-side state is never
   trusted for money-moving outcomes (moves still get validated/settled
   via a Postgres RPC the same way every existing game does - see rule
   #1 in the very first continuation brief this project has been using:
   *never persist match/wallet state without a SECURITY DEFINER RPC*).
   Picking a **new, currently-unbuilt game** (e.g. Connect Four, or a
   simple card game) as this template avoids risking a currently-working
   real-money game while the pattern is worked out.
2. **Migrate one existing, simple game** (tic-tac-toe is the smallest
   board) onto the same boardgame.io pattern, side by side with the
   current implementation behind a feature check, so it can be rolled
   back instantly if anything regresses.
3. **Migrate the rest** (draughts, chess, battleship, snakes & ladders)
   one at a time, each its own slice.
4. Once all are migrated, remove the old per-game board components and
   RPCs that are no longer used.

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
> what's done vs. not done. Pick up at the first unchecked item and
> keep going: implement one slice, verify with `npm install` + `npx
> next build` + `npx eslint` (all must pass clean), zip the whole
> project (excluding node_modules/.next/.git), update
> `docs/phase-9-notes.md` with what you just finished, and deliver the
> zip before doing anything else. Repeat slice by slice.
