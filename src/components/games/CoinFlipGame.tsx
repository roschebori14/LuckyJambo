'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';

interface Props {
  matchId: string;
  userId: string;
  isCreator: boolean;
  gameState: any;
}

export default function CoinFlipGame({ matchId, userId, isCreator, gameState }: Props) {
  const [choice, setChoice] = useState<'heads' | 'tails' | null>(gameState?.choices?.[userId] || null);
  const [result, setResult] = useState<string | null>(gameState?.result || null);
  const [flipping, setFlipping] = useState(false);

  const opponentId = isCreator ? gameState?.opponent : gameState?.creator;
  const opponentChoice: string | null = gameState?.choices?.[opponentId] || null;
  const bothChose = !!choice && !!opponentChoice;

  useEffect(() => {
    if (gameState?.choices?.[userId]) setChoice(gameState.choices[userId]);
    if (gameState?.result) setResult(gameState.result);
  }, [gameState, userId]);

  async function pick(side: 'heads' | 'tails') {
    if (choice || flipping) return;
    setChoice(side);
    setFlipping(true);

    const existingChoices = gameState?.choices || {};
    const newChoices = { ...existingChoices, [userId]: side };
    const bothChoseNow = newChoices[gameState?.creator] && newChoices[gameState?.opponent];

    let newResult = gameState?.result;
    let winnerId: string | undefined;

    if (bothChoseNow) {
      newResult = Math.random() < 0.5 ? 'heads' : 'tails';
      setResult(newResult);
      const creatorChoice = newChoices[gameState.creator];
      const opponentChoice = newChoices[gameState.opponent];
      if (creatorChoice === newResult) winnerId = gameState.creator;
      else if (opponentChoice === newResult) winnerId = gameState.opponent;
      // If both same choice = same result, that means both win - treat as draw? 
      // Actually only one result matters: who picked correctly
    }

    const newState = {
      ...gameState,
      choices: newChoices,
      result: newResult,
    };

    await new Promise(r => setTimeout(r, 600));

    try {
      await fetch('/api/matches/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matchId,
          newGameState: newState,
          winnerId,
        }),
      });
      if (bothChoseNow) {
        if (winnerId === userId) toast.success(`🪙 ${newResult?.toUpperCase()}! You win!`);
        else if (winnerId && winnerId !== userId) toast.error(`🪙 ${newResult?.toUpperCase()}! You lose.`);
        else toast.info("Both picked the same! It's a draw.");
      }
    } catch {
      toast.error('Failed to register pick');
    } finally {
      setFlipping(false);
    }
  }

  const myWon = result && choice && choice === result;
  const myLost = result && choice && choice !== result;

  return (
    <div className="flex flex-col items-center gap-8">
      <div className="text-center">
        <div className="text-8xl mb-4 animate-bounce">🪙</div>
        <h3 className="text-xl font-bold mb-2">Call Heads or Tails</h3>
        <p className="text-gray-400 text-sm">The coin decides the winner!</p>
      </div>

      {!choice && (
        <div className="flex gap-4">
          <button onClick={() => pick('heads')}
            className="w-36 h-36 rounded-2xl gradient-primary flex flex-col items-center justify-center gap-2 text-white font-black text-lg hover:scale-105 transition-all duration-200 shadow-lg shadow-blue-500/30">
            <span className="text-4xl">👑</span>
            HEADS
          </button>
          <button onClick={() => pick('tails')}
            className="w-36 h-36 rounded-2xl bg-gradient-to-br from-purple-600 to-purple-800 flex flex-col items-center justify-center gap-2 text-white font-black text-lg hover:scale-105 transition-all duration-200 shadow-lg shadow-purple-500/30">
            <span className="text-4xl">🌀</span>
            TAILS
          </button>
        </div>
      )}

      {choice && (
        <div className="text-center space-y-4">
          <div className="flex items-center gap-3 justify-center">
            <div className="card px-6 py-4 text-center">
              <div className="text-xs text-gray-500 mb-1">Your pick</div>
              <div className="text-2xl font-black capitalize">{choice === 'heads' ? '👑 Heads' : '🌀 Tails'}</div>
            </div>
            {opponentChoice && (
              <>
                <span className="text-gray-500">vs</span>
                <div className="card px-6 py-4 text-center">
                  <div className="text-xs text-gray-500 mb-1">Opponent</div>
                  <div className="text-2xl font-black capitalize">{opponentChoice === 'heads' ? '👑 Heads' : '🌀 Tails'}</div>
                </div>
              </>
            )}
          </div>

          {!opponentChoice && (
            <div className="text-sm text-yellow-400 animate-pulse flex items-center justify-center gap-2">
              <span className="w-2 h-2 rounded-full bg-yellow-400 animate-ping" />
              Waiting for opponent to pick...
            </div>
          )}

          {result && (
            <div className="space-y-3">
              <div className="text-center">
                <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Result</div>
                <div className="text-4xl font-black">{result === 'heads' ? '👑 HEADS' : '🌀 TAILS'}</div>
              </div>
              <div className={`text-xl font-black px-8 py-3 rounded-xl ${
                myWon ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
              }`}>
                {myWon ? '🏆 You Win!' : '😔 You Lose'}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
