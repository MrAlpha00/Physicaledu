/** Penalty shootout — hidden simultaneous choices resolved deterministically by the engine. */
import type { Json } from "@/types/database";
import { num, opponent, seededUnit, str } from "../engine-utils";
import { completed, continued, rejected, type GameEngine, type Outcome, type PlayerIndex } from "../types";

export type Direction = "left" | "center" | "right";
export type Height = "low" | "high";

export interface ShotChoice {
  direction: Direction;
  height: Height;
  power: number;
}
export interface SaveChoice {
  direction: Direction;
  height: Height;
}
export interface PenaltyAttempt {
  index: number;
  attacker: PlayerIndex;
  shot: ShotChoice | null;
  save: SaveChoice | null;
  goal: boolean | null;
}

export interface PenaltyState {
  version: number;
  seq: number;
  turn: PlayerIndex | null;
  status: "active" | "completed";
  outcome: Outcome | null;
  scores: [number, number];
  attempts: number;
  suddenDeath: boolean;
  phase: "regulation" | "sudden";
  current: PenaltyAttempt;
  history: Array<PenaltyAttempt & { resolved: true }>;
}

export interface PenaltyConfig {
  attempts?: number;
  suddenDeath?: boolean;
}

const DIRECTIONS: Direction[] = ["left", "center", "right"];
const HEIGHTS: Height[] = ["low", "high"];

function attempt(index: number, attacker: PlayerIndex): PenaltyAttempt {
  return { index, attacker, shot: null, save: null, goal: null };
}

function shotsTaken(state: PenaltyState, player: PlayerIndex): number {
  return state.history.filter((value) => value.attacker === player).length;
}

function direction(value: string): Direction | null {
  return DIRECTIONS.includes(value as Direction) ? (value as Direction) : null;
}

function height(value: string): Height | null {
  return HEIGHTS.includes(value as Height) ? (value as Height) : null;
}

export function resolvePenalty(shot: ShotChoice, save: SaveChoice, index: number): boolean {
  if (shot.direction === save.direction && shot.height === save.height) return false;
  if (shot.direction === save.direction && shot.power < 70) return false;
  // Deterministic over-hit variance for ambitious power shots.
  if (shot.power > 92 && seededUnit("penalty", index, shot.power) < 0.16) return false;
  return true;
}

export const penaltyEngine: GameEngine<PenaltyState, PenaltyConfig> = {
  slug: "penalty-shootout",

  create(config) {
    const attempts = typeof config.attempts === "number" && config.attempts >= 1 ? Math.floor(config.attempts) : 5;
    return {
      version: 1,
      seq: 0,
      turn: null,
      status: "active",
      outcome: null,
      scores: [0, 0],
      attempts,
      suddenDeath: config.suddenDeath !== false,
      phase: "regulation",
      current: attempt(0, 0),
      history: [],
    };
  },

  turn() {
    return null; // simultaneous submission
  },

  outcome(state) {
    return state.outcome;
  },

  canAct(state, actor, action) {
    if (state.status !== "active") return false;
    if (action.type === "shoot") return state.current.attacker === actor && state.current.shot === null;
    if (action.type === "save") return state.current.attacker !== actor && state.current.save === null;
    if (action.type === "rematch") return state.status === "completed";
    return false;
  },

  legal(state, actor) {
    if (state.status !== "active") return [];
    return state.current.attacker === actor ? ["shoot"] : ["save"];
  },

  apply(state, action, _config) {
    if (action.type === "rematch") {
      if (state.status !== "completed") return rejected(state, "Only a finished game can be reset.");
      return {
        state: {
          ...penaltyEngine.create({ attempts: state.attempts, suddenDeath: state.suddenDeath }),
          version: state.version + 1,
          seq: state.seq + 1,
        },
        events: [{ type: "rematch", message: "A fresh shootout is ready." }],
        accepted: true,
      };
    }
    if (action.type !== "shoot" && action.type !== "save") return rejected(state, "Unknown penalty action.");
    if (state.status !== "active") return rejected(state, "This shootout has already finished.");
    if (!penaltyEngine.canAct(state, action.actor, action)) return rejected(state, "That decision has already been submitted.");

    let current = { ...state.current };
    let events: Array<{ type: string; message: string }> = [];

    if (action.type === "shoot") {
      const dir = direction(str(action.payload, "direction"));
      const hgt = height(str(action.payload, "height"));
      const power = num(action.payload, "power", 60);
      if (!dir || !hgt) return rejected(state, "Choose a direction and height.");
      if (power < 1 || power > 100) return rejected(state, "Power must be between 1 and 100.");
      current.shot = { direction: dir, height: hgt, power: Math.round(power) };
      events = [{ type: "shot_locked", message: "Shot locked. Waiting for the keeper." }];
    } else {
      const dir = direction(str(action.payload, "direction"));
      const hgt = height(str(action.payload, "height"));
      if (!dir || !hgt) return rejected(state, "Choose a dive direction and height.");
      current.save = { direction: dir, height: hgt };
      events = [{ type: "save_locked", message: "Dive locked. Waiting for the shooter." }];
    }

    if (!current.shot || !current.save) {
      return continued(state, events, { current });
    }

    const goal = resolvePenalty(current.shot, current.save, current.index);
    const scores: [number, number] = [...state.scores];
    if (goal) scores[current.attacker] += 1;
    const resolved = { ...current, goal, resolved: true as const };
    const history = [...state.history, resolved];
    events = [
      {
        type: goal ? "goal" : "save",
        message: goal ? `${current.shot.direction} ${current.shot.height} — goal!` : `Saved — the keeper read it.`,
      },
    ];

    const p0 = shotsTaken({ ...state, history }, 0);
    const p1 = shotsTaken({ ...state, history }, 1);
    const regulationComplete = p0 >= state.attempts && p1 >= state.attempts;
    const suddenComplete = state.phase === "sudden" && p0 === p1 && scores[0] !== scores[1];

    if (regulationComplete && scores[0] !== scores[1]) {
      return completed(
        state,
        {
          kind: "win",
          winner: scores[0] > scores[1] ? 0 : 1,
          reason: `Final score ${scores[0]}–${scores[1]}.`,
        },
        events,
        { scores, history, current },
      );
    }
    if (regulationComplete && !state.suddenDeath) {
      return completed(state, { kind: "draw", winner: null, reason: "Shootout level." }, events, { scores, history, current });
    }
    if (suddenComplete) {
      return completed(
        state,
        {
          kind: "win",
          winner: scores[0] > scores[1] ? 0 : 1,
          reason: `Sudden death decided ${scores[0]}–${scores[1]}.`,
        },
        events,
        { scores, history, current },
      );
    }

    const phase = regulationComplete ? "sudden" : state.phase;
    const nextAttacker = opponent(current.attacker);
    return continued(state, events, {
      scores,
      history,
      phase,
      current: attempt(current.index + 1, nextAttacker),
    });
  },

  toJson(state) {
    return state as unknown as Json;
  },

  fromJson(value) {
    return value as unknown as PenaltyState;
  },
};
