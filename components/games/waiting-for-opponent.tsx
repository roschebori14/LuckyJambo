"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Share2, Swords, UserRound, Users } from "lucide-react";
import Link from "next/link";
import { GameIcon } from "./game-icons";

const TIPS = [
  "You can watch other live matches from the Matches page while you wait.",
  "Your stake is locked safely and refunded in full if nobody joins and you cancel.",
  "Challenge a specific friend next time for a guaranteed opponent.",
  "Rated players show a verified badge on their profile.",
  "Open matches are visible to every player online right now.",
];

function elapsed(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

interface WaitingForOpponentProps {
  gameSlug: string;
  gameName: string;
  stakeAmount: number;
  createdAt: string;
  shareUrl: string;
  copied: boolean;
  onCopy: () => void;
  cancelling: boolean;
  cancelError: string;
  onCancel: () => void;
  invitedUsername?: string | null;
}

export default function WaitingForOpponent({
  gameSlug,
  gameName,
  stakeAmount,
  createdAt,
  shareUrl,
  copied,
  onCopy,
  cancelling,
  cancelError,
  onCancel,
  invitedUsername,
}: WaitingForOpponentProps) {
  const [seconds, setSeconds] = useState(0);
  const [tipIndex, setTipIndex] = useState(0);
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    const start = new Date(createdAt).getTime();
    const tick = () => setSeconds(Math.max(0, Math.floor((Date.now() - start) / 1000)));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [createdAt]);

  useEffect(() => {
    const interval = setInterval(() => setTipIndex((i) => (i + 1) % TIPS.length), 6000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setCanShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
  }, []);

  async function nativeShare() {
    try {
      await navigator.share({
        title: "Join my Lucky Jambo match",
        text: `I've staked ${stakeAmount.toLocaleString()} XAF on a ${gameName} match — join me!`,
        url: shareUrl,
      });
    } catch {
      /* user cancelled the share sheet - nothing to do */
    }
  }

  const potentialPrize = Math.round(stakeAmount * 2 * 0.95);

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--lj-border)] bg-[var(--lj-card-2)] shadow-sm">
      {/* Radar-style searching header */}
      <div className="relative flex flex-col items-center gap-4 px-6 pb-8 pt-10 text-center">
        <div className="relative flex h-24 w-24 items-center justify-center">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-20"
            style={{ background: "var(--lj-blue)" }} />
          <span className="absolute inline-flex h-[85%] w-[85%] animate-pulse rounded-full opacity-30"
            style={{ background: "var(--lj-cyan)" }} />
          <div className="relative flex h-16 w-16 items-center justify-center rounded-full shadow-lg"
            style={{ background: "linear-gradient(135deg, var(--lj-blue) 0%, var(--lj-cyan) 100%)" }}>
            <GameIcon slug={gameSlug} className="h-9 w-9 text-white" />
          </div>
        </div>

        <div>
          <h3 className="text-xl font-black text-white">
            {invitedUsername ? `Waiting for ${invitedUsername}…` : "Looking for an opponent…"}
          </h3>
          <p className="mt-1 text-sm text-[var(--lj-muted)]">
            {gameName} · {elapsed(seconds)} elapsed
          </p>
        </div>

        {/* You vs ? seat display */}
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-center gap-1.5">
            <div className="flex h-12 w-12 items-center justify-center rounded-full text-sm font-black text-white"
              style={{ background: "linear-gradient(135deg, var(--lj-blue) 0%, var(--lj-cyan) 100%)" }}>
              <UserRound size={20} />
            </div>
            <span className="text-[11px] font-semibold text-white">You</span>
          </div>
          <Swords size={16} className="text-[var(--lj-muted)]" />
          <div className="flex flex-col items-center gap-1.5">
            <div className="flex h-12 w-12 animate-pulse items-center justify-center rounded-full border-2 border-dashed"
              style={{ borderColor: "var(--lj-border)" }}>
              <Users size={18} className="text-[var(--lj-muted)]" />
            </div>
            <span className="text-[11px] font-semibold text-[var(--lj-muted)]">
              {invitedUsername ?? "Open seat"}
            </span>
          </div>
        </div>

        {/* Stake / prize summary */}
        <div className="flex w-full max-w-xs items-center justify-between rounded-xl px-4 py-2.5 text-sm"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--lj-border)" }}>
          <div className="text-left">
            <p className="text-[10px] uppercase tracking-wide text-[var(--lj-muted)]">Your stake</p>
            <p className="font-bold text-white">{stakeAmount.toLocaleString()} XAF</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wide text-[var(--lj-muted)]">Winner takes</p>
            <p className="font-bold text-green-400">{potentialPrize.toLocaleString()} XAF</p>
          </div>
        </div>
      </div>

      {/* Share section */}
      <div className="space-y-3 border-t px-6 py-5" style={{ borderColor: "var(--lj-border)" }}>
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--lj-muted)]">
          {invitedUsername ? "Or share the link directly" : "Invite someone to speed this up"}
        </p>
        <div className="flex w-full items-center gap-2 rounded-lg border bg-white/5 p-2"
          style={{ borderColor: "var(--lj-border)" }}>
          <input
            type="text"
            readOnly
            value={shareUrl}
            className="w-full bg-transparent text-sm text-[var(--lj-muted)] outline-none"
          />
          <button
            onClick={onCopy}
            className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {canShare && (
            <button
              onClick={nativeShare}
              className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold text-white hover:bg-white/5"
              style={{ borderColor: "var(--lj-border)" }}
            >
              <Share2 size={14} /> Share…
            </button>
          )}
          {!invitedUsername && (
            <Link
              href="/matches"
              className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold text-white hover:bg-white/5"
              style={{ borderColor: "var(--lj-border)" }}
            >
              <UserRound size={14} /> Challenge a friend instead
            </Link>
          )}
        </div>
      </div>

      {/* Rotating tip */}
      <div className="border-t px-6 py-3 text-center text-xs text-[var(--lj-muted)]" style={{ borderColor: "var(--lj-border)" }}>
        💡 {TIPS[tipIndex]}
      </div>

      {cancelError && (
        <div className="mx-6 mb-2 rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {cancelError}
        </div>
      )}

      <div className="flex justify-center border-t px-6 py-4" style={{ borderColor: "var(--lj-border)" }}>
        <button
          onClick={onCancel}
          disabled={cancelling}
          className="rounded-xl border border-red-400/30 px-5 py-2 text-sm font-semibold text-red-400 hover:bg-red-500/10 disabled:opacity-50"
        >
          {cancelling ? "Cancelling…" : "Cancel Match & Get Refund"}
        </button>
      </div>
    </div>
  );
}
