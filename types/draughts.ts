export interface DraughtPiece {
  position: string;

  owner: string;

  king: boolean;
}

export interface DraughtMatch {
  id: string;

  player_one_id: string;

  player_two_id: string;

  winner_id?: string;

  created_at: string;
}
