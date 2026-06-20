import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { formatCurrency, formatDate } from '@/lib/utils';

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ data: profile }, { data: wallet }, { data: recentMatches }, { data: notifications }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('wallets').select('*').eq('user_id', user.id).single(),
    supabase.from('matches')
      .select('*, game:games(name,type), participants:match_participants(user_id, profile:profiles(username))')
      .or(`creator_id.eq.${user.id},opponent_id.eq.${user.id}`)
      .order('created_at', { ascending: false })
      .limit(5),
    supabase.from('notifications').select('*').eq('user_id', user.id).eq('is_read', false).order('created_at', { ascending: false }).limit(5),
  ]);

  const games = [
    { emoji: '♟️', name: 'Chess', type: 'chess', color: 'from-blue-600 to-blue-800', players: '2.4K' },
    { emoji: '🔴', name: 'Draughts', type: 'draughts', color: 'from-purple-600 to-purple-800', players: '1.2K' },
    { emoji: '⭕', name: 'Tic Tac Toe', type: 'tictactoe', color: 'from-green-600 to-green-800', players: '3.1K' },
    { emoji: '🎲', name: 'Two Dice', type: 'dice', color: 'from-orange-600 to-orange-800', players: '5.6K' },
    { emoji: '🪙', name: 'Coin Flip', type: 'coinflip', color: 'from-yellow-600 to-yellow-800', players: '8.2K' },
  ];

  const statusColor: Record<string, string> = {
    waiting: 'badge-yellow',
    active: 'badge-green',
    completed: 'badge-blue',
    cancelled: 'badge-red',
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-black">
            Welcome back, <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">{profile?.username || 'Player'}</span>! ⚡
          </h1>
          <p className="text-gray-400 text-sm mt-1">Ready to play and win today?</p>
        </div>
        <Link href="/matches/new" className="btn-primary text-sm py-2 px-5 hidden md:block">New Match +</Link>
      </div>

      {/* Balance cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="card p-6">
          <div className="text-xs text-gray-500 mb-2 uppercase tracking-wider">Available</div>
          <div className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">
            {formatCurrency(wallet?.available_balance || 0)}
          </div>
          <div className="mt-4 flex gap-2">
            <Link href="/wallet?tab=deposit" className="btn-primary text-xs py-1.5 px-4">Deposit</Link>
            <Link href="/wallet?tab=withdraw" className="btn-secondary text-xs py-1.5 px-4">Withdraw</Link>
          </div>
        </div>

        <div className="card p-6">
          <div className="text-xs text-gray-500 mb-2 uppercase tracking-wider">Locked in Matches</div>
          <div className="text-3xl font-black text-yellow-400">
            {formatCurrency(wallet?.locked_balance || 0)}
          </div>
          <p className="text-xs text-gray-600 mt-4">Released when matches complete</p>
        </div>

        <div className="card p-6">
          <div className="text-xs text-gray-500 mb-2 uppercase tracking-wider">Total Balance</div>
          <div className="text-3xl font-black text-white">
            {formatCurrency((wallet?.available_balance || 0) + (wallet?.locked_balance || 0))}
          </div>
          <p className="text-xs text-gray-600 mt-4">Available + Locked</p>
        </div>
      </div>

      {/* Notifications */}
      {notifications && notifications.length > 0 && (
        <div className="card p-4">
          <h2 className="font-bold text-sm text-gray-400 uppercase tracking-wider mb-3">🔔 Notifications</h2>
          <div className="space-y-2">
            {notifications.map(n => (
              <div key={n.id} className="flex items-start gap-3 p-3 bg-[#111827] rounded-lg">
                <div className="w-2 h-2 rounded-full bg-blue-400 mt-1.5 shrink-0" />
                <div>
                  <div className="text-sm font-medium">{n.title}</div>
                  <div className="text-xs text-gray-500">{n.message}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Play */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-black">Quick Play</h2>
          <Link href="/games" className="text-sm text-blue-400 hover:text-blue-300">All games →</Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {games.map(game => (
            <Link key={game.type} href={`/games/${game.type}`}
              className={`card p-4 text-center hover:scale-105 transition-all duration-200 hover:border-blue-500/50 group`}>
              <div className="text-3xl mb-2">{game.emoji}</div>
              <div className="text-sm font-bold group-hover:text-blue-400 transition-colors">{game.name}</div>
              <div className="text-xs text-gray-500 mt-1">{game.players} playing</div>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent Matches */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-black">Recent Matches</h2>
          <Link href="/matches" className="text-sm text-blue-400 hover:text-blue-300">View all →</Link>
        </div>

        {recentMatches && recentMatches.length > 0 ? (
          <div className="card overflow-hidden">
            <div className="divide-y divide-[#1e3a5f]">
              {recentMatches.map((match: any) => (
                <div key={match.id} className="flex items-center justify-between p-4 hover:bg-white/5 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="text-xl">
                      {match.game?.type === 'chess' ? '♟️' :
                       match.game?.type === 'dice' ? '🎲' :
                       match.game?.type === 'tictactoe' ? '⭕' :
                       match.game?.type === 'coinflip' ? '🪙' : '🔴'}
                    </div>
                    <div>
                      <div className="text-sm font-medium">{match.game?.name}</div>
                      <div className="text-xs text-gray-500">{formatDate(match.created_at)}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-sm font-bold">{formatCurrency(match.stake)}</div>
                    <span className={statusColor[match.status] || 'badge-blue'}>{match.status}</span>
                    {match.winner_id === user.id && <span className="badge-green">Won!</span>}
                    {match.status === 'waiting' && match.creator_id !== user.id && (
                      <Link href={`/matches/${match.id}`} className="btn-primary text-xs py-1 px-3">Join</Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="card p-12 text-center">
            <div className="text-4xl mb-4">⚔️</div>
            <p className="text-gray-400 mb-4">No matches yet. Start your first game!</p>
            <Link href="/games" className="btn-primary text-sm py-2 px-6 inline-block">Browse Games</Link>
          </div>
        )}
      </div>

      <div className="md:hidden">
        <Link href="/matches/new" className="btn-primary w-full text-center block">New Match +</Link>
      </div>
    </div>
  );
}
