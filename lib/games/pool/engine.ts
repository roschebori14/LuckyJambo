import {
  BALL_RADIUS,
  POCKETS,
  POCKET_RADIUS,
  TABLE_HEIGHT,
  TABLE_WIDTH,
  type BallType,
  type PlayerSeat,
  type PoolBall,
  type PoolState,
  type ShotSubmission,
} from "@/types/pool";

export class PoolRulesError extends Error {}

function ballType(id: number): BallType {
  if (id === 0) return "cue";
  if (id === 8) return "eight";
  return id < 8 ? "solid" : "stripe";
}

/** Standard triangular rack: 1-ball at the apex, 8-ball centered in
 *  the third row, one solid and one stripe in the two back corners
 *  (standard tournament constraint), everything else shuffled. Cue
 *  ball placed at the head spot for the break. */
export function createInitialState(aPlayerId: string): PoolState {
  const rackApexX = TABLE_WIDTH * 0.72;
  const rowSpacingX = BALL_RADIUS * Math.sqrt(3);
  const ballSpacingY = BALL_RADIUS * 2 + 0.5;
  const centerY = TABLE_HEIGHT / 2;

  const slots: { row: number; col: number; x: number; y: number }[] = [];
  for (let row = 0; row < 5; row++) {
    const x = rackApexX + row * rowSpacingX;
    for (let col = 0; col <= row; col++) {
      const y = centerY - (row * ballSpacingY) / 2 + col * ballSpacingY;
      slots.push({ row, col, x, y });
    }
  }

  const solids = [2, 3, 4, 5, 6, 7];
  const stripes = [9, 10, 11, 12, 13, 14, 15];
  shuffle(solids);
  shuffle(stripes);

  const balls: PoolBall[] = [{ id: 0, type: "cue", x: TABLE_WIDTH * 0.25, y: centerY, pocketed: false }];

  for (const slot of slots) {
    let id: number;
    if (slot.row === 0 && slot.col === 0) {
      id = 1;
    } else if (slot.row === 2 && slot.col === 1) {
      id = 8;
    } else if (slot.row === 4 && slot.col === 0) {
      id = solids.pop()!;
    } else if (slot.row === 4 && slot.col === 4) {
      id = stripes.pop()!;
    } else {
      id = Math.random() < 0.5 ? solids.pop() ?? stripes.pop()! : stripes.pop() ?? solids.pop()!;
    }
    balls.push({ id, type: ballType(id), x: slot.x, y: slot.y, pocketed: false });
  }

  return {
    game_type: "eight-ball-pool",
    a_player_id: aPlayerId,
    b_player_id: null,
    balls,
    current_turn: "A",
    phase: "break",
    player_type: { A: null, B: null },
    ball_in_hand: null,
    winner: null,
    game_over: false,
    last_foul_reason: null,
    shot_number: 0,
  };
}

function shuffle<T>(arr: T[]) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function otherSeat(seat: PlayerSeat): PlayerSeat {
  return seat === "A" ? "B" : "A";
}

/** Cheap plausibility checks on a client-reported shot result - not a
 *  physics replay (see migration 064_eight_ball_pool.sql for why),
 *  just sanity bounds that catch obviously-tampered results cheaply:
 *  balls must stay on the table, non-pocketed balls can't overlap
 *  each other, and a "pocketed" ball must actually be near a pocket. */
function validatePlausibility(positions: ShotSubmission["final_positions"]) {
  const resting = positions.filter((p) => !p.pocketed);

  for (const p of positions) {
    if (p.pocketed) {
      const nearPocket = POCKETS.some(
        (pk) => Math.hypot(pk.x - p.x, pk.y - p.y) <= POCKET_RADIUS + BALL_RADIUS
      );
      if (!nearPocket) {
        throw new PoolRulesError(`Ball ${p.id} was reported pocketed but isn't near a pocket`);
      }
    } else {
      if (p.x < 0 || p.x > TABLE_WIDTH || p.y < 0 || p.y > TABLE_HEIGHT) {
        throw new PoolRulesError(`Ball ${p.id} is outside the table`);
      }
    }
  }

  for (let i = 0; i < resting.length; i++) {
    for (let j = i + 1; j < resting.length; j++) {
      const dist = Math.hypot(resting[i].x - resting[j].x, resting[i].y - resting[j].y);
      if (dist < BALL_RADIUS * 2 - 0.5) {
        throw new PoolRulesError("Reported ball positions overlap - rejected");
      }
    }
  }
}

export interface ShotOutcome {
  state: PoolState;
  foul: boolean;
  foulReason: string | null;
  wonBy: PlayerSeat | null;
}

/** Validates and applies a submitted shot's outcome against the
 *  current state. Throws PoolRulesError for an illegal *request*
 *  (not your turn, game already over, implausible positions) - a
 *  legal request that happens to be a foul is not an error, it's a
 *  normal outcome with `foul: true`. */
