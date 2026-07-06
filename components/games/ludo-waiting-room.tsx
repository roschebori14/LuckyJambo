"use client";

import { useEffect, useState } from "react";
import { Check, Copy, UserRound } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useMatchRealtime } from "@/hooks/use-match-realtime";
import type { LudoState, LudoColor } from "@/types/ludo";

const COLOR_HEX: Record<LudoColor, string> = {
  red: "#ef4444", green: "#22c55e", yellow: "#eab308", blue: "#3b82f6",
};

interface Props {
  matchId: string;
  userId: string;
  stakeAmount: number;
  shareUrl: string;
  copied: boolean;
  onCopy: () => void;
  cancelling: boolean;
  cancelError: string;
  onCancel: () => void;
}

/**
 * Ludo needs its own waiting room instead of the shared
 * WaitingForOpponent (built for a binary you-vs-one-opponent layout) -
 * this shows all 2-4 seats, who's filled them, and (creator only) a
 * "Start Now" button once 2+ have joined, wired to start_ludo_match.
 */
export default function LudoWaitingRoom({
  matchId, userId, stakeAmount, shareUrl, copied, onCopy, cancelling, cancelError, onCancel,
}: Props) {
  const [state, setState] = useState<LudoState | null>(null);
  const [usernames, setUsernames] = useState<Map<string, string>>(new Map());
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState("");

  async function load() {
    try {
      const res = await fetch(`/api/ludo/state?match_id=${matchId}`);
      const json = await res.json();
      if (json.success) setState(json.match.game_state as LudoState);
    } catch { /* poll/realtime will retry */ }
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId]);

  useMatchRealtime(matchId, (row) => {
    if (row.game_state) setState(row.game_state as LudoState);
  });

  useEffect(() => {
    if (!state) return;
    const ids = state.seats.filter(Boolean).map((s) => s!.user_id).filter((id) => !usernames.has(id));
    if (ids.length === 0) return;
    (async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase.rpc("get_public_profiles_by_ids", { p_ids: ids });
        setUsernames((prev) => {
          const next = new Map(prev);
          (data ?? []).forEach((p: { id: string; username: string }) => next.set(p.id, p.username));
          return next;
        });
      } catch { /* falls back to "Player" */ }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.seats]);

  async function startNow() {
    setStarting(true);
    setStartError("");
    try {
      const res = await fetch("/api/ludo/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ match_id: matchId }),
      });
      const json = await res.json();
      if (!json.success) setStartError(json.message ?? "Could not start match");
      // On success the match row flips to status "active"; the parent
      // page's own match-status polling/realtime (game-client.tsx)
      // picks that up and swaps this waiting room out for the board.
    } catch {
      setStartError("Network error — please try again.");
    } finally {
      setStarting(false);
    }
  }

  if (!state) {
    return <div className="flex h-48 items-center justify-center text-sm text-[var(--lj-muted)]">Loading lobby…</div>;
  }

  const isCreator = state.seats[0]?.user_id === userId;
  const joinedCount = state.seats.filter(Boolean).length;

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--lj-border)] bg-[var(--lj-card-2)] shadow-sm">
      <div className="flex flex-col items-center gap-4 px-6 pb-6 pt-8 text-center">
        <h3 className="text-xl font-black text-white">Ludo lobby</h3>
        <p className="text-sm text-[var(--lj-muted)]">{joinedCount} of {state.max_players} joined</p>

        <div className="grid w-full max-w-sm grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: state.max_players }).map((_, i) => {
            const seat = state.seats[i];
            return (
              <div
                key={i}
                className="flex flex-col items-center gap-1.5 rounded-xl border border-[var(--lj-border)] bg-white/[0.03] px-2 py-3"
              >
                {seat ? (
                  <>
                    <div
                      className="flex h-9 w-9 items-center justify-center rounded-full text-white"
                      style={{ background: COLOR_HEX[seat.color] }}
                    >
                      <UserRound size={16} />
                    </div>
                    <span className="max-w-full truncate text-[11px] font-semibold text-white">
                      {usernames.get(seat.user_id) ?? "Player"}
                    </span>
                  </>
                ) : (
                  <>
                    <div className="flex h-9 w-9 animate-pulse items-center justify-center rounded-full border-2 border-dashed border-[var(--lj-border)]" />
                    <span className="text-[11px] font-semibold text-[var(--lj-muted)]">Open</span>
                  </>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex w-full max-w-xs items-center justify-between rounded-xl px-4 py-2.5 text-sm"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--lj-border)" }}>
          <div className="text-left">
            <p className="text-[10px] uppercase tracking-wide text-[var(--lj-muted)]">Your stake</p>
            <p className="font-bold text-white">{stakeAmount.toLocaleString()} XAF</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wide text-[var(--lj-muted)]">Pot so far</p>
            <p className="lj-stake font-bold">{(stakeAmount * joinedCount).toLocaleString()} XAF</p>
          </div>
        </div>

        {isCreator && (
          <div className="w-full max-w-xs">
            {startError && <p className="mb-2 text-xs text-red-400">{startError}</p>}
            <button
              onClick={startNow}
              disabled={joinedCount < 2 || starting}
              className="lj-btn-primary w-full disabled:opacity-40"
            >
              {starting ? "Starting…" : joinedCount < 2 ? "Need 2+ players to start" : "Start Now"}
            </button>
          </div>
        )}
      </div>

      <div className="space-y-3 border-t px-6 py-5" style={{ borderColor: "var(--lj-border)" }}>
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--lj-muted)]">Invite more players</p>
        <div className="flex w-full items-center gap-2 rounded-lg border bg-white/5 p-2" style={{ borderColor: "var(--lj-border)" }}>
          <input type="text" readOnly value={shareUrl} className="w-full bg-transparent text-sm text-[var(--lj-muted)] outline-none" />
          <button onClick={onCopy} className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700">
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>

      {cancelError && (
        <div className="mx-6 mb-2 rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-300">{cancelError}</div>
      )}

      {isCreator && (
        <div className="flex justify-center border-t px-6 py-4" style={{ borderColor: "var(--lj-border)" }}>
          <button
            onClick={onCancel}
            disabled={cancelling}
            className="rounded-xl border border-red-400/30 px-5 py-2 text-sm font-semibold text-red-400 hover:bg-red-500/10 disabled:opacity-50"
          >
            {cancelling ? "Cancelling…" : "Cancel Match & Refund Everyone"}
          </button>
        </div>
      )}
    </div>
  );
}
