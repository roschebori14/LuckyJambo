'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';

interface Props {
  matchId: string;
  userId: string;
  isCreator: boolean;
  gameState: any;
}

function checkWinner(board: (string | null)[]): string | null {
  const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  for (const [a,b,c] of lines) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
  }
  return null;
}

export default function TicTacToeGame({ matchId, userId, isCreator, gameState }: Props) {
  const [board, setBoard] = useState<(string | null)[]>(gameState?.board || Array(9).fill(null));
  const [turn, setTurn] = useState<string>(gameState?.turn || gameState?.creator);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (gameState?.board) setBoard(gameState.board);
    if (gameState?.turn) setTurn(gameState.turn);
  }, [gameState]);

  const mySymbol = isCreator ? 'X' : 'O';
  const opponentSymbol = isCreator ? 'O' : 'X';
  const isMyTurn = turn === userId;
  const winner = checkWinner(board);
  const isDraw = !winner && board.every(Boolean);

  async function handleClick(idx: number) {
    if (!isMyTurn || board[idx] || winner || isDraw || submitting) return;
    setSubmitting(true);

    const newBoard = [...board];
    newBoard[idx] = mySymbol;
    const newWinner = checkWinner(newBoard);
    const newDraw = !newWinner && newBoard.every(Boolean);
    const opponent = isCreator ? gameState?.opponent : gameState?.creator;
    const nextTurn = opponent;

    const newState = {
      ...gameState,
      board: newBoard,
      turn: nextTurn,
      isDraw: newDraw,
    };

    setBoard(newBoard);
    setTurn(nextTurn);

    try {
      await fetch('/api/matches/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matchId,
          newGameState: newState,
          winnerId: newWinner ? userId : undefined,
        }),
      });
      if (newWinner) toast.success('🏆 You won!');
      else if (newDraw) toast.info("It's a draw! Stakes refunded.");
    } catch {
      toast.error('Move failed');
    } finally {
      setSubmitting(false);
    }
  }

  const statusMsg = winner
    ? (winner === mySymbol ? '🏆 You won!' : '😔 You lost')
    : isDraw ? "🤝 Draw! Stakes refunded."
    : isMyTurn ? '🟢 Your turn' : '⏳ Opponent\'s turn';

  return (
    <div className="flex flex-col items-center gap-6">
      <div className={`text-sm font-medium px-4 py-2 rounded-full ${
        winner ? (winner === mySymbol ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400')
        : isDraw ? 'bg-blue-500/20 text-blue-400'
        : isMyTurn ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
      }`}>
        {statusMsg}
      </div>

      <div className="flex items-center gap-4 text-sm text-gray-400">
        <div className="flex items-center gap-2">
          <span className="font-black text-white text-lg">X</span>
          <span>{isCreator ? 'You' : 'Opponent'}</span>
        </div>
        <span>vs</span>
        <div className="flex items-center gap-2">
          <span className="font-black text-blue-400 text-lg">O</span>
          <span>{isCreator ? 'Opponent' : 'You'}</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 w-fit">
        {board.map((cell, i) => (
          <button
            key={i}
            onClick={() => handleClick(i)}
            disabled={!!cell || !isMyTurn || !!winner || isDraw || submitting}
            className={`w-24 h-24 md:w-28 md:h-28 rounded-xl text-4xl md:text-5xl font-black transition-all duration-150 border-2
              ${cell === 'X' ? 'text-white border-white/30 bg-white/5' :
                cell === 'O' ? 'text-blue-400 border-blue-400/30 bg-blue-400/5' :
                isMyTurn && !winner && !isDraw
                  ? 'border-[#1e3a5f] bg-[#0d1b3e] hover:border-blue-500/50 hover:bg-blue-500/10 cursor-pointer'
                  : 'border-[#1e3a5f] bg-[#0d1b3e] cursor-not-allowed'
              }`}
          >
            {cell || ''}
          </button>
        ))}
      </div>

      <div className="text-xs text-gray-500">
        You are <strong className={isCreator ? 'text-white' : 'text-blue-400'}>{mySymbol}</strong>
      </div>
    </div>
  );
}
