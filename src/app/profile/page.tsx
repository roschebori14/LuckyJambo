'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { formatDate } from '@/lib/utils';

export default function ProfilePage() {
  const [profile, setProfile] = useState<any>(null);
  const [stats, setStats] = useState({ played: 0, won: 0, lost: 0, winRate: 0 });
  const [form, setForm] = useState({ full_name: '', phone: '' });
  const [saving, setSaving] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      setProfile(p);
      if (p) setForm({ full_name: p.full_name || '', phone: p.phone || '' });

      const { data: matches } = await supabase.from('matches')
        .select('winner_id, status')
        .or(`creator_id.eq.${user.id},opponent_id.eq.${user.id}`)
        .eq('status', 'completed');

      const played = matches?.length || 0;
      const won = matches?.filter((m: any) => m.winner_id === user.id).length || 0;
      setStats({ played, won, lost: played - won, winRate: played ? Math.round((won / played) * 100) : 0 });
    }
    load();
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('profiles').update(form).eq('id', user!.id);
      if (error) throw error;
      toast.success('Profile updated!');
      setProfile((p: any) => ({ ...p, ...form }));
    } catch {
      toast.error('Failed to update profile');
    } finally {
      setSaving(false);
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    window.location.href = '/login';
  }

  if (!profile) return <div className="text-gray-400">Loading profile...</div>;

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl md:text-3xl font-black">👤 Profile</h1>

      {/* Profile card */}
      <div className="card p-6 flex items-center gap-5">
        <div className="w-16 h-16 rounded-full gradient-primary flex items-center justify-center font-black text-2xl shrink-0">
          {profile.username?.[0]?.toUpperCase()}
        </div>
        <div>
          <h2 className="text-xl font-black">@{profile.username}</h2>
          <p className="text-gray-400 text-sm">{profile.full_name}</p>
          <p className="text-xs text-gray-600 mt-1">Member since {formatDate(profile.created_at)}</p>
          {profile.role === 'admin' && (
            <span className="badge-yellow text-xs mt-1 inline-block">Admin</span>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Played', value: stats.played, color: 'text-white' },
          { label: 'Won', value: stats.won, color: 'text-green-400' },
          { label: 'Lost', value: stats.lost, color: 'text-red-400' },
          { label: 'Win Rate', value: `${stats.winRate}%`, color: 'text-blue-400' },
        ].map(s => (
          <div key={s.label} className="card p-4 text-center">
            <div className={`text-2xl font-black ${s.color}`}>{s.value}</div>
            <div className="text-xs text-gray-500 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Edit form */}
      <div className="card p-6">
        <h3 className="font-bold mb-5 text-gray-300">Edit Profile</h3>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Full Name</label>
            <input
              type="text"
              value={form.full_name}
              onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Phone (Mobile Money)</label>
            <input
              type="tel"
              value={form.phone}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              placeholder="+237 6XX XXX XXX"
              className="input-field"
            />
          </div>
          <button type="submit" disabled={saving} className="btn-primary disabled:opacity-60">
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </div>

      {/* Danger zone */}
      <div className="card p-6 border-red-500/20">
        <h3 className="font-bold mb-4 text-red-400">Account</h3>
        <button onClick={handleSignOut} className="text-sm text-red-400 hover:text-red-300 border border-red-400/30 px-4 py-2 rounded-lg transition-colors">
          Sign Out
        </button>
      </div>
    </div>
  );
}
