'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { formatCurrency, formatDate } from '@/lib/utils';

type Tab = 'overview' | 'withdrawals' | 'users' | 'matches' | 'settings';

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>('overview');
  const [stats, setStats] = useState<any>(null);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    async function checkAdmin() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      if (profile?.role !== 'admin') { setLoading(false); return; }
      setIsAdmin(true);
      await loadData();
      setLoading(false);
    }
    checkAdmin();
  }, []);

  async function loadData() {
    const [
      { data: withdrawalData },
      { data: userData },
      { data: matchData },
      { data: settingsData },
      { data: depositData },
    ] = await Promise.all([
      supabase.from('withdrawals').select('*, profile:profiles(username,email)').order('created_at', { ascending: false }).limit(50),
      supabase.from('profiles').select('*').order('created_at', { ascending: false }).limit(100),
      supabase.from('matches').select('*, game:games(name), creator:profiles!matches_creator_id_fkey(username), opponent:profiles!matches_opponent_id_fkey(username)').order('created_at', { ascending: false }).limit(50),
      supabase.from('settings').select('*'),
      supabase.from('deposits').select('amount, status'),
    ]);

    setWithdrawals(withdrawalData || []);
    setUsers(userData || []);
    setMatches(matchData || []);

    const s: Record<string, string> = {};
    (settingsData || []).forEach((row: any) => { s[row.key] = row.value; });
    setSettings(s);

    const totalDeposits = (depositData || []).filter((d: any) => d.status === 'completed').reduce((sum: number, d: any) => sum + d.amount, 0);
    const totalWithdrawals = (withdrawalData || []).filter((w: any) => w.status === 'completed').reduce((sum, w) => sum + w.amount, 0);
    const pendingW = (withdrawalData || []).filter((w: any) => w.status === 'pending').length;
    const completedMatches = (matchData || []).filter((m: any) => m.status === 'completed').length;
    const revenue = (matchData || []).filter((m: any) => m.status === 'completed').reduce((sum: number, m: any) => sum + m.stake * 2 * 0.2, 0);

    setStats({
      totalUsers: userData?.length || 0,
      totalDeposits,
      totalWithdrawals,
      pendingWithdrawals: pendingW,
      matchesPlayed: completedMatches,
      revenue,
    });
  }

  async function handleWithdrawal(id: string, action: 'approved' | 'rejected', note?: string) {
    try {
      const res = await fetch('/api/admin/withdrawal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ withdrawalId: id, action, note }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`Withdrawal ${action}`);
      await loadData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Action failed');
    }
  }

  async function toggleUserStatus(userId: string, current: boolean) {
    const { error } = await supabase.from('profiles').update({ is_active: !current }).eq('id', userId);
    if (error) { toast.error('Failed to update user'); return; }
    toast.success(`User ${current ? 'suspended' : 'reactivated'}`);
    await loadData();
  }

  async function saveSetting(key: string, value: string) {
    const { error } = await supabase.from('settings').upsert({ key, value }).eq('key', key);
    if (error) { toast.error('Failed to save'); return; }
    toast.success('Setting saved');
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Loading...</div>;
  if (!isAdmin) return (
    <div className="text-center py-20">
      <div className="text-4xl mb-4">🚫</div>
      <h2 className="text-xl font-bold text-red-400">Access Denied</h2>
      <p className="text-gray-500 mt-2">Admin access required.</p>
    </div>
  );

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'overview', label: 'Overview', icon: '📊' },
    { key: 'withdrawals', label: `Withdrawals ${stats?.pendingWithdrawals ? `(${stats.pendingWithdrawals})` : ''}`, icon: '💸' },
    { key: 'users', label: 'Users', icon: '👥' },
    { key: 'matches', label: 'Matches', icon: '⚔️' },
    { key: 'settings', label: 'Settings', icon: '⚙️' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="text-2xl">⚙️</span>
        <h1 className="text-2xl md:text-3xl font-black">Admin Panel</h1>
        <span className="badge-yellow text-xs">ADMIN</span>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#0d1b3e] p-1 rounded-xl overflow-x-auto">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${tab === t.key ? 'gradient-primary text-white' : 'text-gray-400 hover:text-white'}`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === 'overview' && stats && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { label: 'Total Users', value: stats.totalUsers.toLocaleString(), icon: '👥', color: 'text-blue-400' },
              { label: 'Total Deposits', value: formatCurrency(stats.totalDeposits), icon: '⬇️', color: 'text-green-400' },
              { label: 'Total Withdrawals', value: formatCurrency(stats.totalWithdrawals), icon: '⬆️', color: 'text-red-400' },
              { label: 'Pending Withdrawals', value: stats.pendingWithdrawals, icon: '⏳', color: 'text-yellow-400' },
              { label: 'Matches Played', value: stats.matchesPlayed.toLocaleString(), icon: '⚔️', color: 'text-purple-400' },
              { label: 'Platform Revenue', value: formatCurrency(stats.revenue), icon: '💰', color: 'text-cyan-400' },
            ].map(s => (
              <div key={s.label} className="card p-5">
                <div className="text-2xl mb-2">{s.icon}</div>
                <div className={`text-2xl font-black ${s.color}`}>{s.value}</div>
                <div className="text-xs text-gray-500 mt-1">{s.label}</div>
              </div>
            ))}
          </div>

          {stats.pendingWithdrawals > 0 && (
            <div className="card p-4 border-yellow-500/30 bg-yellow-500/5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-yellow-400 font-bold">
                  ⚠️ {stats.pendingWithdrawals} withdrawal{stats.pendingWithdrawals > 1 ? 's' : ''} awaiting review
                </div>
                <button onClick={() => setTab('withdrawals')} className="btn-primary text-xs py-1.5 px-4">Review Now</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Withdrawals */}
      {tab === 'withdrawals' && (
        <div className="space-y-4">
          <div className="flex gap-2 mb-4">
            {['all', 'pending', 'approved', 'rejected'].map(s => (
              <button key={s} className="text-xs px-3 py-1.5 rounded-full bg-[#1e3a5f] text-gray-300 hover:bg-blue-600 hover:text-white transition-colors capitalize">{s}</button>
            ))}
          </div>
          <div className="card overflow-hidden">
            <div className="divide-y divide-[#1e3a5f]">
              {withdrawals.length === 0 ? (
                <div className="p-12 text-center text-gray-400">No withdrawals yet</div>
              ) : withdrawals.map(w => (
                <div key={w.id} className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">@{(w.profile as any)?.username || 'Unknown'}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          w.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                          w.status === 'approved' || w.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                          'bg-red-500/20 text-red-400'}`}>
                          {w.status}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">{(w.profile as any)?.email}</div>
                      <div className="text-xs text-gray-500">📱 {w.phone} • {formatDate(w.created_at)}</div>
                      {w.admin_note && <div className="text-xs text-yellow-400 mt-1">Note: {w.admin_note}</div>}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xl font-black text-white">{formatCurrency(w.amount)}</span>
                      {w.status === 'pending' && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleWithdrawal(w.id, 'approved')}
                            className="bg-green-600 hover:bg-green-500 text-white text-xs py-1.5 px-4 rounded-lg transition-colors font-medium">
                            ✓ Approve
                          </button>
                          <button
                            onClick={() => {
                              const note = prompt('Rejection reason (optional):') || undefined;
                              handleWithdrawal(w.id, 'rejected', note);
                            }}
                            className="bg-red-600 hover:bg-red-500 text-white text-xs py-1.5 px-4 rounded-lg transition-colors font-medium">
                            ✗ Reject
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Users */}
      {tab === 'users' && (
        <div className="card overflow-hidden">
          <div className="p-4 border-b border-[#1e3a5f] flex items-center justify-between">
            <span className="font-bold">{users.length} Users</span>
          </div>
          <div className="divide-y divide-[#1e3a5f]">
            {users.map(u => (
              <div key={u.id} className="flex items-center justify-between p-4 hover:bg-white/5">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full gradient-primary flex items-center justify-center font-black text-sm">
                    {u.username?.[0]?.toUpperCase()}
                  </div>
                  <div>
                    <div className="text-sm font-medium flex items-center gap-2">
                      @{u.username}
                      {u.role === 'admin' && <span className="badge-yellow text-xs">Admin</span>}
                      {!u.is_active && <span className="badge-red text-xs">Suspended</span>}
                    </div>
                    <div className="text-xs text-gray-500">{formatDate(u.created_at)}</div>
                  </div>
                </div>
                {u.role !== 'admin' && (
                  <button
                    onClick={() => toggleUserStatus(u.id, u.is_active)}
                    className={`text-xs px-3 py-1.5 rounded-lg transition-colors font-medium ${u.is_active ? 'text-red-400 hover:bg-red-500/10 border border-red-500/30' : 'text-green-400 hover:bg-green-500/10 border border-green-500/30'}`}>
                    {u.is_active ? 'Suspend' : 'Reactivate'}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Matches */}
      {tab === 'matches' && (
        <div className="card overflow-hidden">
          <div className="p-4 border-b border-[#1e3a5f]">
            <span className="font-bold">{matches.length} Recent Matches</span>
          </div>
          <div className="divide-y divide-[#1e3a5f]">
            {matches.map(m => (
              <div key={m.id} className="flex items-center justify-between p-4 hover:bg-white/5">
                <div>
                  <div className="text-sm font-medium">{(m.game as any)?.name}</div>
                  <div className="text-xs text-gray-500">
                    @{(m.creator as any)?.username} vs @{(m.opponent as any)?.username || '(waiting)'}
                  </div>
                  <div className="text-xs text-gray-600">{formatDate(m.created_at)}</div>
                </div>
                <div className="text-right flex items-center gap-3">
                  <span className="font-bold text-sm">{formatCurrency(m.stake)}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    m.status === 'active' ? 'bg-green-500/20 text-green-400' :
                    m.status === 'waiting' ? 'bg-yellow-500/20 text-yellow-400' :
                    m.status === 'completed' ? 'bg-blue-500/20 text-blue-400' :
                    'bg-red-500/20 text-red-400'}`}>
                    {m.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Settings */}
      {tab === 'settings' && (
        <div className="max-w-2xl space-y-4">
          {[
            { key: 'platform_fee_percent', label: 'Platform Fee (%)', type: 'number' },
            { key: 'min_deposit', label: 'Minimum Deposit (XAF)', type: 'number' },
            { key: 'max_deposit', label: 'Maximum Deposit (XAF)', type: 'number' },
            { key: 'min_withdrawal', label: 'Minimum Withdrawal (XAF)', type: 'number' },
            { key: 'max_withdrawal', label: 'Maximum Withdrawal (XAF)', type: 'number' },
            { key: 'maintenance_mode', label: 'Maintenance Mode (true/false)', type: 'text' },
          ].map(s => (
            <div key={s.key} className="card p-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">{s.label}</label>
              <div className="flex gap-3">
                <input
                  type={s.type}
                  defaultValue={settings[s.key] || ''}
                  onBlur={e => setSettings(prev => ({ ...prev, [s.key]: e.target.value }))}
                  className="input-field flex-1"
                />
                <button
                  onClick={() => saveSetting(s.key, settings[s.key])}
                  className="btn-primary text-sm py-2 px-4 shrink-0">
                  Save
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
