'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';

interface Props {
  matchId: string;
  userId: string;
  isCreator: boolean;
  gameState: any;
}

const PIECE_UNICODE: Record<string, string> = {
  wK:'♔',wQ:'♕',wR:'♖',wB:'♗',wN:'♘',wP:'♙',
  bK:'♚',bQ:'♛',bR:'♜',bB:'♝',bN:'♞',bP:'♟',
};

// Simple board representation - using FEN parsing
function fenToBoard(fen: string): (string | null)[][] {
  const rows = fen.split(' ')[0].split('/');
  return rows.map(row => {
    const cells: (string | null)[] = [];
    for (const ch of row) {
      if (/\d/.test(ch)) cells.push(...Array(+ch).fill(null));
      else cells.push(ch);
    }
    return cells;
  });
}

const INITIAL_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export default function ChessGame({ matchId, userId, isCreator, gameState }: Props) {
  const [fen, setFen] = useState<string>(gameState?.fen || INITIAL_FEN);
  const [selected, setSelected] = useState<[number,number] | null>(null);
  const [validMoves, setValidMoves] = useState<[number,number][]>([]);
  const [turn, setTurn] = useState<'w'|'b'>(gameState?.chessState?.turn || 'w');
  const [submitting, setSubmitting] = useState(false);
  const [Chess, setChess] = useState<any>(null);
  const [chess, setChessInstance] = useState<any>(null);

  // Dynamically load chess.js
  useEffect(() => {
    import('chess.js').then(mod => {
      const ChessClass = mod.Chess;
      setChess(() => ChessClass);
      const instance = new ChessClass(gameState?.fen || INITIAL_FEN);
      setChessInstance(instance);
      setTurn(instance.turn());
    });
  }, []);

  useEffect(() => {
    if (gameState?.fen && chess) {
      chess.load(gameState.fen);
      setFen(gameState.fen);
      setTurn(chess.turn());
    }
  }, [gameState, chess]);

  const board = fenToBoard(fen);
  const myColor = isCreator ? 'w' : 'b';
  const isMyTurn = turn === myColor;

  function getPiece(piece: string | null): string {
    if (!piece) return '';
    const color = piece === piece.toUpperCase() ? 'w' : 'b';
    const type = piece.toUpperCase();
    return PIECE_UNICODE[`${color}${type}`] || piece;
  }

  function squareToIndices(sq: string): [number,number] {
    const file = sq.charCodeAt(0) - 97;
    const rank = 8 - parseInt(sq[1]);
    return [rank, file];
  }

  function indicesToSquare(row: number, col: number): string {
    return String.fromCharCode(97 + col) + (8 - row);
  }

  function handleSquareClick(row: number, col: number) {
    if (!chess || !isMyTurn || submitting) return;

    const square = indicesToSquare(row, col);
    const piece = chess.get(square);

    if (selected) {
      const [sRow, sCol] = selected;
      const fromSq = indicesToSquare(sRow, sCol);
      
      // Try to make move
      const isValid = validMoves.some(([r,c]) => r===row && c===col);
      if (isValid) {
        makeMove(fromSq, square);
        setSelected(null);
        setValidMoves([]);
        return;
      }
    }

    // Select piece
    if (piece && ((myColor === 'w' && piece.color === 'w') || (myColor === 'b' && piece.color === 'b'))) {
      setSelected([row, col]);
      const moves = chess.moves({ square, verbose: true });
      setValidMoves(moves.map((m: any) => squareToIndices(m.to)));
    } else {
      setSelected(null);
      setValidMoves([]);
    }
  }

  async function makeMove(from: string, to: string) {
    if (!chess) return;
    setSubmitting(true);
    try {
      const move = chess.move({ from, to, promotion: 'q' });
      if (!move) { toast.error('Invalid move'); return; }

      const newFen = chess.fen();
      setFen(newFen);
      setTurn(chess.turn());

      const isCheckmate = chess.isCheckmate();
      const isDraw = chess.isDraw();
      const winnerId = isCheckmate ? userId : undefined;

      await fetch('/api/matches/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matchId,
          newGameState: { ...gameState, fen: newFen, isDraw },
          winnerId,
        }),
      });

      if (isCheckmate) toast.success('♟️ Checkmate! You win!');
      else if (isDraw) toast.info('🤝 Draw!');
    } catch {
      toast.error('Move failed');
    } finally {
      setSubmitting(false);
    }
  }

  const displayBoard = isCreator ? board : [...board].reverse().map(row => [...row].reverse());

  return (
    <div className="flex flex-col items-center gap-4">
      <div className={`text-sm font-medium px-4 py-2 rounded-full ${
        isMyTurn ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
      }`}>
        {isMyTurn ? '🟢 Your turn' : "⏳ Opponent's turn"} • Playing as {myColor === 'w' ? '♔ White' : '♚ Black'}
      </div>

      <div className="border-2 border-[#1e3a5f] rounded-lg overflow-hidden shadow-xl">
        {displayBoard.map((row, rowIdx) => (
          <div key={rowIdx} className="flex">
            {row.map((cell, colIdx) => {
              const actualRow = isCreator ? rowIdx : 7 - rowIdx;
              const actualCol = isCreator ? colIdx : 7 - colIdx;
              const isLight = (actualRow + actualCol) % 2 === 0;
              const isSelected = selected?.[0] === actualRow && selected?.[1] === actualCol;
              const isValid = validMoves.some(([r,c]) => r === actualRow && c === actualCol);
              return (
                <button key={colIdx}
                  onClick={() => handleSquareClick(actualRow, actualCol)}
                  className={`w-9 h-9 md:w-12 md:h-12 flex items-center justify-center text-xl md:text-2xl transition-colors relative
                    ${isLight ? 'bg-[#4a7c9e]/40' : 'bg-[#1e3a5f]/80'}
                    ${isSelected ? 'bg-yellow-400/40' : ''}
                    ${isValid ? 'bg-green-400/30' : ''}
                    hover:brightness-125`}>
                  {isValid && !cell && <span className="absolute w-3 h-3 rounded-full bg-green-400/60" />}
                  {cell ? getPiece(cell) : ''}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <div className="text-xs text-gray-500 text-center">
        Click a piece to see valid moves, then click destination
      </div>
    </div>
  );
}
