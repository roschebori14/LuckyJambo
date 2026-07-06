# Lucky Jambo Phase 10 — Word Chain

## Goal

Build the "Word Game" slot from `docs/lucky-jambo-new-games-roadmap.md`
(item 4 in the build order), following the exact same headless-
boardgame.io pattern Four in a Row and Dots and Boxes already
established: `Game` definition = pure turn/win-condition state machine,
run headlessly per-request in a Next.js API route, persisted +
settled through a `SECURITY DEFINER` Postgres RPC - Supabase stays the
only realtime/source-of-truth path, boardgame.io never runs its own
multiplayer transport.

## Design decisions made this slice

**Concrete game chosen: "Word Chain" (Shiritori-style).** The roadmap
only said "Word Game (iMessage-style)... first game needing a
dictionary/word list". Two real candidates fit "iMessage-style word
game": GamePigeon's Boggle-style "Word Hunt" (find words on a shared
letter grid, simultaneous/real-time, most words wins), or a turn-based
word chain. The roadmap explicitly says this game is "still fully
turn-based" - Word Hunt is inherently simultaneous, so it was ruled
out. Word Chain fits perfectly: strictly turn-based, needs real
dictionary validation, and needs zero grid/tile-geometry UI work,
which matters a lot for build speed. Rules: players alternate
submitting a word; each word must start with the last letter of the
previous word, must be a real dictionary word, and must not already be
used in this match.

**"3 strikes" instead of a timer, as the decisive-outcome mechanism.**
Every other turn-based game here reaches a natural terminal state
(checkmate, full board, 4-in-a-row, etc.) with no per-move clock -
players resign via the existing shared `MatchActions` component if
they get stuck. Word Chain has no natural terminal state (the chain
could run forever), and "just resign if you're stuck" isn't a strong
enough guarantee of a decisive outcome for a real-money match. So: each
player gets 3 strikes (wrong starting letter / not a real word /
already used). An invalid attempt costs a strike but does **not** pass
the turn - same player, same required letter, tries again immediately,
up to 3 strikes. Hit 3 and you lose outright. No draw is reachable by
design (unlike Four in a Row / Dots and Boxes), so there's no
`refund_draw` branch in this game's settlement RPC.

**Dictionary source.** No network access in this build environment to
fetch a real word-list API/file, but the container already ships
`hunspell-en-us` as a system package (`/usr/share/hunspell/en_US.dic`).
Extracted just the headwords (stripped the `/AFFIX_FLAGS` suffix hunspell
uses, dropped anything not `[a-z]{3,15}` or that started with a capital
letter in the source file, i.e. proper nouns) into
`lib/games/word-chain/wordlist.txt` - 61,090 words. This is root/
headwords only, not the full hunspell-affix-expanded inflection set
(no `unmunch` binary available to expand `.aff` rules), which is
actually fine and arguably preferable for this game - avoids odd
expanded forms while still covering a huge, genuinely English
vocabulary. If a real player hits a legitimate word missing from the
list, it's a one-line addition to `wordlist.txt`, no migration needed.

## What was built (mirrors Four in a Row / Dots and Boxes file-for-file)

