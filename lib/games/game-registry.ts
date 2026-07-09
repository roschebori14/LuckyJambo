// The GAME_REGISTRY has been replaced by the `games` DB table.
// Use /api/games/list to fetch games (reads from Supabase `games` table).
// Slugs: chess | draughts | tic-tac-toe | dice | rock_paper_scissors | coin_flip | battleship | snakes-ladders | four-in-a-row | dots-and-boxes | word-chain | ludo | eight-ball-pool
export const GAME_SLUGS = [
  "chess",
  "draughts",
  "tic-tac-toe",
  "dice",
  "rock_paper_scissors",
  "coin_flip",
  "battleship",
  "snakes-ladders",
  "four-in-a-row",
  "dots-and-boxes",
  "word-chain",
  "ludo",
  "eight-ball-pool",
] as const;
export type GameSlug = typeof GAME_SLUGS[number];
