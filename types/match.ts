export type MatchStatus =
  | "waiting"
  | "matched"
  | "active"
  | "completed"
  | "cancelled";

export interface Match {
  id: string;

  creator_id: string;

  opponent_id?: string;

  game_id: string;

  stake_amount: number;

  status: MatchStatus;

  winner_id?: string;

  created_at: string;

  updated_at: string;
}

export interface CreateMatchInput {
  game_id: string;

  stake_amount: number;
}
