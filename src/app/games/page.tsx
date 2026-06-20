import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { formatCurrency } from '@/lib/utils';

export default async function GamesPage() {
  const supabase = await createClient();
  const { data: games } = await supabase.from('games').select('*').eq('is_active', true);

  const icons: Record<string, string> = {
    chess: '♟️', draughts: '🔴', tictactoe: '⭕', dice: '🎲', coinflip: '🪙',
  };
  const colors: Record<string, string> = {
    chess: 'from-blue-600/20 to-blue-900/20 border-blue-500/30',
    draughts: 'from-purple-600/20 to-purple-900/20 border-purple-500/30',
    tictactoe: 'from-green-600/20 to-green-900/20 border-green-500/30',
    dice: 'from-orange-600/20 to-orange-900/20 border-orange-500/30',
    coinflip: 'from-yellow-600/20 to-yellow-900/20 border-yellow-500/30',
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl md:text-3xl font-black mb-2">🎮 Games</h1>
        <p className="text-gray-400">Choose a game, set your stake, and compete for real money.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {(games || []).map((game) => (
          <div key={game.id}
            className={`card bg-gradient-to-br ${colors[game.type] || ''} p-6 hover:scale-[1.02] transition-all duration-200 flex flex-col`}>
            <div className="flex items-start justify-between mb-4">
              <span className="text-5xl">{icons[game.type] || '🎮'}</span>
              <span className="badge-green text-xs">Live</span>
            </div>
            <h3 className="text-xl font-black mb-2">{game.name}</h3>
            <p className="text-gray-400 text-sm mb-4 flex-1">{game.description}</p>
            <div className="flex items-center justify-between text-xs text-gray-500 mb-4">
              <span>Min: {formatCurrency(game.min_stake)}</span>
              <span>Max: {formatCurrency(game.max_stake)}</span>
            </div>
            <div className="flex gap-2">
              <Link href={`/matches/new?game=${game.type}`} className="btn-primary text-sm py-2 flex-1 text-center">
                Challenge Friend
              </Link>
              <Link href={`/matches?game=${game.type}&public=true`} className="btn-secondary text-sm py-2 flex-1 text-center">
                Find Match
              </Link>
            </div>
          </div>
        ))}
      </div>

      <div className="card p-6 bg-gradient-to-r from-blue-900/20 to-purple-900/20 border-blue-500/20">
        <h3 className="font-bold mb-2">🏆 How Winnings Work</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4 text-sm">
          <div className="text-center p-4 bg-white/5 rounded-lg">
            <div className="text-2xl mb-1">🎯</div>
            <div className="font-medium">Both stakes combine</div>
            <div className="text-gray-400 text-xs mt-1">into a shared pot</div>
          </div>
          <div className="text-center p-4 bg-white/5 rounded-lg">
            <div className="text-2xl mb-1">📊</div>
            <div className="font-medium">20% platform fee</div>
            <div className="text-gray-400 text-xs mt-1">deducted from pot</div>
          </div>
          <div className="text-center p-4 bg-white/5 rounded-lg">
            <div className="text-2xl mb-1">💰</div>
            <div className="font-medium">Winner takes 80%</div>
            <div className="text-gray-400 text-xs mt-1">credited instantly</div>
          </div>
        </div>
      </div>
    </div>
  );
}