export function applyShot(state: PoolState, seat: PlayerSeat, shot: ShotSubmission): ShotOutcome {
  if (state.game_over) throw new PoolRulesError("This match has already ended");
  if (state.current_turn !== seat) throw new PoolRulesError("Not your turn");

  validatePlausibility(shot.final_positions);

  const posById = new Map(shot.final_positions.map((p) => [p.id, p]));
  const newBalls: PoolBall[] = state.balls.map((b) => {
    const p = posById.get(b.id);
    if (!p) return b;
    return { ...b, x: p.x, y: p.y, pocketed: b.pocketed || p.pocketed };
  });

  const newlyPocketed = newBalls.filter(
    (b, i) => b.pocketed && !state.balls[i].pocketed
  );
  const pocketedNumbered = newlyPocketed.filter((b) => b.type !== "cue");
  const eightPocketed = newlyPocketed.some((b) => b.type === "eight");
  const cueScratched = shot.cue_pocketed;

  let foul = false;
  let foulReason: string | null = null;
  const myType = state.player_type[seat];
  const oppType = state.player_type[otherSeat(seat)];

  // No ball contacted at all is always a foul.
  if (shot.first_contact_ball_id === null) {
    foul = true;
    foulReason = "No ball was hit";
  } else {
    const firstType = ballType(shot.first_contact_ball_id);
    // Once assigned, must hit your own type first (except when only
    // the 8-ball remains for you, or table still open).
    if (myType && firstType !== "eight") {
      const remainingMine = newBalls.some((b) => b.type === myType && !b.pocketed);
      if (remainingMine && firstType !== myType) {
        foul = true;
        foulReason = `Hit a ${firstType} ball first instead of your own (${myType})`;
      }
    }
    if (myType && firstType === "eight") {
      const remainingMine = newBalls.some((b) => b.type === myType && !b.pocketed);
      if (remainingMine) {
        foul = true;
        foulReason = "Hit the 8-ball before clearing your own balls";
      }
    }
  }

  if (cueScratched) {
    foul = true;
    foulReason = foulReason ?? "Cue ball was pocketed (scratch)";
  }

  // 8-ball pocketed: either a win or an instant loss, depending on
  // whether the shooter had already cleared their group and didn't
  // also scratch.
  let wonBy: PlayerSeat | null = null;
  let gameOver = false;
  let winner: PlayerSeat | null = null;

  if (eightPocketed) {
    const clearedOwnGroup = myType
      ? !newBalls.some((b) => b.type === myType && !b.pocketed)
      : false;
    gameOver = true;
    if (clearedOwnGroup && !cueScratched && !foul) {
      winner = seat;
      wonBy = seat;
    } else {
      winner = otherSeat(seat);
      wonBy = otherSeat(seat);
      foul = true;
      foulReason = foulReason ?? "8-ball pocketed illegally";
    }
  }

  // Assignment: first legal (non-foul, non-break) pot of a single
  // ball type assigns that type to the shooter and the other type to
  // the opponent. A mixed pot, a foul, or the break shot itself all
  // leave the table open - deliberate simplification, documented in
  // migration 064_eight_ball_pool.sql.
  let playerType = state.player_type;
  let phase = state.phase;
  const wasBreak = state.phase === "break";
  if (phase !== "game_over" && !gameOver) {
    if (phase === "break") {
      phase = "open";
    } else if (phase === "open" && !foul && pocketedNumbered.length > 0) {
      const types = new Set(pocketedNumbered.map((b) => b.type));
      if (types.size === 1) {
        const assignedType = pocketedNumbered[0].type as BallType;
        playerType = {
          ...playerType,
          [seat]: assignedType,
          [otherSeat(seat)]: assignedType === "solid" ? "stripe" : "solid",
        };
        phase = "assigned";
      }
    }
  }

  // Turn passes unless the shooter legally pocketed at least one of
  // their own numbered balls with no foul (standard "shoot again"
  // rule). Ball-in-hand goes to the opponent on any foul.
  //
  // The `wasBreak` check matters: the block above unconditionally
  // flips phase from "break" to "open" so a plain `phase !== "open"`
  // check here can no longer tell a break shot apart from any other
  // open-table shot - without it, legally pocketing a ball on the
  // break still passed the turn to the opponent instead of letting
  // the breaker shoot again, which every real ruleset disagrees with.
  const pocketedOwn = myType
    ? pocketedNumbered.some((b) => b.type === myType)
    : pocketedNumbered.length > 0 && (wasBreak || phase !== "open"); // table just got assigned (or broken) this shot

  const goAgain = !foul && !gameOver && pocketedOwn;
  const nextTurn = goAgain ? seat : otherSeat(seat);
  const ballInHand = foul && !gameOver ? otherSeat(seat) : null;

  const newState: PoolState = {
    ...state,
    balls: newBalls,
    current_turn: nextTurn,
    phase: gameOver ? "game_over" : phase,
    player_type: playerType,
    ball_in_hand: ballInHand,
    winner,
    game_over: gameOver,
    last_foul_reason: foulReason,
    shot_number: state.shot_number + 1,
  };

  return { state: newState, foul, foulReason, wonBy };
}
