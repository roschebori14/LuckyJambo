export interface ChessGameState {
  id: string;

  match_id: string;

  fen: string;

  pgn: string;

  current_turn: string;

  white_player_id: string;

  black_player_id: string;

  winner_id?: string;

  status: string;
}
