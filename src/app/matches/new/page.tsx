'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { formatCurrency, calculateWinnings } from '@/lib/utils';

interface Game { id: string; name: string; type: string; min_stake: number; max_stake: number; }
interface Friend { id: string; username: string; }

export default function NewMatchPage() {
  const [games, setGames] = useState<Game[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [selectedGame, setSelectedGame] = useState('');
  const [stake, setStake] = useState('');
  const [matchType, setMatchType] = useState<'friend' | 'public'>('public');
  const [selectedFriend, setSelectedFriend] = useState('');
  const [loading, setLoading] = useState(false);
  const [wallet, setWallet] = useState<{ available_balance: number } | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [{ data: g }, { data: w }, { data: f }] = await Promise.all([
        supabase.from('games').select('*').eq('is_active', true),
        supabase.from('wallets').select('available_balance').eq('user_id', user.id).single(),
        supabase.from('friends')
          .select('friend:profiles!friends_friend_id_fkey(id, username)')
          .eq('user_id', user.id),
      ]);

      setGames(g || []);
      setWallet(w);

      const friendList = (f || []).map((fr: any) => fr.friend).filter(Boolean);
      setFriends(friendList);

      const preselect = searchParams.get('game');
      if (preselect && g) {
        const match = g.find((game: Game) => game.type === preselect);
        if (match) setSelectedGame(match.id);
      }
    }
    load();
  }, []);

  const selectedGameData = games.find(g => g.id === selectedGame);
  const stakeNum = parseInt(stake) || 0;
  const winnings = stakeNum > 0 ? calculateWinnings(stakeNum) : null;
  const icons: Record<string, string> = { chess: '♟️', draughts: '🔴', tictactoe: '⭕', dice: '🎲', coinflip: '🪙' };

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedGame) return toast.error('Select a game');
    if (!stakeNum || stakeNum < 50) return toast.error('Minimum stake is 50 XAF');
    if (wallet && stakeNum > wallet.available_balance) return toast.error('Insufficient balance');
    if (matchType === 'friend' && !selectedFriend) return toast.error('Select a friend to challenge');

    setLoading(true);
    try {
      const res = await fetch('/api/matches/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId: selectedGame,
          stake: stakeNum,
          isPublic: matchType === 'public',
          opponentId: matchType === 'friend' ? selectedFriend : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Match created!');
      router.push(`/matches/${data.matchId}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to create match');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-black mb-2">⚔️ Create Match</h1>
        <p className="text-gray-400 text-sm">Set your game, stake, and find your opponent.</p>
      </div>

      {wallet && (
        <div className="flex items-center gap-2 text-sm text-gray-400 bg-[#0d1b3e] px-4 py-2 rounded-lg w-fit">
          💰 Available: <span className="text-white font-bold ml-1">{formatCurrency(wallet.available_balance)}</span>
        </div>
      )}

      <form onSubmit={handleCreate} className="space-y-6">
        {/* Game selection */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-3">Select Game</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {games.map(game => (
              <button key={game.id} type="button" onClick={() => setSelectedGame(game.id)}
                className={`card p-4 text-left transition-all duration-150 ${selectedGame === game.id ? 'border-blue-500 bg-blue-500/10' : 'hover:border-gray-500'}`}>
                <div className="text-2xl mb-1">{icons[game.type] || '🎮'}</div>
                <div className="text-sm font-bold">{game.name}</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {formatCurrency(game.min_stake)} – {formatCurrency(game.max_stake)}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Match type */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-3">Match Type</label>
          <div className="flex gap-3">
            {(['public', 'friend'] as const).map(type => (
              <button key={type} type="button" onClick={() => setMatchType(type)}
                className={`flex-1 py-3 rounded-lg text-sm font-medium transition-all border ${matchType === type ? 'gradient-primary border-transparent' : 'border-[#1e3a5f] text-gray-400 hover:text-white'}`}>
                {type === 'public' ? '🌐 Public Match' : '👥 Challenge Friend'}
              </button>
            ))}
          </div>
        </div>

        {/* Friend selector */}
        {matchType === 'friend' && (
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Choose Friend</label>
            {friends.length > 0 ? (
              <select value={selectedFriend} onChange={e => setSelectedFriend(e.target.value)}
                className="input-field">
                <option value="">-- Select a friend --</option>
                {friends.map(f => (
                  <option key={f.id} value={f.id}>@{f.username}</option>
                ))}
              </select>
            ) : (
              <div className="text-sm text-gray-500 p-4 bg-[#0d1b3e] rounded-lg">
                You have no friends yet. <a href="/friends" className="text-blue-400 hover:underline">Add some friends first →</a>
              </div>
            )}
          </div>
        )}

        {/* Stake */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Stake Amount (XAF)
            {selectedGameData && (
              <span className="text-gray-500 font-normal ml-2">
                min {formatCurrency(selectedGameData.min_stake)} · max {formatCurrency(selectedGameData.max_stake)}
              </span>
            )}
          </label>
          <input type="number" value={stake} onChange={e => setStake(e.target.value)}
            placeholder="e.g. 500" className="input-field"
            min={selectedGameData?.min_stake || 50}
            max={Math.min(selectedGameData?.max_stake || 50000, wallet?.available_balance || 0)} />

          {/* Quick amounts */}
          <div className="flex gap-2 mt-2 flex-wrap">
            {[100, 500, 1000, 2000, 5000].map(amt => (
              <button key={amt} type="button" onClick={() => setStake(String(amt))}
                className="text-xs px-3 py-1.5 rounded-full bg-[#1e3a5f] text-gray-300 hover:bg-blue-600 hover:text-white transition-colors">
                {formatCurrency(amt)}
              </button>
            ))}
          </div>
        </div>

        {/* Winnings preview */}
        {winnings && (
          <div className="card p-4 bg-gradient-to-r from-green-900/20 to-blue-900/20 border-green-500/20">
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-3">If you win</div>
            <div className="grid grid-cols-3 gap-3 text-center text-sm">
              <div>
                <div className="text-gray-400">Pot</div>
                <div className="font-bold">{formatCurrency(winnings.pot)}</div>
              </div>
              <div>
                <div className="text-gray-400">Fee (20%)</div>
                <div className="text-yellow-400 font-bold">-{formatCurrency(winnings.fee)}</div>
              </div>
              <div>
                <div className="text-gray-400">You receive</div>
                <div className="text-green-400 font-bold text-lg">{formatCurrency(winnings.winnerReceives)}</div>
              </div>
            </div>
          </div>
        )}

        <button type="submit" disabled={loading || !selectedGame || !stake}
          className="btn-primary w-full py-4 text-lg disabled:opacity-50 disabled:cursor-not-allowed">
          {loading ? 'Creating match...' : '⚔️ Create Match'}
        </button>
      </form>
    </div>
  );
}
