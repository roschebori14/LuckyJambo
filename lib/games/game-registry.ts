// The GAME_REGISTRY has been replaced by the `games` DB table.
// Use /api/games/list to fetch games (reads from Supabase `games` table).
// Slugs: chess | draughts | tic-tac-toe | dice | rock_paper_scissors | coin_flip
export const GAME_SLUGS = [
  "chess",
  "draughts",
  "tic-tac-toe",
  "dice",
  "rock_paper_scissors",
  "coin_flip",
] as const;
export type GameSlug = typeof GAME_SLUGS[number];
