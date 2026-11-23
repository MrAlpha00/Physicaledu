/**
 * Authoritative match transitions. This is the boundary every competitive
 * action passes through: identity, participation, status, turn, sequence and
 * version are verified before a pure engine is allowed to change state.
 */
import { engineFor } from "./registry";
import {
  validateEnvelope,
  type ApplyMatchResult,
  type GameAction,
  type GameSlug,
  type MatchEnvelope,
  type MatchMode,
  type MatchPlayer,
  type Outcome,
  type PlayerIndex,
} from "./types";
import { gameConfigFor } from "./catalog";
import type { Json } from "@/types/database";

export function createMatchEnvelope(input: {
  id: string;
  slug: GameSlug;
  mode: MatchMode;
  players: Array<{ userId: string | null; guestId?: string | null; displayName: string }>;
  config?: Record<string, Json> | null;
  now?: Date;
  challengeId?: string | null;
}): MatchEnvelope {
  const now = (input.now ?? new Date()).toISOString();
  const config = gameConfigFor(input.slug, input.config);
  const engine = engineFor(input.slug);
  const players: MatchPlayer[] = input.players.slice(0, 2).map((player, index) => ({
    index: index as PlayerIndex,
    userId: player.userId,
    guestId: player.guestId ?? null,
    displayName: player.displayName,
    ready: false,
    connected: true,
  }));
  return {
    id: input.id,
    slug: input.slug,
    mode: input.mode,
    status: "waiting",
    version: 1,
    config,
    players,
    state: engine.toJson(engine.create(config)),
    createdAt: now,
    updatedAt: now,
    challengeId: input.challengeId ?? null,
  };
}

export function participantIndex(match: MatchEnvelope, userId: string | null, guestId?: string | null): PlayerIndex | null {
  const found = match.players.find((player) =>
    userId ? player.userId === userId : Boolean(guestId) && player.guestId === guestId,
  );
  return found ? found.index : null;
}

export function canJoinMatch(match: MatchEnvelope, userId: string | null, guestId?: string | null): boolean {
  if (!["waiting", "countdown", "active"].includes(match.status)) return false;
  return participantIndex(match, userId, guestId) !== null;
}

export function setPlayerReady(match: MatchEnvelope, playerIndex: PlayerIndex, ready: boolean, now: Date = new Date()): MatchEnvelope {
  const players = match.players.map((player) => (player.index === playerIndex ? { ...player, ready } : player));
  const allReady = players.length === 2 && players.every((player) => player.ready);
  return {
    ...match,
    players,
    status: allReady && match.status === "waiting" ? "countdown" : match.status,
    updatedAt: now.toISOString(),
  };
}

export function setPlayerConnection(match: MatchEnvelope, playerIndex: PlayerIndex, connected: boolean, now: Date = new Date()): MatchEnvelope {
  return {
    ...match,
    players: match.players.map((player) => (player.index === playerIndex ? { ...player, connected } : player)),
    updatedAt: now.toISOString(),
  };
}

export function beginMatch(match: MatchEnvelope, now: Date = new Date()): MatchEnvelope {
  if (match.status !== "countdown") return match;
  return { ...match, status: "active", updatedAt: now.toISOString() };
}

/** The single entry point for submitting a competitive game action. */
export function applyAuthoritativeAction(
  match: MatchEnvelope,
  action: GameAction,
  identity: { userId: string | null; guestId?: string | null },
  now: Date = new Date(),
): ApplyMatchResult {
  if (match.status !== "active") return { ok: false, error: "This match is not active." };
  const actor = participantIndex(match, identity.userId, identity.guestId);
  if (actor === null) return { ok: false, error: "You are not a participant in this match." };

  if (match.mode === "ranked" && match.players.some((player) => !player.userId)) {
    return { ok: false, error: "Ranked matches require two authenticated students." };
  }
  if (!/^[a-z_]+$/.test(action.type)) return { ok: false, error: "Malformed action." };
  if (!Number.isInteger(action.seq) || !Number.isInteger(action.expectedVersion)) {
    return { ok: false, error: "Malformed action metadata." };
  }
  const payload = action.payload;
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    return { ok: false, error: "Malformed action payload." };
  }
  if (JSON.stringify(payload).length > 4096) return { ok: false, error: "Action payload is too large." };

  const engine = engineFor(match.slug);
  const state = engine.fromJson(match.state);
  const envelopeError = validateEnvelope(state, action, engine, actor);
  if (envelopeError) return { ok: false, error: envelopeError };

  const result = engine.apply(state, action, match.config);
  if (!result.accepted) return { ok: false, error: result.reason ?? "The action was rejected." };

  const updated: MatchEnvelope = {
    ...match,
    version: result.state.version,
    state: engine.toJson(result.state),
    status: result.state.status === "completed" ? "completed" : match.status,
    updatedAt: now.toISOString(),
  };
  return { ok: true, match: updated, events: result.events, outcome: engine.outcome(result.state) };
}

export function completeMatch(match: MatchEnvelope, outcome: Outcome, now: Date = new Date()): MatchEnvelope {
  const engine = engineFor(match.slug);
  const state = engine.fromJson(match.state);
  return {
    ...match,
    status: "completed",
    state: engine.toJson({ ...state, status: "completed", outcome, turn: null }),
    updatedAt: now.toISOString(),
  };
}

export function abandonMatch(match: MatchEnvelope, now: Date = new Date()): MatchEnvelope {
  return { ...match, status: "abandoned", updatedAt: now.toISOString() };
}

export function isTerminalStatus(match: MatchEnvelope): boolean {
  return ["completed", "cancelled", "abandoned", "disputed"].includes(match.status);
}
