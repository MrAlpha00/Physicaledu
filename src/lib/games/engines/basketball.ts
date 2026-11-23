/** Basketball free-throw challenge — server-calculated shot outcomes. */
import type { Json } from "@/types/database";
import { num, seededUnit } from "../engine-utils";
import { completed, continued, rejected, type GameEngine, type Outcome, type PlayerIndex } from "../types";

export interface BasketballShot {
  index: number;
  actor: PlayerIndex;
  angle: number;
  power: number;
  timing: number;
  made: boolean;
}

export interface BasketballState {
  version: number;
  seq: number;
  turn: PlayerIndex | null;
  status: "active" | "completed";
  outcome: Outcome | null;
  scores: [number, number];
  attempts: number;
  suddenDeath: boolean;
  phase: "regulation" | "sudden";
  shots: BasketballShot[];
  lastShot: BasketballShot | null;
}

export interface BasketballConfig {
  attempts?: number;
  suddenDeath?: boolean;
}

/** Deterministic, documented shot model. Only validated parameters are accepted. */
export function shotQuality(angle: number, power: number, timing: number): number {
  const angleScore = Math.max(0, 1 - Math.abs(angle - 52) / 26);
  const powerScore = Math.max(0, 1 - Math.abs(power - 72) / 42);
  const timingScore = Math.max(0, 1 - Math.abs(timing - 50) / 32);
  return 0.42 * angleScore + 0.33 * powerScore + 0.25 * timingScore;
}

export function resolveShot(index: number, angle: number, power: number, timing: number): boolean {
  const jitter = (seededUnit("basketball", index, angle, power, timing) - 0.5) * 0.1;
  return shotQuality(angle, power, timing) + jitter >= 0.66;
}

export const basketballEngine: GameEngine<BasketballState, BasketballConfig> = {
  slug: "basketball",

  create(config) {
    const attempts = typeof config.attempts === "number" && config.attempts >= 1 ? Math.floor(config.attempts) : 10;
    return {
      version: 1,
      seq: 0,
      turn: 0,
      status: "active",
      outcome: null,
      scores: [0, 0],
      attempts,
      suddenDeath: config.suddenDeath !== false,
      phase: "regulation",
      shots: [],
      lastShot: null,
    };
  },

  turn(state) {
    if (state.status !== "active") return null;
    return state.shots.length % 2 === 0 ? 0 : 1;
  },

  outcome(state) {
    return state.outcome;
  },

  legal(state, actor) {
    return state.status === "active" && basketballEngine.turn(state) === actor ? ["shoot"] : [];
  },

  apply(state, action, _config) {
    if (action.type === "rematch") {
      if (state.status !== "completed") return rejected(state, "Only a finished game can be reset.");
      return {
        state: {
          ...basketballEngine.create({ attempts: state.attempts, suddenDeath: state.suddenDeath }),
          version: state.version + 1,
          seq: state.seq + 1,
        },
        events: [{ type: "rematch", message: "A fresh free-throw challenge is ready." }],
        accepted: true,
      };
    }
    if (action.type !== "shoot") return rejected(state, "Unknown basketball action.");
    if (state.status !== "active") return rejected(state, "This challenge has already finished.");
    if (basketballEngine.turn(state) !== action.actor) return rejected(state, "It is not your turn to shoot.");

    const angle = num(action.payload, "angle", Number.NaN);
    const power = num(action.payload, "power", Number.NaN);
    const timing = num(action.payload, "timing", Number.NaN);
    if (!Number.isFinite(angle) || angle < 30 || angle > 75) return rejected(state, "Angle must be between 30° and 75°.");
    if (!Number.isFinite(power) || power < 1 || power > 100) return rejected(state, "Power must be between 1 and 100.");
    if (!Number.isFinite(timing) || timing < 0 || timing > 100) return rejected(state, "Release timing must be between 0 and 100.");

    const rounded = {
      angle: Math.round(angle * 10) / 10,
      power: Math.round(power * 10) / 10,
      timing: Math.round(timing * 10) / 10,
    };
    const made = resolveShot(state.shots.length, rounded.angle, rounded.power, rounded.timing);
    const shot: BasketballShot = { index: state.shots.length, actor: action.actor, ...rounded, made };
    const shots = [...state.shots, shot];
    const scores: [number, number] = [...state.scores];
    if (made) scores[action.actor] += 1;

    const events = [{ type: made ? "made" : "missed", message: made ? "Swish — basket counted." : "Off the rim — no points." }];
    const taken0 = shots.filter((value) => value.actor === 0).length;
    const taken1 = shots.filter((value) => value.actor === 1).length;
    const regulationComplete = taken0 >= state.attempts && taken1 >= state.attempts;

    if (regulationComplete && scores[0] !== scores[1]) {
      return completed(
        state,
        { kind: "win", winner: scores[0] > scores[1] ? 0 : 1, reason: `Final score ${scores[0]}–${scores[1]}.` },
        events,
        { scores, shots, lastShot: shot },
      );
    }
    if (regulationComplete && !state.suddenDeath) {
      return completed(state, { kind: "draw", winner: null, reason: "Challenge level." }, events, { scores, shots, lastShot: shot });
    }
    if (state.phase === "sudden" && taken0 === taken1 && scores[0] !== scores[1]) {
      return completed(
        state,
        { kind: "win", winner: scores[0] > scores[1] ? 0 : 1, reason: `Sudden death decided ${scores[0]}–${scores[1]}.` },
        events,
        { scores, shots, lastShot: shot },
      );
    }

    return continued(state, events, {
      scores,
      shots,
      lastShot: shot,
      phase: regulationComplete ? "sudden" : state.phase,
    });
  },

  toJson(state) {
    return state as unknown as Json;
  },

  fromJson(value) {
    return value as unknown as BasketballState;
  },
};
