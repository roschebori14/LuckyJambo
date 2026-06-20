import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { formatCurrency, formatDate } from '@/lib/utils';

export default async function MatchesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ data: myMatches }, { data: publicMatches }] = await Promise.all([
    supabase.from('matches')
      .select('*, game:games(name,type), creator:profiles!matches_creator_id_fkey(username), opponent:profiles!matches_opponent_id_fkey(username)')
      .or(`creator_id.eq.${user.id},opponent_id.eq.${user.id}`)
      .order('created_at', { ascending: false })
      .limit(20),
    supabase.from('matches')
      .select('*, game:games(name,type), creator:profiles!matches_creator_id_fkey(username)')
      .eq('status', 'waiting')
      .eq('is_public', true)
      .neq('creator_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10),
  ]);

  const icons: Record<string, string> = { chess: '♟️', draughts: '🔴', tictactoe: '⭕', dice: '🎲', coinflip: '🪙' };
  const statusBadge: Record<string, string> = {
    waiting: 'badge-yellow', active: 'badge-green', completed: 'badge-blue', cancelled: 'badge-red',
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl md:text-3xl font-black">⚔️ Matches</h1>
        <Link href="/matches/new" className="btn-primary text-sm py-2 px-5">New Match +</Link>
      </div>

      {/* Public lobby */}
      {publicMatches && publicMatches.length > 0 && (
        <div>
          <h2 className="text-lg font-bold mb-3 text-gray-300">🔓 Public Lobby</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {publicMatches.map((m: any) => (
              <div key={m.id} className="card p-4 flex items-center justify-between hover:border-blue-500/50 transition-colors">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{icons[m.game?.type] || '🎮'}</span>
                  <div>
                    <div className="font-medium text-sm">{m.game?.name}</div>
                    <div className="text-xs text-gray-500">by @{(m.creator as any)?.username}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{formatDate(m.created_at)}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-black text-green-400 text-sm">{formatCurrency(m.stake)}</div>
                  <Link href={`/matches/${m.id}`} className="btn-primary text-xs py-1.5 px-4 mt-2 block text-center">Join</Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* My matches */}
      <div>
        <h2 className="text-lg font-bold mb-3 text-gray-300">My Matches</h2>
        {myMatches && myMatches.length > 0 ? (
          <div className="card overflow-hidden">
            <div className="divide-y divide-[#1e3a5f]">
              {myMatches.map((m: any) => {
                const isCreator = m.creator_id === user.id;
                const opponent = isCreator ? m.opponent : m.creator;
                const won = m.winner_id === user.id;
                const lost = m.winner_id && m.winner_id !== user.id;
                return (
                  <Link key={m.id} href={`/matches/${m.id}`}
                    className="flex items-center justify-between p-4 hover:bg-white/5 transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{icons[m.game?.type] || '🎮'}</span>
                      <div>
                        <div className="text-sm font-medium">{m.game?.name}</div>
                        <div className="text-xs text-gray-500">
                          vs {(opponent as any)?.username || 'Waiting for opponent'}
                        </div>
                        <div className="text-xs text-gray-600">{formatDate(m.created_at)}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-right">
                      <div>
                        <div className="text-sm font-bold">{formatCurrency(m.stake)}</div>
                        {won && <div className="text-xs text-green-400">+{formatCurrency(m.stake * 2 * 0.8)}</div>}
                        {lost && <div className="text-xs text-red-400">-{formatCurrency(m.stake)}</div>}
                      </div>
                      <div className="flex flex-col gap-1 items-end">
                        <span className={statusBadge[m.status] || 'badge-blue'}>{m.status}</span>
                        {won && <span className="badge-green">Won 🏆</span>}
                        {lost && <span className="badge-red">Lost</span>}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="card p-12 text-center">
            <div className="text-4xl mb-3">⚔️</div>
            <p className="text-gray-400 mb-4">No matches yet.</p>
            <Link href="/matches/new" className="btn-primary text-sm py-2 px-6 inline-block">Create Your First Match</Link>
          </div>
        )}
      </div>
    </div>
  );
}
