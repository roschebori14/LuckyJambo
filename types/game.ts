export type GameType =
  | "rock_paper_scissors"
  | "coin_flip"
  | "dice_duel"
  | "chess"
  | "draughts";
export interface Game {
  id: string;

  name: string;

  slug: string;

  type: GameType;

  min_stake: number;

  max_stake: number;

  active: boolean;

  created_at: string;
}
