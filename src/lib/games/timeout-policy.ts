/**
 * Pure timeout decision logic shared by the scheduled endpoint, the lazy
 * server-side fallback and unit tests. No clocks, network calls or secrets here.
 */
import type { Json } from "@/types/database";

export const TIMEOUT_OPEN_STATUSES = ["waiting", "countdown", "active"] as const;

export interface TimeoutCandidate {
  publicId: string;
  gameSlug: string;
  mode: string;
  status: string;
  state: Json;
  updatedAt: string;
  players: Array<{ playerIndex: number; connected: boolean; userId: string | null }>;
}

export interface TimeoutOutcome {
  kind: "win" | "draw";
  winner: number | null;
  reason: string;
}

export interface TimeoutDecision {
  shouldFinalize: boolean;
  reason: string;
  actor: number;
  clockExpired: boolean;
  applyRating: boolean;
  outcome: TimeoutOutcome;
}

function asRecord(value: Json): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function opponent(index: number): 0 | 1 {
  return index === 0 ? 1 : 0;
}

/**
 * Chess clocks are decided from server-held state; other games use the
 * reconnection grace window and connection flags. Ambiguous cases never award
 * a rating or a false winner — they are recorded as unrated no-result draws.
 */
export function evaluateTimeout(
  candidate: TimeoutCandidate,
  graceMinutes: number,
  now: number = Date.now(),
): TimeoutDecision {
  const noAction: TimeoutDecision = {
    shouldFinalize: false,
    reason: "not_expired",
    actor: 0,
    clockExpired: false,
    applyRating: false,
    outcome: { kind: "draw", winner: null, reason: "" },
  };

  if (!TIMEOUT_OPEN_STATUSES.includes(candidate.status as (typeof TIMEOUT_OPEN_STATUSES)[number])) {
    return { ...noAction, reason: "not_open" };
  }

  const state = asRecord(candidate.state);
  const updatedAt = Date.parse(candidate.updatedAt);
  if (!Number.isFinite(updatedAt)) return { ...noAction, reason: "invalid_timestamp" };

  const graceMs = Math.max(1, Math.min(graceMinutes, 1440)) * 60_000;
  const idleExpired = now - updatedAt >= graceMs;

  let clockExpired = false;
  let flaggedPlayer: 0 | 1 = 0;
  if (candidate.gameSlug === "chess") {
    const timeControl = String(state.timeControl ?? "unlimited");
    const clocks = state.clocksMs;
    const lastActionAt = typeof state.lastActionAt === "string" ? Date.parse(state.lastActionAt) : NaN;
    const turn = state.turn === 1 ? 1 : 0;
    flaggedPlayer = turn;
    if (
      timeControl !== "unlimited" &&
      Array.isArray(clocks) &&
      typeof clocks[turn] === "number" &&
      Number.isFinite(lastActionAt)
    ) {
      clockExpired = Number(clocks[turn]) - (now - lastActionAt) <= 0;
    }
  }

  if (clockExpired) {
    const winner = opponent(flaggedPlayer);
    return {
      shouldFinalize: true,
      reason: "chess_clock",
      actor: flaggedPlayer,
      clockExpired: true,
      applyRating: true,
      outcome: {
        kind: "win",
        winner,
        reason: "Time forfeited — server clock expired while the match was open.",
      },
    };
  }

  if (!idleExpired) return noAction;

  const connected = candidate.players.filter((player) => player.connected);
  if (connected.length === 1) {
    const winner = connected[0].playerIndex === 0 ? 0 : 1;
    return {
      shouldFinalize: true,
      reason: "opponent_disconnected",
      actor: winner,
      clockExpired: false,
      applyRating: true,
      outcome: {
        kind: "win",
        winner,
        reason: "Opponent did not reconnect before the grace period ended.",
      },
    };
  }

  return {
    shouldFinalize: true,
    reason: connected.length === 0 ? "both_disconnected" : "idle_no_result",
    actor: 0,
    clockExpired: false,
    applyRating: false,
    outcome: {
      kind: "draw",
      winner: null,
      reason:
        connected.length === 0
          ? "Both players disconnected; no result can be awarded."
          : "No decisive result was recorded before the inactivity window closed.",
    },
  };
}
