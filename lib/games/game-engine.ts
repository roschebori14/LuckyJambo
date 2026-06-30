// GameEngine is now only used for client-side preview/validation.
// Actual resolution for all games happens server-side:
//   - Chess / Tic-Tac-Toe: /api/chess/move and /api/tictactoe/move
//   - Draughts:             /api/draughts/move  (Phase 9)
//   - RPS / Dice / CoinFlip: submit_instant_move() Postgres RPC
//
// This file is kept for any shared util that might be needed.

export { DraughtsEngine } from "./draughts-engine";
export { TicTacToeEngine } from "./tic-tac-toe-engine";
