"use client";
import { useState, useEffect } from "react";
import { Users, UserPlus, Check, X, Swords, Send } from "lucide-react";
import Link from "next/link";

interface Friend { friend_id: string; profiles: { id: string; username: string } | null }
interface Request { id: string; sender_id?: string; receiver_id?: string; profiles: { username: string } | null }

export default function FriendsPage() {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [incoming, setIncoming] = useState<Request[]>([]);
  const [outgoing, setOutgoing] = useState<Request[]>([]);
  const [username, setUsername] = useState("");
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState("");

  async function load() {
    const res = await fetch("/api/friends/list");
    const j = await res.json();
    if (j.success) { setFriends(j.friends); setIncoming(j.incoming); setOutgoing(j.outgoing); }
  }
  useEffect(() => { load(); }, []);

  async function sendRequest() {
    if (!username.trim()) return;
    setSending(true); setMsg("");
    const res = await fetch("/api/friends/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username }) });
    const j = await res.json();
    setMsg(j.success ? "✅ Friend request sent!" : "❌ " + j.message);
    if (j.success) { setUsername(""); load(); }
    setSending(false);
  }

  async function respond(id: string, accept: boolean) {
    await fetch("/api/friends/respond", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ request_id: id, accept }) });
    load();
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="lj-page-header -mx-4 -mt-4 px-4 pb-5 pt-4 md:-mx-6 md:-mt-6 md:px-6">
        <h1 className="flex items-center gap-2 text-2xl font-black text-white"><Users size={24} style={{color:"var(--lj-cyan)"}}/> Friends</h1>
      </div>

      {/* Add friend */}
      <div className="lj-card p-5">
        <h2 className="mb-3 font-bold text-white">Add a Friend</h2>
        {msg && <p className={`mb-3 text-sm ${msg.startsWith("✅") ? "text-[var(--lj-success)]" : "text-red-400"}`}>{msg}</p>}
        <div className="flex gap-2">
          <input value={username} onChange={e => setUsername(e.target.value)}
            onKeyDown={e => e.key === "Enter" && sendRequest()}
            placeholder="Enter username…" className="lj-input flex-1" />
          <button onClick={sendRequest} disabled={sending || !username.trim()}
            className="flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
            style={{ background: "linear-gradient(135deg,var(--lj-blue),var(--lj-cyan))" }}>
            {sending ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"/> : <UserPlus size={16}/>}
            Add
          </button>
        </div>
      </div>

      {/* Incoming */}
      {incoming.length > 0 && (
        <div className="lj-card overflow-hidden">
          <div className="px-5 py-3" style={{borderBottom:"1px solid var(--lj-border)"}}>
            <h2 className="font-bold text-yellow-400">Incoming Requests ({incoming.length})</h2>
          </div>
          <div className="divide-y" style={{borderColor:"var(--lj-border)"}}>
            {incoming.map(r => (
              <div key={r.id} className="flex items-center justify-between px-5 py-3">
                <p className="font-medium text-white">{r.profiles?.username}</p>
                <div className="flex gap-2">
                  <button onClick={() => respond(r.id, true)} className="flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-bold text-white" style={{background:"var(--lj-success)"}}><Check size={12}/> Accept</button>
                  <button onClick={() => respond(r.id, false)} className="flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-bold text-white" style={{background:"var(--lj-danger)"}}><X size={12}/> Decline</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Friends list */}
      <div className="lj-card overflow-hidden">
        <div className="px-5 py-3" style={{borderBottom:"1px solid var(--lj-border)"}}>
          <h2 className="font-bold text-white">Friends ({friends.length})</h2>
        </div>
        {friends.length === 0
          ? <p className="py-8 text-center text-sm text-[var(--lj-muted)]">No friends yet. Add someone by username above.</p>
          : <div className="divide-y" style={{borderColor:"var(--lj-border)"}}>
              {friends.map(f => (
                <div key={f.friend_id} className="flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-black text-white"
                      style={{background:"linear-gradient(135deg,var(--lj-blue),var(--lj-cyan))"}}>
                      {(f.profiles?.username ?? "?")[0]?.toUpperCase()}
                    </div>
                    <span className="font-medium text-white">{f.profiles?.username}</span>
                  </div>
                  <Link href={`/games?challenge=${f.profiles?.id}`}
                    className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold text-white"
                    style={{background:"var(--lj-blue)"}}>
                    <Swords size={12}/> Challenge
                  </Link>
                </div>
              ))}
            </div>
        }
      </div>

      {outgoing.length > 0 && (
        <div className="lj-card p-5">
          <h2 className="mb-2 text-sm font-bold text-[var(--lj-muted)] uppercase tracking-wide">Pending Sent</h2>
          <div className="space-y-1">
            {outgoing.map(r => (
              <div key={r.id} className="flex items-center gap-2 text-sm text-[var(--lj-muted)]">
                <Send size={12}/> {r.profiles?.username} — pending
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
