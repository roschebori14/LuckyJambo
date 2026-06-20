'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { formatCurrency, formatDate, calculateWinnings } from '@/lib/utils';
import ChessGame from '@/components/games/ChessGame';
import TicTacToeGame from '@/components/games/TicTacToeGame';
import DiceGame from '@/components/games/DiceGame';
import CoinFlipGame from '@/components/games/CoinFlipGame';

export default function MatchPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();
  const [match, setMatch] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);

  const loadMatch = useCallback(async () => {
    const { data: { user: u } } = await supabase.auth.getUser();
    setUser(u);
    const { data } = await supabase.from('matches')
      .select(`*, game:games(*), creator:profiles!matches_creator_id_fkey(*), opponent:profiles!matches_opponent_id_fkey(*)`)
      .eq('id', id).single();
    setMatch(data);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    loadMatch();
    const channel = supabase.channel(`match-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches', filter: `id=eq.${id}` },
        () => loadMatch())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id, loadMatch]);

  async function joinMatch() {
    setJoining(true);
    try {
      const res = await fetch('/api/matches/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId: id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Joined match! Game starting...');
      loadMatch();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to join');
    } finally {
      setJoining(false);
    }
  }

  async function resignMatch() {
    if (!confirm('Resign this match? You will lose your stake.')) return;
    try {
      const res = await fetch('/api/matches/resign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId: id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.info('You resigned the match.');
      loadMatch();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to resign');
    }
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Loading match...</div>;
  if (!match) return <div className="text-center py-20 text-gray-400">Match not found.</div>;

  const isCreator = user?.id === match.creator_id;
  const isOpponent = user?.id === match.opponent_id;
  const isParticipant = isCreator || isOpponent;
  const canJoin = !isParticipant && match.status === 'waiting' && (!match.opponent_id || match.opponent_id === user?.id);
  const winnings = calculateWinnings(match.stake);
  const won = match.winner_id === user?.id;
  const lost = match.status === 'completed' && match.winner_id && match.winner_id !== user?.id;
  const gameType = match.game?.type;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Match header */}
      <div className="card p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-3xl">
                {gameType === 'chess' ? '♟️' : gameType === 'tictactoe' ? '⭕' : gameType === 'dice' ? '🎲' : gameType === 'coinflip' ? '🪙' : '🔴'}
              </span>
              <div>
                <h1 className="text-xl font-black">{match.game?.name}</h1>
                <div className="text-xs text-gray-500">{formatDate(match.created_at)}</div>
              </div>
            </div>

            <div className="flex items-center gap-3 text-sm">
              <span className="font-medium">@{match.creator?.username}</span>
              <span className="text-gray-500">vs</span>
              <span className="font-medium">{match.opponent ? `@${match.opponent.username}` : '(waiting...)'}</span>
            </div>
          </div>

          <div className="text-right">
            <div className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">
              {formatCurrency(match.stake)}
            </div>
            <div className="text-xs text-gray-500">stake per player</div>
            <div className="text-sm text-green-400 mt-1">Win: {formatCurrency(winnings.winnerReceives)}</div>
          </div>
        </div>

        {/* Status & actions */}
        <div className="flex flex-wrap items-center gap-3 mt-4 pt-4 border-t border-[#1e3a5f]">
          <span className={`text-xs px-3 py-1 rounded-full font-medium ${
            match.status === 'waiting' ? 'bg-yellow-500/20 text-yellow-400' :
            match.status === 'active' ? 'bg-green-500/20 text-green-400' :
            match.status === 'completed' ? 'bg-blue-500/20 text-blue-400' :
            'bg-red-500/20 text-red-400'}`}>
            {match.status.toUpperCase()}
          </span>

          {won && <span className="badge-green text-sm px-4 py-1">🏆 You Won! +{formatCurrency(winnings.winnerReceives)}</span>}
          {lost && <span className="badge-red text-sm px-4 py-1">😔 You Lost -{formatCurrency(match.stake)}</span>}

          {canJoin && (
            <button onClick={joinMatch} disabled={joining} className="btn-primary text-sm py-2 px-5 disabled:opacity-60">
              {joining ? 'Joining...' : `⚔️ Join Match – ${formatCurrency(match.stake)}`}
            </button>
          )}

          {isParticipant && match.status === 'active' && (
            <button onClick={resignMatch} className="text-xs text-red-400 hover:text-red-300 border border-red-400/30 px-3 py-1.5 rounded-lg">
              Resign
            </button>
          )}

          {match.status === 'waiting' && isCreator && (
            <div className="text-xs text-gray-500 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
              Waiting for opponent...
            </div>
          )}
        </div>
      </div>

      {/* Game area */}
      {match.status === 'active' && isParticipant && (
        <div className="card p-4 md:p-6">
          <h2 className="font-bold mb-4 text-gray-300">🎮 Game Board</h2>
          {gameType === 'chess' && (
            <ChessGame matchId={id} userId={user?.id} isCreator={isCreator} gameState={match.game_state} />
          )}
          {gameType === 'tictactoe' && (
            <TicTacToeGame matchId={id} userId={user?.id} isCreator={isCreator} gameState={match.game_state} />
          )}
          {gameType === 'dice' && (
            <DiceGame matchId={id} userId={user?.id} isCreator={isCreator} gameState={match.game_state} />
          )}
          {gameType === 'coinflip' && (
            <CoinFlipGame matchId={id} userId={user?.id} isCreator={isCreator} gameState={match.game_state} />
          )}
          {gameType === 'draughts' && (
            <div className="text-center py-12 text-gray-400">
              <div className="text-4xl mb-3">🔴</div>
              <p>Draughts game board coming soon</p>
            </div>
          )}
        </div>
      )}

      {match.status === 'completed' && (
        <div className={`card p-8 text-center ${won ? 'border-green-500/50 bg-green-500/5' : 'border-red-500/30 bg-red-500/5'}`}>
          <div className="text-5xl mb-4">{won ? '🏆' : '😔'}</div>
          <h2 className="text-2xl font-black mb-2">{won ? 'Victory!' : 'Better luck next time'}</h2>
          <p className="text-gray-400 mb-6">
            {won ? `You won ${formatCurrency(winnings.winnerReceives)}!` : `@${match.winner_id === match.creator_id ? match.creator?.username : match.opponent?.username} won this match.`}
          </p>
          <div className="flex gap-3 justify-center">
            <button onClick={() => router.push('/matches/new')} className="btn-primary text-sm py-2 px-6">Play Again</button>
            <button onClick={() => router.push('/matches')} className="btn-secondary text-sm py-2 px-6">View Matches</button>
          </div>
        </div>
      )}
    </div>
  );
}
