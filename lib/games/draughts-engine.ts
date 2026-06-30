// Draughts (English/American Checkers rules on 8x8 board)
// Board positions: 32 dark squares numbered 1-32 (row-major, left-to-right)
// Pieces: 'r'=red man, 'R'=red king, 'b'=black man, 'B'=black king
// Red moves down the board, Black moves up.
// Mandatory captures enforced. Multi-jump supported. Kings move backward.

export type DraughtsPiece = "r" | "R" | "b" | "B";
export type DraughtsBoard = Record<number, DraughtsPiece>;
export type DraughtsPlayer = "r" | "b";

export interface DraughtsMove {
  from: number;
  to: number;
  captures: number[];
}

export interface DraughtsState {
  board: DraughtsBoard;
  current_turn: DraughtsPlayer;
  winner: DraughtsPlayer | null;
  game_over: boolean;
  r_player_id: string | null;
  b_player_id: string | null;
}

function toRC(pos: number): [number, number] {
  const idx = pos - 1;
  const row = Math.floor(idx / 4);
  const col = (idx % 4) * 2 + (row % 2 === 0 ? 1 : 0);
  return [row, col];
}

function fromRC(row: number, col: number): number | null {
  if (row < 0 || row > 7 || col < 0 || col > 7) return null;
  if ((row + col) % 2 === 0) return null;
  const darkColIndex = row % 2 === 0 ? (col - 1) / 2 : col / 2;
  return row * 4 + darkColIndex + 1;
}

function pieceColor(piece: DraughtsPiece): DraughtsPlayer {
  return piece === "r" || piece === "R" ? "r" : "b";
}

function pieceDirs(piece: DraughtsPiece): [number, number][] {
  if (piece === "r") return [[1, -1], [1, 1]];
  if (piece === "b") return [[-1, -1], [-1, 1]];
  return [[1, -1], [1, 1], [-1, -1], [-1, 1]];
}

function stepsFrom(pos: number, piece: DraughtsPiece, board: DraughtsBoard): number[] {
  const [row, col] = toRC(pos);
  return pieceDirs(piece)
    .map(([dr, dc]) => fromRC(row + dr, col + dc))
    .filter((to): to is number => to !== null && !(to in board));
}

function jumpsFrom(
  pos: number,
  piece: DraughtsPiece,
  board: DraughtsBoard,
  captured: Set<number>,
  chainFrom: number,
): DraughtsMove[] {
  const [row, col] = toRC(pos);
  const results: DraughtsMove[] = [];

  for (const [dr, dc] of pieceDirs(piece)) {
    const midPos = fromRC(row + dr, col + dc);
    const landPos = fromRC(row + dr * 2, col + dc * 2);
    if (!midPos || !landPos) continue;
    if (captured.has(midPos)) continue;
    const midPiece = board[midPos];
    if (!midPiece || pieceColor(midPiece) === pieceColor(piece)) continue;
    if (board[landPos] !== undefined) continue;

    const newBoard: DraughtsBoard = { ...board };
    delete newBoard[midPos];
    delete newBoard[pos];
    newBoard[landPos] = piece;

    const newCaptured = new Set(captured).add(midPos);
    const further = jumpsFrom(landPos, piece, newBoard, newCaptured, chainFrom);

    if (further.length === 0) {
      results.push({ from: chainFrom, to: landPos, captures: [...newCaptured] });
    } else {
      results.push(...further);
    }
  }

  return results;
}

export class DraughtsEngine {
  static createGame(): DraughtsState {
    const board: DraughtsBoard = {};
    for (let i = 1; i <= 12; i++) board[i] = "b";
    for (let i = 21; i <= 32; i++) board[i] = "r";
    return { board, current_turn: "b", winner: null, game_over: false, r_player_id: null, b_player_id: null };
  }

  static getLegalMoves(state: DraughtsState): DraughtsMove[] {
    const { board, current_turn } = state;
    const mine = Object.entries(board)
      .filter(([, p]) => pieceColor(p) === current_turn)
      .map(([pos]) => Number(pos));

    const captures = mine.flatMap((pos) =>
      jumpsFrom(pos, board[pos], board, new Set(), pos)
    );
    if (captures.length > 0) return captures;

    return mine.flatMap((pos) =>
      stepsFrom(pos, board[pos], board).map((to) => ({ from: pos, to, captures: [] }))
    );
  }

  static makeMove(state: DraughtsState, move: DraughtsMove): DraughtsState {
    if (state.game_over) throw new Error("Game is over");

    const legal = DraughtsEngine.getLegalMoves(state);
    const isLegal = legal.some(
      (m) =>
        m.from === move.from &&
        m.to === move.to &&
        m.captures.length === move.captures.length &&
        m.captures.every((c) => move.captures.includes(c))
    );
    if (!isLegal) throw new Error("Illegal move");

    const board: DraughtsBoard = { ...state.board };
    const piece = board[move.from];
    delete board[move.from];
    for (const cap of move.captures) delete board[cap];

    const [landRow] = toRC(move.to);
    let promoted = piece;
    if (piece === "r" && landRow === 7) promoted = "R";
    if (piece === "b" && landRow === 0) promoted = "B";
    board[move.to] = promoted;

    const nextTurn: DraughtsPlayer = state.current_turn === "r" ? "b" : "r";
    const nextState: DraughtsState = { ...state, board, current_turn: nextTurn };
    const hasNextMoves = DraughtsEngine.getLegalMoves(nextState).length > 0;
    const winner: DraughtsPlayer | null = hasNextMoves ? null : state.current_turn;

    return { ...nextState, winner, game_over: winner !== null };
  }
}