- `lib/games/word-chain/wordlist.txt` - the dictionary (server-side only).
- `lib/games/word-chain/game.ts` - pure boardgame.io `Game` definition.
  Only knows "was this word valid or not" (a boolean it's handed) and
  what that does to turn/strikes/chain/winner - no dictionary/file I/O
  in here, by design (same separation of concerns as chess.js vs. the
  chess engine wrapper).
- `lib/games/word-chain/engine.ts` - headless runner. Loads the
  dictionary once (module-level cache), does the actual
  letter-match / dictionary / already-used checks, calls the Game's
  `submitWord` move with the computed verdict, maps the result back to
  the Supabase persistence shape. Exports `createInitialState`,
  `applySubmitWord`, `WordChainRulesError`.
- `types/word-chain.ts` - `WordChainState` + `WordChainMoveResult`.
- `supabase/migrations/053_word_chain.sql` - extends `create_match` /
  `join_match` (full function bodies, all existing branches preserved)
  with the word-chain branch, adds
  `apply_word_chain_move_result(...)` (optimistic concurrency via
  `p_expected_chain`, settles via `settle_match` - no draw path),
  registers the `games` row.
- `app/api/word-chain/{create,move,state}/route.ts` - same shape as
  the four-in-a-row routes. Note: `/create` mirrors an existing
  pattern but, like the four-in-a-row/dots-and-boxes equivalents, isn't
  actually called anywhere in the UI - the lobby page always calls the
  generic `/api/matches/create`, which already works for every slug
  because `create_match` itself seeds the right initial state. Kept
  for parity/consistency with the established per-game route set, not
  because anything currently calls it.
- `components/games/word-chain-board.tsx` - polling (3s) + realtime
  (`useMatchRealtime`) board, chain history as chips, per-player strike
  dots, turn-aware input box that shows the required starting letter,
  inline rejection reason on a failed submission. Wired into
  `useSound`/`play("move")` on an accepted word, a new
  `play("word-rejected")` on a strike, and `useMatchResultSound` for
  win/lose - same convention Dots and Boxes already established.
  Confetti was **not** wired in - it's still only on
  `instant-game-board.tsx` per the still-open phase-9 TODO to extend it
  to every other board; this game didn't jump ahead of that queue.
- `lib/sound/effect-catalog.ts` - added `word-rejected`.
- Visual assets (the "logo like other games" requirement):
  `public/images/word-chain.png` (1024x1024, same dark-vignette +
  title-text + centerpiece-object treatment as `dice.png`/
  `four-in-a-row.png` - three chained letter tiles spelling "CATS"),
  `WordChainIcon` in `components/games/game-icons.tsx` registered in
  `GAME_ICON`, and a `GAME_META` entry in `components/games/game-card.tsx`
  (Turn-based badge, indigo background).
- `app/(protected)/games/[id]/match/[matchId]/game-client.tsx` - added
  the dynamic import + board-switch case.
- `lib/games/game-registry.ts` - this file's `GAME_SLUGS`/comment is
  unused dead code (confirmed - nothing imports it; the real game list
  comes from the `games` DB table via `/api/games/list`) but was left
  stale by the Four in a Row / Dots and Boxes slices too. Updated it to
  list all 11 current slugs for accuracy since it reads as
  documentation even though nothing depends on it.

## Not independently verified in this session

No network access in this container - couldn't run
`npm install && npx next build && npx eslint .`, so none of this
TypeScript/SQL has been run against a real compiler or a real Postgres
instance. Specifically worth checking before calling this closed:

1. `npx tsc --noEmit` - the boardgame.io `Game<WordChainG>` typing and
   the `as never` context-cast trick (copied verbatim from
   `four-in-a-row/engine.ts`, which the project's own notes say *was*
   verified in an earlier session) should hold, but hasn't been
   re-checked against this specific Game shape.
2. Run `053_word_chain.sql` against a real Supabase instance (or
   `supabase db reset` locally) and confirm it applies cleanly on top
   of 050/051/052.
3. Two-browser manual playtest per the roadmap's own QA checklist item
   11: start a match, play a full chain, deliberately trigger all 3
   strike types (wrong letter, made-up word, repeat word) as both
   seats, confirm a 3-strike loss actually settles the match (wallet
   debit/credit), confirm reload/reconnect mid-match restores state
   correctly (the `/state` + polling + realtime combo should handle
   this the same way it does for every other game, but hasn't been
   watched happen live).
4. `fs.readFileSync(path.join(process.cwd(), "lib/games/word-chain/wordlist.txt"))`
   in `engine.ts` reads a literal, static path, which Next.js's
   deployment file-tracing should pick up automatically - but this is
   worth confirming on whatever hosting platform this actually deploys
   to (Vercel or otherwise), since a dictionary silently failing to
   load in production would make every single word submission come
   back "not in the dictionary."
5. Eyeball `public/images/word-chain.png` next to the other game
   banners at actual card size (not just full-res) - it was built with
   local PIL/ImageMagick (no image-gen model access in this
   environment), following the same layout formula as the existing
   banners, not generated the same way the original set likely was.

## Next up

Per the roadmap: **Gomoku** (bigger board, same shape as Four in a
Row), then **Penalty Shootout** (first skill game - see the
architecture note in the roadmap about server-checked
randomness/physics seeds for the aim+power skill games, items 5-7).
