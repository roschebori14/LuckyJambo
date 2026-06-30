// Tic Tac Toe game engine
// Board: 9-cell array, indices 0-8 (row-major: 0=top-left, 8=bottom-right)
// Cell values: null (empty), 'X', or 'O'

export type TicCell = "X" | "O" | null;
export type TicBoard = [
  TicCell, TicCell, TicCell,
  TicCell, TicCell, TicCell,
  TicCell, TicCell, TicCell,
];
export type TicPlayer = "X" | "O";

export interface TicState {
  board: TicBoard;
  current_turn: TicPlayer;
  winner: TicPlayer | null;
  is_draw: boolean;
  game_over: boolean;
}

const WIN_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // cols
  [0, 4, 8], [2, 4, 6],             // diagonals
];

export class TicTacToeEngine {
  static createGame(): TicState {
    return {
      board: [null, null, null, null, null, null, null, null, null],
      current_turn: "X",
      winner: null,
      is_draw: false,
      game_over: false,
    };
  }

  static makeMove(state: TicState, cellIndex: number): TicState {
    if (state.game_over) {
      throw new Error("Game is already over");
    }
    if (cellIndex < 0 || cellIndex > 8) {
      throw new Error("Cell index must be 0–8");
    }
    if (state.board[cellIndex] !== null) {
      throw new Error("Cell is already occupied");
    }

    const newBoard = [...state.board] as TicBoard;
    newBoard[cellIndex] = state.current_turn;

    const winner = TicTacToeEngine.detectWinner(newBoard);
    const is_draw = !winner && newBoard.every((c) => c !== null);

    return {
      board: newBoard,
      current_turn: state.current_turn === "X" ? "O" : "X",
      winner: winner ?? null,
      is_draw,
      game_over: !!winner || is_draw,
    };
  }

  static detectWinner(board: TicBoard): TicPlayer | null {
    for (const [a, b, c] of WIN_LINES) {
      if (board[a] && board[a] === board[b] && board[a] === board[c]) {
        return board[a] as TicPlayer;
      }
    }
    return null;
  }

  static getLegalMoves(state: TicState): number[] {
    if (state.game_over) return [];
    return state.board.reduce<number[]>((acc, cell, i) => {
      if (cell === null) acc.push(i);
      return acc;
    }, []);
  }
}
