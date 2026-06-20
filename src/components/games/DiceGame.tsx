'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';

interface Props {
  matchId: string;
  userId: string;
  isCreator: boolean;
  gameState: any;
}

const DICE_FACES = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

export default function DiceGame({ matchId, userId, isCreator, gameState }: Props) {
  const [myRoll, setMyRoll] = useState<number[] | null>(gameState?.rolls?.[userId] || null);
  const [opponentRoll, setOpponentRoll] = useState<number[] | null>(null);
  const [rolling, setRolling] = useState(false);
  const [animDice, setAnimDice] = useState([1, 1]);

  const opponentId = isCreator ? gameState?.opponent : gameState?.creator;

  useEffect(() => {
    if (gameState?.rolls) {
      if (gameState.rolls[userId]) setMyRoll(gameState.rolls[userId]);
      if (gameState.rolls[opponentId]) setOpponentRoll(gameState.rolls[opponentId]);
    }
  }, [gameState, userId, opponentId]);

  const myTotal = myRoll ? myRoll[0] + myRoll[1] : 0;
  const opponentTotal = opponentRoll ? opponentRoll[0] + opponentRoll[1] : 0;

  async function rollDice() {
    if (myRoll || rolling) return;
    setRolling(true);

    // Animate rolling
    const interval = setInterval(() => {
      setAnimDice([Math.ceil(Math.random() * 6), Math.ceil(Math.random() * 6)]);
    }, 80);

    await new Promise(r => setTimeout(r, 800));
    clearInterval(interval);

    const d1 = Math.ceil(Math.random() * 6);
    const d2 = Math.ceil(Math.random() * 6);
    const roll = [d1, d2];
    setMyRoll(roll);
    setAnimDice([d1, d2]);

    const existingRolls = gameState?.rolls || {};
    const newRolls = { ...existingRolls, [userId]: roll };
    const bothRolled = newRolls[gameState?.creator] && newRolls[gameState?.opponent];

    let winnerId: string | undefined;
    if (bothRolled) {
      const creatorTotal = newRolls[gameState.creator][0] + newRolls[gameState.creator][1];
      const opponentTotal = newRolls[gameState.opponent][0] + newRolls[gameState.opponent][1];
      if (creatorTotal > opponentTotal) winnerId = gameState.creator;
      else if (opponentTotal > creatorTotal) winnerId = gameState.opponent;
      // tie = draw
    }

    const newState = { ...gameState, rolls: newRolls, isDraw: bothRolled && !winnerId };

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
      if (winnerId === userId) toast.success('🏆 You rolled higher! You win!');
      else if (winnerId && winnerId !== userId) toast.error('😔 Opponent rolled higher.');
      else if (bothRolled && !winnerId) toast.info("🤝 It's a tie! Refunded.");
    } catch {
      toast.error('Roll failed');
    } finally {
      setRolling(false);
    }
  }

  const bothRolled = !!myRoll && !!opponentRoll;

  return (
    <div className="flex flex-col items-center gap-8">
      <div className="text-center">
        <p className="text-gray-400 text-sm mb-2">Roll two dice. Highest total wins!</p>
      </div>

      <div className="grid grid-cols-2 gap-8">
        {/* My roll */}
        <div className="text-center">
          <div className="text-xs text-gray-500 mb-3 uppercase tracking-wider">You</div>
          <div className="flex gap-3 justify-center mb-3">
            {(rolling ? animDice : myRoll || [1, 1]).map((d, i) => (
              <div key={i}
                className={`text-6xl transition-all duration-100 ${rolling ? 'animate-spin' : ''} ${myRoll ? 'opacity-100' : 'opacity-30'}`}>
                {DICE_FACES[d - 1]}
              </div>
            ))}
          </div>
          {myRoll && (
            <div className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">
              Total: {myTotal}
            </div>
          )}
        </div>

        {/* Opponent roll */}
        <div className="text-center">
          <div className="text-xs text-gray-500 mb-3 uppercase tracking-wider">Opponent</div>
          <div className="flex gap-3 justify-center mb-3">
            {(opponentRoll || [1, 1]).map((d, i) => (
              <div key={i} className={`text-6xl ${opponentRoll ? 'opacity-100' : 'opacity-20'}`}>
                {DICE_FACES[d - 1]}
              </div>
            ))}
          </div>
          {opponentRoll && (
            <div className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
              Total: {opponentTotal}
            </div>
          )}
          {!opponentRoll && <div className="text-sm text-yellow-400 animate-pulse">Waiting to roll…</div>}
        </div>
      </div>

      {!myRoll && (
        <button onClick={rollDice} disabled={rolling}
          className="btn-primary text-lg py-4 px-10 disabled:opacity-60">
          {rolling ? '🎲 Rolling...' : '🎲 Roll Dice!'}
        </button>
      )}

      {myRoll && !opponentRoll && (
        <div className="text-sm text-yellow-400 animate-pulse flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-yellow-400 animate-ping" />
          Waiting for opponent to roll...
        </div>
      )}

      {bothRolled && (
        <div className={`text-xl font-black px-6 py-3 rounded-xl ${
          myTotal > opponentTotal ? 'bg-green-500/20 text-green-400' :
          opponentTotal > myTotal ? 'bg-red-500/20 text-red-400' :
          'bg-blue-500/20 text-blue-400'
        }`}>
          {myTotal > opponentTotal ? '🏆 You Win!' : opponentTotal > myTotal ? '😔 You Lose' : '🤝 Draw!'}
        </div>
      )}
    </div>
  );
}
