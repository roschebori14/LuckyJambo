"use client";

import { useState } from "react";
import Link from "next/link";
import { UserPlus, Check, X, Swords, Send, Clock } from "lucide-react";

interface Friend { friend_id: string; profiles: { id: string; username: string } }
interface Request { id: string; sender_id?: string; receiver_id?: string; profiles: { username: string } }

interface Props {
  friends: Friend[];
  incoming: Request[];
  outgoing: Request[];
  currentUserId: string;
}

export default function FriendsClient({ friends: initialFriends, incoming: initialIncoming, outgoing, currentUserId }: Props) {
  const [friends, setFriends] = useState(initialFriends);
  const [incoming, setIncoming] = useState(initialIncoming);
  const [username, setUsername] = useState("");
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState<"ok"|"err">("ok");

  async function sendRequest() {
    if (!username.trim() || sending) return;
    setSending(true); setMsg("");
    const res = await fetch("/api/friends/send", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: username.trim() }),
    });
    const json = await res.json();
    setSending(false);
    if (json.success) { setMsg("Friend request sent!"); setMsgType("ok"); setUsername(""); }
    else { setMsg(json.message); setMsgType("err"); }
  }

  async function respond(requestId: string, accept: boolean) {
    const res = await fetch("/api/friends/respond", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ request_id: requestId, accept }),
    });
    const json = await res.json();
    if (json.success) {
      const r = incoming.find(x => x.id === requestId);
      setIncoming(prev => prev.filter(x => x.id !== requestId));
      if (accept && r) setFriends(prev => [...prev, { friend_id: r.sender_id!, profiles: { id: r.sender_id!, username: r.profiles.username } }]);
    }
  }

  return (
    <div className="space-y-5">
      {/* Add friend */}
      <div className="lj-card p-5 space-y-3">
        <h2 className="font-bold text-white flex items-center gap-2"><UserPlus size={16} style={{color:"var(--lj-cyan)"}} /> Add Friend</h2>
        <div className="flex gap-2">
          <input value={username} onChange={e => setUsername(e.target.value)}
            onKeyDown={e => e.key === "Enter" && sendRequest()}
            placeholder="Enter username…" className="lj-input flex-1" />
          <button onClick={sendRequest} disabled={sending || !username.trim()}
            className="flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
            style={{ background: "linear-gradient(135deg, var(--lj-blue), var(--lj-cyan))" }}>
            <Send size={14} /> {sending ? "…" : "Send"}
          </button>
        </div>
        {msg && <p className={`text-sm ${msgType === "ok" ? "text-[var(--lj-success)]" : "text-red-400"}`}>{msg}</p>}
      </div>

      {/* Incoming requests */}
      {incoming.length > 0 && (
        <div className="lj-card p-5 space-y-3">
          <h2 className="font-bold text-white flex items-center gap-2">
            <Clock size={16} style={{color:"#f59e0b"}} />
            Incoming Requests <span className="lj-badge bg-yellow-400/20 text-yellow-400">{incoming.length}</span>
          </h2>
          {incoming.map(r => (
            <div key={r.id} className="flex items-center justify-between rounded-xl px-3 py-3" style={{ background: "rgba(255,255,255,0.03)" }}>
              <span className="font-medium text-white">{r.profiles.username}</span>
              <div className="flex gap-2">
                <button onClick={() => respond(r.id, true)} className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold text-white" style={{ background: "var(--lj-success)" }}>
                  <Check size={12} /> Accept
                </button>
                <button onClick={() => respond(r.id, false)} className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold text-white" style={{ background: "var(--lj-danger)" }}>
                  <X size={12} /> Decline
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Outgoing */}
      {outgoing.length > 0 && (
        <div className="lj-card p-5 space-y-2">
          <h2 className="font-bold text-white text-sm">Pending Sent</h2>
          {outgoing.map(r => (
            <div key={r.id} className="flex items-center justify-between text-sm py-1">
              <span className="text-[var(--lj-text)]">{r.profiles.username}</span>
              <span className="lj-badge bg-blue-500/20 text-blue-300">pending</span>
            </div>
          ))}
        </div>
      )}

      {/* Friends list */}
      <div className="lj-card p-5 space-y-3">
        <h2 className="font-bold text-white">{friends.length} Friends</h2>
        {friends.length === 0
          ? <p className="text-sm text-[var(--lj-muted)]">No friends yet. Add some using their username above.</p>
          : friends.map(f => (
            <div key={f.friend_id} className="flex items-center justify-between rounded-xl px-3 py-3" style={{ background: "rgba(255,255,255,0.03)" }}>
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-black text-white"
                  style={{ background: "linear-gradient(135deg, var(--lj-blue), var(--lj-cyan))" }}>
                  {f.profiles.username[0]?.toUpperCase()}
                </div>
                <span className="font-medium text-white">{f.profiles.username}</span>
              </div>
              <Link href={`/games?challenge=${f.friend_id}`}
                className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold text-white"
                style={{ background: "var(--lj-blue)" }}>
                <Swords size={12} /> Challenge
              </Link>
            </div>
          ))
        }
      </div>
    </div>
  );
}
