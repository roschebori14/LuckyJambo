// Shared constants/types for Battleship. The fleet sizes here must
// stay in sync with `_place_battleship_fleet` in
// supabase/migrations/035_battleship.sql - this file only mirrors
// them for client-side rendering (e.g. drawing the correct ship
// lengths), it never decides placement or hit resolution. All of
// that is computed server-side so a tampered client can't see or
// influence ship positions.

export const GRID_SIZE = 8;
export const CELL_COUNT = GRID_SIZE * GRID_SIZE;

export const FLEET = [
  { name: "carrier", label: "Carrier", size: 4 },
  { name: "cruiser", label: "Cruiser", size: 3 },
  { name: "destroyer", label: "Destroyer", size: 3 },
  { name: "patrol_boat", label: "Patrol Boat", size: 2 },
] as const;

export type ShipName = (typeof FLEET)[number]["name"];

export interface OwnShip {
  name: ShipName;
  size: number;
  cells: number[];
  sunk: boolean;
}

export type ShotResult = "hit" | "miss";

export interface BattleshipState {
  game_type: "battleship";
  grid_size: number;
  player_a_id: string;
  player_b_id: string | null;
  current_turn: string | null;
  shots_on_a: Record<string, ShotResult>;
  shots_on_b: Record<string, ShotResult>;
  ships_alive_a: number;
  ships_alive_b: number;
  sunk_ships_a: ShipName[];
  sunk_ships_b: ShipName[];
  winner_id: string | null;
  game_over: boolean;
}

export function shipLabel(name: string): string {
  return FLEET.find((s) => s.name === name)?.label ?? name;
}
