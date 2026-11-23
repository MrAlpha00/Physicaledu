/**
 * Deterministic carrom rules and fixed-timestep simulation.
 *
 * The browser renders this exact state, but only the parameters of a shot
 * (angle, power and striker placement) cross the network. The same pure
 * simulation runs in the authoritative layer, so the client can never claim a
 * board outcome it did not earn.
 */
import type { Json } from "@/types/database";
import { num, opponent } from "../engine-utils";
import { completed, continued, rejected, type GameEngine, type Outcome, type PlayerIndex } from "../types";

export interface CarromPiece {
  id: string;
  kind: "striker" | "coin" | "queen";
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface CarromShot {
  actor: PlayerIndex;
  angle: number;
  power: number;
  pocketed: string[];
  foul: boolean;
  foulReason: string | null;
  queenCovered: boolean;
  points: number;
}

export interface CarromState {
  version: number;
  seq: number;
  turn: PlayerIndex | null;
  status: "active" | "completed";
  outcome: Outcome | null;
  pieces: CarromPiece[];
  scores: [number, number];
  lastShot: CarromShot | null;
  shotCount: number;
}

export interface CarromConfig {
  queenValue?: number;
  coinValue?: number;
  targetScore?: number;
}

const MIN = 2;
const MAX = 98;
const POCKET_RADIUS = 4.6;
const STRIKER_RADIUS = 2.8;
const COIN_RADIUS = 2.1;
const QUEEN_RADIUS = 2.3;
const FRICTION = 0.986;
const WALL_RESTITUTION = 0.86;
const COLLISION_RESTITUTION = 0.97;
const MAX_STEPS = 1400;
const SETTLE_SPEED = 0.02;

export const POCKETS: ReadonlyArray<{ x: number; y: number }> = [
  { x: 3.5, y: 3.5 }, { x: 50, y: 3.5 }, { x: 96.5, y: 3.5 },
  { x: 3.5, y: 50 }, { x: 96.5, y: 50 },
  { x: 3.5, y: 96.5 }, { x: 50, y: 96.5 }, { x: 96.5, y: 96.5 },
];

export const QUEEN_HOME = { x: 50, y: 44 };

const COIN_LAYOUT: Array<[number, number]> = [
  [44, 38], [50, 38], [56, 38],
  [44, 44], [56, 44],
  [44, 50], [50, 50], [56, 50],
  [50, 56],
];

function piece(kind: CarromPiece["kind"], id: string, x: number, y: number): CarromPiece {
  return { id, kind, x, y, vx: 0, vy: 0 };
}

function radius(value: CarromPiece): number {
  return value.kind === "striker" ? STRIKER_RADIUS : value.kind === "queen" ? QUEEN_RADIUS : COIN_RADIUS;
}

function mass(value: CarromPiece): number {
  return value.kind === "striker" ? 1.4 : value.kind === "queen" ? 1.1 : 1;
}

export function initialPieces(): CarromPiece[] {
  return [
    piece("striker", "striker", 50, 82),
    piece("queen", "queen", QUEEN_HOME.x, QUEEN_HOME.y),
    ...COIN_LAYOUT.map(([x, y], index) => piece("coin", `coin-${index + 1}`, x, y)),
  ];
}

export function legalStrikerZone(actor: PlayerIndex): { min: number; max: number } {
  return actor === 0 ? { min: 58, max: 94 } : { min: 6, max: 42 };
}

export function isLegalStrikerPlacement(pieces: CarromPiece[], x: number, y: number, actor: PlayerIndex): boolean {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
  const zone = legalStrikerZone(actor);
  if (x < 6 || x > 94 || y < zone.min || y > zone.max) return false;
  return pieces
    .filter((item) => item.kind !== "striker")
    .every((item) => Math.hypot(item.x - x, item.y - y) >= radius(item) + STRIKER_RADIUS - 0.2);
}

function pocketAt(value: CarromPiece): boolean {
  return POCKETS.some((target) => Math.hypot(value.x - target.x, value.y - target.y) <= POCKET_RADIUS);
}

export interface SimulationResult {
  pieces: CarromPiece[];
  pocketed: string[];
  strikerPocketed: boolean;
  hitAny: boolean;
}

/** Fixed-timestep simulation; identical inputs always produce identical outputs. */
export function simulateShot(initial: CarromPiece[], angle: number, power: number): SimulationResult {
  const pieces = initial.map((value) => ({ ...value }));
  const speed = 1 + Math.max(1, Math.min(100, power)) * 0.085;
  const striker = pieces.find((value) => value.kind === "striker");
  if (!striker) return { pieces, pocketed: [], strikerPocketed: false, hitAny: false };
  striker.vx = Math.cos(angle) * speed;
  striker.vy = Math.sin(angle) * speed;

  const pocketed: string[] = [];
  let strikerPocketed = false;
  let hitAny = false;

  for (let step = 0; step < MAX_STEPS; step += 1) {
    for (const value of pieces) {
      value.x += value.vx;
      value.y += value.vy;
      value.vx *= FRICTION;
      value.vy *= FRICTION;
    }

    for (let i = 0; i < pieces.length; i += 1) {
      for (let j = i + 1; j < pieces.length; j += 1) {
        const a = pieces[i];
        const b = pieces[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const distance = Math.hypot(dx, dy);
        const minimum = radius(a) + radius(b);
        if (distance === 0 || distance >= minimum) continue;

        const nx = dx / distance;
        const ny = dy / distance;
        const relative = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
        const ma = mass(a);
        const mb = mass(b);
        if (relative < 0) {
          const impulse = (-(1 + COLLISION_RESTITUTION) * relative) / (1 / ma + 1 / mb);
          a.vx -= (impulse / ma) * nx;
          a.vy -= (impulse / ma) * ny;
          b.vx += (impulse / mb) * nx;
          b.vy += (impulse / mb) * ny;
        }
        const overlap = minimum - distance + 0.01;
        a.x -= nx * overlap * (mb / (ma + mb));
        a.y -= ny * overlap * (mb / (ma + mb));
        b.x += nx * overlap * (ma / (ma + mb));
        b.y += ny * overlap * (ma / (ma + mb));

        if ((a.kind === "striker" && b.kind !== "striker") || (b.kind === "striker" && a.kind !== "striker")) {
          hitAny = true;
        }
      }
    }

    for (const value of pieces) {
      if (value.x < MIN) { value.x = MIN; value.vx = Math.abs(value.vx) * WALL_RESTITUTION; }
      if (value.x > MAX) { value.x = MAX; value.vx = -Math.abs(value.vx) * WALL_RESTITUTION; }
      if (value.y < MIN) { value.y = MIN; value.vy = Math.abs(value.vy) * WALL_RESTITUTION; }
      if (value.y > MAX) { value.y = MAX; value.vy = -Math.abs(value.vy) * WALL_RESTITUTION; }
    }

    for (let i = pieces.length - 1; i >= 0; i -= 1) {
      const value = pieces[i];
      if (!pocketAt(value)) continue;
      if (value.kind === "striker") {
        strikerPocketed = true;
        pieces.splice(i, 1);
      } else {
        pocketed.push(value.id);
        pieces.splice(i, 1);
      }
    }

    if (strikerPocketed) break;
    if (pieces.every((value) => Math.hypot(value.vx, value.vy) < SETTLE_SPEED)) break;
  }

  return { pieces, pocketed, strikerPocketed, hitAny };
}

function scoreAndTurn(
  state: CarromState,
  sim: SimulationResult,
  actor: PlayerIndex,
  config: CarromConfig,
): { state: CarromState; events: { type: string; message: string }[]; outcome: Outcome | null } {
  const coinValue = typeof config.coinValue === "number" ? config.coinValue : 1;
  const queenValue = typeof config.queenValue === "number" ? config.queenValue : 3;
  const queenPocketed = sim.pocketed.includes("queen");
  const coinIds = sim.pocketed.filter((id) => id !== "queen");
  const foul = sim.strikerPocketed || !sim.hitAny;
  const events: { type: string; message: string }[] = [];

  let pieces = sim.pieces;
  let points = 0;
  let queenCovered = false;

  if (foul) {
    const pocketedPieces = initialPieces().filter((value) => sim.pocketed.includes(value.id) && value.kind !== "striker");
    pieces = pieces.filter((value) => value.kind === "striker").map((value) => ({
      ...value,
      x: value.kind === "striker" ? (actor === 0 ? 50 : 50) : value.x,
      y: value.kind === "striker" ? (actor === 0 ? 82 : 18) : value.y,
      vx: 0,
      vy: 0,
    }));
    pieces.push(...pocketedPieces.map((value) => ({ ...value, vx: 0, vy: 0 })));
    events.push({
      type: "foul",
      message: sim.strikerPocketed ? "Foul — the striker was pocketed." : "Foul — no carrom piece was struck.",
    });
  } else {
    pieces = pieces.map((value) => ({ ...value, vx: 0, vy: 0 }));
    points = coinIds.length * coinValue;
    if (queenPocketed) {
      if (coinIds.length > 0) {
        points += queenValue;
        queenCovered = true;
        events.push({ type: "queen", message: `Queen covered and pocketed for ${queenValue} points.` });
      } else {
        const queen = initialPieces().find((value) => value.id === "queen");
        if (queen) pieces.push({ ...queen, vx: 0, vy: 0 });
        events.push({ type: "queen_returned", message: "Queen must be covered by a coin — it is returned to the centre." });
      }
    }
    if (coinIds.length > 0) events.push({ type: "pocket", message: `${coinIds.length} coin${coinIds.length === 1 ? "" : "s"} pocketed.` });
    if (coinIds.length === 0 && !queenPocketed) events.push({ type: "miss", message: "No coin was pocketed." });
  }

  const scores: [number, number] = [...state.scores];
  if (!foul) scores[actor] += points;

  const remaining = pieces.filter((value) => value.kind === "coin").length;
  const queenRemaining = pieces.some((value) => value.kind === "queen");
  let outcome: Outcome | null = null;
  if (remaining === 0 && !queenRemaining) {
    outcome = scores[0] === scores[1]
      ? { kind: "draw", winner: null, reason: "All coins cleared with level scores." }
      : { kind: "win", winner: scores[0] > scores[1] ? 0 : 1, reason: "All coins cleared." };
  }

  const keepsTurn = !foul && (coinIds.length > 0 || (queenPocketed && queenCovered));
  return {
    state: { ...state, pieces, scores, turn: keepsTurn ? actor : opponent(actor) },
    events,
    outcome,
  };
}

export const carromEngine: GameEngine<CarromState, CarromConfig> = {
  slug: "carrom",

  create() {
    return {
      version: 1,
      seq: 0,
      turn: 0,
      status: "active",
      outcome: null,
      pieces: initialPieces(),
      scores: [0, 0],
      lastShot: null,
      shotCount: 0,
    };
  },

  turn(state) {
    return state.turn;
  },

  outcome(state) {
    return state.outcome;
  },

  legal(state, actor) {
    return state.status === "active" && state.turn === actor ? ["strike"] : [];
  },

  apply(state, action, config) {
    if (action.type === "rematch") {
      if (state.status !== "completed") return rejected(state, "Only a finished game can be reset.");
      return {
        state: { ...carromEngine.create(), version: state.version + 1, seq: state.seq + 1 },
        events: [{ type: "rematch", message: "A fresh carrom board is ready." }],
        accepted: true,
      };
    }
    if (action.type !== "strike") return rejected(state, "Unknown carrom action.");
    if (state.status !== "active") return rejected(state, "This match has already finished.");
    if (state.turn !== action.actor) return rejected(state, "It is not your turn.");

    const angle = num(action.payload, "angle", Number.NaN);
    const power = num(action.payload, "power", Number.NaN);
    const x = num(action.payload, "strikerX", Number.NaN);
    const y = num(action.payload, "strikerY", Number.NaN);
    if (!Number.isFinite(angle)) return rejected(state, "Provide a valid aiming angle.");
    if (!Number.isFinite(power) || power < 1 || power > 100) return rejected(state, "Power must be between 1 and 100.");
    const striker = state.pieces.find((value) => value.kind === "striker");
    if (!striker) return rejected(state, "The striker is missing from this match.");
    const placement = Number.isFinite(x) && Number.isFinite(y) ? { x, y } : { x: striker.x, y: striker.y };
    if (!isLegalStrikerPlacement(state.pieces, placement.x, placement.y, action.actor)) {
      return rejected(state, "Place the striker inside your own half without overlapping a coin.");
    }

    const positioned = state.pieces.map((value) =>
      value.kind === "striker" ? { ...value, x: placement.x, y: placement.y } : { ...value },
    );
    const sim = simulateShot(positioned, angle, Math.round(power * 100) / 100);
    const resolved = scoreAndTurn(state, sim, action.actor, config);
    const foulReason = sim.strikerPocketed ? "striker_pocketed" : !sim.hitAny ? "no_contact" : null;
    const shot: CarromShot = {
      actor: action.actor,
      angle: Math.round(angle * 1000) / 1000,
      power: Math.round(power * 100) / 100,
      pocketed: sim.pocketed,
      foul: foulReason !== null,
      foulReason,
      queenCovered: false,
      points: resolved.state.scores[action.actor] - state.scores[action.actor],
    };

    if (resolved.outcome) {
      return completed(
        state,
        resolved.outcome,
        resolved.events,
        { ...resolved.state, lastShot: shot, shotCount: state.shotCount + 1 },
      );
    }
    return continued(state, resolved.events, {
      ...resolved.state,
      lastShot: shot,
      shotCount: state.shotCount + 1,
    });
  },

  toJson(state) {
    return state as unknown as Json;
  },

  fromJson(value) {
    return value as unknown as CarromState;
  },
};
