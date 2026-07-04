"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Crosshair, Ship, Flame, Waves } from "lucide-react";
import { GRID_SIZE, CELL_COUNT, shipLabel, type BattleshipState, type OwnShip } from "@/types/battleship";

interface Props {
  matchId: string;
  userId: string;
}

const COLS = "ABCDEFGH".split("");

export default function BattleshipBoard({ matchId, userId }: Props) {
  const [state, setState] = useState<BattleshipState | null>(null);
  const [myShips, setMyShips] = useState<OwnShip[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [firing, setFiring] = useState(false);
  const [error, setError] = useState("");
  const [lastShot, setLastShot] = useState<{ cell: number; hit: boolean } | null>(null);

  const fetchState = useCallback(async () => {
    const res = await fetch(`/api/battleship/state?match_id=${matchId}`);
    const json = await res.json();
    if (json.success) setState(json.state);
    setLoading(false);
  }, [matchId]);

  const fetchShips = useCallback(async () => {
    const res = await fetch(`/api/battleship/ships?match_id=${matchId}`);
    const json = await res.json();
    if (json.success) setMyShips(json.ships);
  }, [matchId]);

  useEffect(() => {
    fetchState();
    fetchShips();
    const interval = setInterval(fetchState, 2500);
    return () => clearInterval(interval);
  }, [fetchState, fetchShips]);

  const isPlayerA = state?.player_a_id === userId;
  const myAliveKey = isPlayerA ? "ships_alive_a" : "ships_alive_b";
  const oppAliveKey = isPlayerA ? "ships_alive_b" : "ships_alive_a";
  const myShotsReceivedKey = isPlayerA ? "shots_on_a" : "shots_on_b"; // shots fired AT me
  const myShotsFiredKey = isPlayerA ? "shots_on_b" : "shots_on_a"; // shots I've fired
  const mySunkKey = isPlayerA ? "sunk_ships_a" : "sunk_ships_b";

  const isMyTurn = !!state && !state.game_over && state.current_turn === userId;
  const iWon = state?.game_over && state.winner_id === userId;

  const shotsIFired = state?.[myShotsFiredKey] ?? {};
  const shotsAgainstMe = state?.[myShotsReceivedKey] ?? {};
  const mySunkShips = useMemo(() => new Set(state?.[mySunkKey] ?? []), [state, mySunkKey]);

  const myShipCells = useMemo(() => {
    const map = new Map<number, { name: string; sunk: boolean }>();
    for (const ship of myShips ?? []) {
      for (const cell of ship.cells) map.set(cell, { name: ship.name, sunk: ship.sunk });
    }
    return map;
  }, [myShips]);

  async function fire(cell: number) {
    if (!state || !isMyTurn || firing) return;
    if (shotsIFired[String(cell)]) return;

    setFiring(true);
    setError("");
    try {
      const res = await fetch("/api/battleship/shot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ match_id: matchId, cell }),
      });
      const json = await res.json();
      if (json.success) {
        setState(json.state);
        setLastShot({ cell, hit: json.hit });
      } else {
        setError(json.message ?? "Shot failed");
      }
    } catch {
      setError("Network error — please try again.");
    } finally {
      setFiring(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  if (!state) return <p className="text-center text-[var(--lj-muted)]">Failed to load game state.</p>;

  const statusText = state.game_over
    ? iWon
      ? "🏆 You sank the enemy fleet!"
      : "💥 Your fleet was sunk."
    : isMyTurn
    ? "Your turn — fire at the enemy grid"
    : "Waiting for opponent to fire…";

  return (
    <div className="flex flex-col items-center gap-5">
      {/* Status bar */}
      <div
        className={`w-full rounded-xl px-4 py-3 text-center text-sm font-semibold ${
          state.game_over
            ? iWon
              ? "bg-green-500/10 text-green-300"
              : "bg-red-500/10 text-red-300"
            : isMyTurn
            ? "bg-blue-500/10 text-blue-300"
            : "bg-white/5 text-[var(--lj-muted)]"
        }`}
      >
        {statusText}
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {/* Fleet strength */}
      <div className="flex w-full items-center justify-between px-1 text-xs text-[var(--lj-muted)]">
        <span className="flex items-center gap-1.5">
          <Ship size={14} className="text-blue-400" /> Your fleet: {state[myAliveKey]}/12 cells afloat
        </span>
        <span className="flex items-center gap-1.5">
          Enemy fleet: {state[oppAliveKey]}/12 cells afloat <Crosshair size={14} className="text-red-400" />
        </span>
      </div>

      {/* Enemy waters — clickable */}
      <div className="w-full">
        <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[var(--lj-muted)]">
          <Crosshair size={13} /> Enemy Waters
        </p>
        <Grid
          size={GRID_SIZE}
          onCellClick={fire}
          renderCell={(cell) => {
            const key = String(cell);
            const shot = shotsIFired[key];
            const clickable = isMyTurn && !shot && !firing && !state.game_over;
            return (
              <button
                key={cell}
                onClick={() => fire(cell)}
                disabled={!clickable}
                className={cellClass(shot, clickable, lastShot?.cell === cell)}
              >
                {shot === "hit" && <Flame size={15} className="text-orange-300" />}
                {shot === "miss" && <span className="h-1.5 w-1.5 rounded-full bg-[var(--lj-blue-2)]/70" />}
              </button>
            );
          }}
        />
      </div>

      {/* Your fleet — read-only */}
      <div className="w-full">
        <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[var(--lj-muted)]">
          <Ship size={13} /> Your Fleet
        </p>
        <Grid
          size={GRID_SIZE}
          renderCell={(cell) => {
            const key = String(cell);
            const shot = shotsAgainstMe[key];
            const ship = myShipCells.get(cell);
            return (
              <div
                key={cell}
                className={ownCellClass(!!ship, ship?.sunk, shot)}
              >
                {shot === "hit" && <Flame size={13} className="text-orange-200" />}
                {shot === "miss" && <Waves size={11} className="text-[var(--lj-blue-2)]/60" />}
              </div>
            );
          }}
        />
      </div>

      {mySunkShips.size > 0 && (
        <p className="text-xs text-red-400">
          Sunk: {[...mySunkShips].map((s) => shipLabel(s)).join(", ")}
        </p>
      )}
    </div>
  );
}

function Grid({
  size,
  renderCell,
}: {
  size: number;
  onCellClick?: (cell: number) => void;
  renderCell: (cell: number) => React.ReactNode;
}) {
  return (
    <div className="overflow-x-auto">
      <div
        className="grid gap-[3px] mx-auto"
        style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`, maxWidth: 360 }}
      >
        {Array.from({ length: CELL_COUNT }, (_, cell) => renderCell(cell))}
      </div>
      <div className="mx-auto mt-1 flex justify-center gap-1 text-[9px] text-[var(--lj-muted)]" style={{ maxWidth: 360 }}>
        {COLS.map((c) => (
          <span key={c} className="flex-1 text-center">{c}</span>
        ))}
      </div>
    </div>
  );
}

function cellClass(shot: string | undefined, clickable: boolean, justFired: boolean) {
  const base = "aspect-square rounded-md flex items-center justify-center transition-all";
  if (shot === "hit") return `${base} bg-red-500/25 border border-red-400/40`;
  if (shot === "miss") return `${base} bg-white/5 border border-[var(--lj-border)]`;
  return `${base} border border-[var(--lj-border)] ${
    clickable
      ? "bg-blue-500/5 hover:bg-blue-500/20 active:scale-95 cursor-pointer"
      : "bg-white/5 cursor-default"
  } ${justFired ? "ring-2 ring-blue-400" : ""}`;
}

function ownCellClass(hasShip: boolean, sunk: boolean | undefined, shot: string | undefined) {
  const base = "aspect-square rounded-md flex items-center justify-center border";
  if (sunk) return `${base} bg-red-900/50 border-red-500/50`;
  if (shot === "hit") return `${base} bg-orange-500/25 border-orange-400/50`;
  if (hasShip) return `${base} bg-[var(--lj-blue-2)]/25 border-[var(--lj-blue-2)]/40`;
  if (shot === "miss") return `${base} bg-white/5 border-[var(--lj-border)]`;
  return `${base} bg-white/[0.03] border-[var(--lj-border)]`;
}
