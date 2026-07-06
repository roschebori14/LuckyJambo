# Lucky Jambo — New Games Roadmap

## Current state (confirmed from the codebase)
- `boardgame.io` (`^0.50.2`) is installed but **not used anywhere yet**.
- All 8 existing games are hand-rolled: a Next.js API route holds authoritative
  state in Supabase (`matches` / per-game state), the client polls +
  subscribes via `useMatchRealtime`, and each board is its own React
  component wired into `game-client.tsx`.
- Sound (`lib/sound`), stake/wallet, resign/forfeit/withdraw, spectating,
  rematch, and confetti-on-win are all shared infra any new game can plug into.

## Architecture decision (before writing game #1)
Run boardgame.io **headlessly as the rules engine only** — its `Game`
definition (`moves`, `turn`, `endIf`) called server-side inside the API
route to validate a move and produce the next `G`/`ctx`, which then gets
persisted to Supabase exactly like chess/draughts do today. We do **not**
stand up boardgame.io's own multiplayer server/socket transport — that
would fight with the Supabase-realtime pattern already powering every
other game, wallet, chat, and spectating. This keeps one source of truth
(Supabase) and one realtime path, with boardgame.io just supplying clean,
tested turn/win-condition logic instead of us hand-rolling it per game.

For the 4 skill games, boardgame.io still owns turn order + score + shots
remaining; the aim/power interaction is a custom client component whose
*result* (hit/miss, pocket, goal/save) is submitted as a boardgame.io move
and re-checked server-side against server-generated randomness/physics
seeds — never trusting a client-reported "I scored."

## Per-game checklist (repeat for each game, in order)
1. **Design** — rules, win/draw condition, turn structure, instant vs
   turn-based classification (affects `GAME_META` type badge), stake/payout
   and refund-on-draw logic. For skill games: define exactly what data the
   client submits as a "move" and how the server re-validates it.
2. **Database** — `supabase/migrations/0XX_<game>.sql`: row in `games`
   table (slug, name, description, min/max stake), game-state shape, RLS
   mirroring existing games.
3. **Types** — `types/<game>.ts` (mirror `types/battleship.ts`).
4. **Rules engine** — `lib/games/<game>/game.ts`: boardgame.io `Game`
   definition + a thin server-side wrapper that runs it headlessly, matching
   the shape of the existing `app/api/chess/move` handler.
5. **API routes** — `app/api/<game>/state`, `app/api/<game>/move` (or
   `/shoot`, `/roll`, etc.), following existing per-game route naming.
6. **Board component** — `components/games/<game>-board.tsx`, wired into
   `game-client.tsx`'s dynamic-import map and instant/turn-based routing.
7. **Realtime** — confirm `useMatchRealtime` row payload carries this
   game's state; add the case to `game-client.tsx`.
8. **Sound** — reuse the existing catalog (`move`, `dice-roll`,
   `coin-flip`, `button-tap`, `match-win/lose/draw`) wherever it fits;
   add any genuinely new effect (e.g. `goal-scored`, `pocket-sink`,
   `arrow-hit`) to `effect-catalog.ts` the same way the current ones are
   defined.
9. **Visual assets** (this is the "logos like other games" ask):
   - `public/images/<slug>.png` — card cover art, same treatment as
     `chess.png` / `battleship.png`.
   - `components/games/game-icons.tsx` — new hand-drawn SVG icon,
     registered in `GAME_ICON`.
   - `components/games/game-card.tsx` — new entry in `GAME_META`
     (Turn-based/Instant badge + background color).
10. **Wallet/stake wiring** — min/max stake, draw-refund logic matches
    whether this game can actually draw.
11. **QA pass** — two-browser manual playtest, reload/reconnect mid-game,
    resign/forfeit/withdraw flows, mobile layout, `tsc --noEmit` clean,
    confirm sound + confetti + win/lose UI all fire.

Each game gets built, tested, and merged before the next one starts — no
parallel half-finished games.

## Build order
1. ✅ **Four in a Row (Connect 4)** — done.
2. ✅ **Dots and Boxes** — done.
3. ⏭️ **Gomoku** — not started, deferred (see below - Word Chain was
   pulled ahead of it to build next after Dots and Boxes; Gomoku is
   still queued after Word Chain).
4. ✅ **Word Game — built as "Word Chain"** (see
   `docs/phase-10-notes.md` for the full slice writeup). Concrete
   design chosen for this slot: turn-based Shiritori/word-chain style
   (each player's word must start with the last letter of the
   opponent's previous word; a word must be a real, unused dictionary
   word). This satisfies the roadmap's "first game needing a
   dictionary/word list and word-validation; still fully turn-based"
   requirement with the smallest surface area that's genuinely
   competitive - no grid/tile geometry, no real-time/simultaneous
   component (ruled out an iMessage-GamePigeon-style Boggle/"Word
   Hunt" clone specifically because that's simultaneous-real-time, not
   turn-based). See phase-10-notes.md for the "3 strikes, no timer"
   decisive-outcome design and why.
5. **Penalty Shootout** — first skill game, still next up after Gomoku.
6. **Archery** — not started.
7. **Cup Pong** — not started.
8. **8-Ball Pool** — not started, last on purpose.

---

## Phase 2 — enhance existing games (after all 8 ship)
- Wire up the sound effects that are already defined but unused:
  `match-found`, `notification`, `deposit-success`, `withdrawal-success`.
- Piece-slide / dice-tumble animations for Chess, Draughts, Snakes & Ladders
  instead of instant state snaps.
- Per-game leaderboards (the RPC infra for leaderboards already exists —
  extend it to break down by game, not just globally).
- Practice/AI opponent mode for the turn-based games (there's already an
  `ai` components dir and AI chat log table to build on).
- Colorblind-friendly move/selection highlighting for Chess/Draughts.
- Turn-reminder push notifications for slow turn-based matches.
- Mobile drag-and-drop polish for Chess/Draughts (tap-to-move already
  exists as a fallback — worth auditing drag feel on small screens).
- Reconnect/resilience audit across all games (mirror the pattern already
  used in `instant-game-board.tsx`'s mount-time state restore).

---

**Next step:** confirm this order and the architecture approach, then we
start Four in a Row — migration first, then the boardgame.io rules engine,
then board + assets + sound, then QA, before moving to Dots and Boxes.
