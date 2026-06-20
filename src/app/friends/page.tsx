'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { formatDate } from '@/lib/utils';

export default function FriendsPage() {
  const [tab, setTab] = useState<'friends' | 'requests' | 'search'>('friends');
  const [friends, setFriends] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const supabase = createClient();

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [{ data: f }, { data: r }] = await Promise.all([
      supabase.from('friends')
        .select('friend:profiles!friends_friend_id_fkey(id, username, full_name)')
        .eq('user_id', user.id),
      supabase.from('friend_requests')
        .select('*, sender:profiles!friend_requests_sender_id_fkey(id, username, full_name)')
        .eq('receiver_id', user.id)
        .eq('status', 'pending'),
    ]);

    setFriends((f || []).map((fr: any) => fr.friend));
    setRequests(r || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleSearch() {
    if (!searchTerm.trim()) return;
    setSearching(true);
    const { data } = await supabase.from('profiles')
      .select('id, username, full_name')
      .ilike('username', `%${searchTerm}%`)
      .limit(10);
    setSearchResults(data || []);
    setSearching(false);
  }

  async function sendRequest(receiverId: string) {
    try {
      const res = await fetch('/api/friends/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receiverId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Friend request sent!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to send request');
    }
  }

  async function respondRequest(requestId: string, action: 'accepted' | 'rejected') {
    try {
      const res = await fetch('/api/friends/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(action === 'accepted' ? 'Friend added!' : 'Request declined');
      load();
    } catch (err: any) {
      toast.error(err.message || 'Failed');
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl md:text-3xl font-black">👥 Friends</h1>

      <div className="flex gap-1 bg-[#0d1b3e] p-1 rounded-lg w-fit">
        {(['friends', 'requests', 'search'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-md text-sm font-medium capitalize transition-all relative ${tab === t ? 'gradient-primary text-white' : 'text-gray-400 hover:text-white'}`}>
            {t}
            {t === 'requests' && requests.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[10px] flex items-center justify-center">{requests.length}</span>
            )}
          </button>
        ))}
      </div>

      {tab === 'friends' && (
        <div>
          {loading ? <div className="text-gray-400">Loading...</div> : friends.length > 0 ? (
            <div className="card divide-y divide-[#1e3a5f]">
              {friends.map(f => (
                <div key={f.id} className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center font-black">
                      {f.username?.[0]?.toUpperCase()}
                    </div>
                    <div>
                      <div className="font-medium">@{f.username}</div>
                      <div className="text-xs text-gray-500">{f.full_name}</div>
                    </div>
                  </div>
                  <Link href={`/matches/new?friend=${f.id}`} className="btn-primary text-xs py-1.5 px-4">
                    Challenge ⚔️
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <div className="card p-12 text-center">
              <div className="text-4xl mb-3">👥</div>
              <p className="text-gray-400 mb-4">No friends yet. Search for players to add!</p>
              <button onClick={() => setTab('search')} className="btn-primary text-sm py-2 px-6">Search Players</button>
            </div>
          )}
        </div>
      )}

      {tab === 'requests' && (
        <div>
          {requests.length > 0 ? (
            <div className="card divide-y divide-[#1e3a5f]">
              {requests.map(r => (
                <div key={r.id} className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center font-black">
                      {r.sender?.username?.[0]?.toUpperCase()}
                    </div>
                    <div>
                      <div className="font-medium">@{r.sender?.username}</div>
                      <div className="text-xs text-gray-500">{formatDate(r.created_at)}</div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => respondRequest(r.id, 'accepted')} className="btn-primary text-xs py-1.5 px-3">✓ Accept</button>
                    <button onClick={() => respondRequest(r.id, 'rejected')} className="btn-secondary text-xs py-1.5 px-3">✗ Decline</button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="card p-12 text-center text-gray-400">No pending friend requests.</div>
          )}
        </div>
      )}

      {tab === 'search' && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="Search by username..."
              className="input-field flex-1"
            />
            <button onClick={handleSearch} disabled={searching} className="btn-primary px-5 py-3 disabled:opacity-60">
              {searching ? '...' : '🔍'}
            </button>
          </div>

          {searchResults.length > 0 && (
            <div className="card divide-y divide-[#1e3a5f]">
              {searchResults.map(p => (
                <div key={p.id} className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center font-black">
                      {p.username?.[0]?.toUpperCase()}
                    </div>
                    <div>
                      <div className="font-medium">@{p.username}</div>
                      <div className="text-xs text-gray-500">{p.full_name}</div>
                    </div>
                  </div>
                  <button onClick={() => sendRequest(p.id)} className="btn-primary text-xs py-1.5 px-4">Add Friend</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
