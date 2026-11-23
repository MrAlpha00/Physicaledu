/**
 * Phase 5 — shared game domain types.
 *
 * These types are intentionally free of React and Supabase imports so the same
 * authoritative rules can run in the browser (guest/practice play), in a
 * Next.js server action (competitive play) and in unit tests.
 */
import type { Json } from "@/types/database";

export const GAME_SLUGS = [
  "chess",
  "carrom",
  "tic-tac-toe",
  "connect-four",
  "penalty-shootout",
  "basketball",
] as const;

export type GameSlug = (typeof GAME_SLUGS)[number];

export type GameConfig = Record<string, Json>;

export type MatchMode = "guest" | "practice" | "friendly" | "ranked";

export const MODE_LABELS: Record<MatchMode, string> = {
  guest: "GUEST LOCAL PLAY",
  practice: "PRACTICE — UNRANKED",
  friendly: "UNRANKED FRIENDLY MATCH",
  ranked: "COMPETITIVE RANKED MATCH",
};

export type PlayerIndex = 0 | 1;

export interface Outcome {
  kind: "win" | "draw";
  winner: PlayerIndex | null;
  reason: string;
}

export interface GameEvent {
  type: string;
  message: string;
  data?: Record<string, Json>;
}

/** Every engine state carries optimistic-concurrency metadata. */
export interface BaseState {
  version: number;
  seq: number;
  turn: PlayerIndex | null;
  status: "active" | "completed";
  outcome: Outcome | null;
}

/**
 * A competitive action is an *intent* only. Clients never send a final score,
 * board state or outcome — the engine derives all of those authoritatively.
 */
export interface GameAction {
  seq: number;
  expectedVersion: number;
  actor: PlayerIndex;
  type: string;
  payload: Record<string, Json>;
}

export interface TransitionResult<S extends BaseState> {
  state: S;
  events: GameEvent[];
  accepted: boolean;
  reason?: string;
}

export interface GameEngine<S extends BaseState = BaseState, C = Record<string, Json>> {
  slug: GameSlug;
  create(config: C): S;
  apply(state: S, action: GameAction, config: C): TransitionResult<S>;
  /** Which player may act next; `null` for simultaneous-submission games. */
  turn(state: S): PlayerIndex | null;
  outcome(state: S): Outcome | null;
  /** Optional fine-grained authorisation for simultaneous games. */
  canAct?(state: S, actor: PlayerIndex, action: GameAction): boolean;
  legal(state: S, actor: PlayerIndex): string[];
  toJson(state: S): Json;
  fromJson(value: Json): S;
}

export interface MatchPlayer {
  index: PlayerIndex;
  userId: string | null;
  guestId?: string | null;
  displayName: string;
  ready: boolean;
  connected: boolean;
  ratingBefore?: number | null;
  ratingAfter?: number | null;
  ratingDelta?: number | null;
}

export interface MatchEnvelope {
  id: string;
  slug: GameSlug;
  mode: MatchMode;
  status: "waiting" | "countdown" | "active" | "completed" | "cancelled" | "abandoned" | "disputed";
  version: number;
  config: Record<string, Json>;
  players: MatchPlayer[];
  state: Json;
  createdAt: string;
  updatedAt: string;
  challengeId?: string | null;
}

export interface ApplyMatchResult {
  ok: boolean;
  match?: MatchEnvelope;
  events?: GameEvent[];
  outcome?: Outcome | null;
  error?: string;
}

export function nextVersion(state: BaseState): number {
  return state.version + 1;
}

/** Shared envelope validation used by the match service and directly by engines. */
export function validateEnvelope<S extends BaseState>(
  state: S,
  action: GameAction,
  engine: GameEngine<S, unknown>,
  actor: PlayerIndex,
): string | null {
  if (state.status === "completed") return "This match has already finished.";
  if (action.seq !== state.seq + 1) return "This action is out of sequence.";
  if (action.expectedVersion !== state.version) return "This action was made against an outdated state.";
  if (action.actor !== actor) return "You cannot submit an action for another player.";
  if (engine.canAct) {
    if (!engine.canAct(state, actor, action)) return "It is not your turn to submit this action.";
  } else if (engine.turn(state) !== actor) {
    return "It is not your turn.";
  }
  return null;
}

export function completed<S extends BaseState>(
  state: S,
  outcome: Outcome,
  events: GameEvent[],
  statePatch: Partial<S> = {},
): TransitionResult<S> {
  return {
    state: {
      ...state,
      ...statePatch,
      status: "completed",
      outcome,
      turn: null,
      version: state.version + 1,
      seq: state.seq + 1,
    },
    events,
    accepted: true,
  };
}

export function continued<S extends BaseState>(
  state: S,
  events: GameEvent[],
  statePatch: Partial<S> = {},
): TransitionResult<S> {
  return {
    state: {
      ...state,
      ...statePatch,
      version: state.version + 1,
      seq: state.seq + 1,
    },
    events,
    accepted: true,
  };
}

export function rejected<S extends BaseState>(state: S, reason: string): TransitionResult<S> {
  return { state, events: [], accepted: false, reason };
}
