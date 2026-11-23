/** Pure challenge lifecycle rules shared by server actions and tests. */
import type { GameSlug } from "./types";

export type ChallengeStatus = "pending" | "accepted" | "rejected" | "cancelled" | "expired" | "match_created";

export interface GameChallenge {
  id: string;
  gameSlug: GameSlug;
  challengerId: string;
  opponentId: string;
  status: ChallengeStatus;
  settings: Record<string, unknown>;
  message: string | null;
  createdAt: string;
  expiresAt: string;
  respondedAt: string | null;
  matchId: string | null;
}

export interface ChallengePolicy {
  now?: Date;
  expiryMinutes?: number;
  duplicateWindowMinutes?: number;
  rateLimit?: number;
  rateWindowMinutes?: number;
  recentChallengeTimes?: string[];
}

export interface ChallengeResult<T = GameChallenge> {
  ok: boolean;
  challenge?: T;
  error?: string;
}

const DEFAULT_EXPIRY_MINUTES = 60;
const DEFAULT_DUPLICATE_WINDOW_MINUTES = 60;
const DEFAULT_RATE_LIMIT = 8;
const DEFAULT_RATE_WINDOW_MINUTES = 60;

function withinWindow(iso: string, now: Date, minutes: number): boolean {
  const time = Date.parse(iso);
  return Number.isFinite(time) && now.getTime() - time < minutes * 60_000;
}

export function createChallenge(input: {
  id: string;
  gameSlug: GameSlug;
  challengerId: string;
  opponentId: string;
  settings?: Record<string, unknown>;
  message?: string | null;
}, existing: GameChallenge[], policy: ChallengePolicy = {}): ChallengeResult {
  const now = policy.now ?? new Date();
  if (!input.challengerId || !input.opponentId) return { ok: false, error: "Select an opponent." };
  if (input.challengerId === input.opponentId) return { ok: false, error: "You cannot challenge yourself." };

  const duplicateWindow = policy.duplicateWindowMinutes ?? DEFAULT_DUPLICATE_WINDOW_MINUTES;
  const duplicate = existing.some((challenge) =>
    challenge.gameSlug === input.gameSlug &&
    challenge.challengerId === input.challengerId &&
    challenge.opponentId === input.opponentId &&
    challenge.status === "pending" &&
    withinWindow(challenge.createdAt, now, duplicateWindow),
  );
  if (duplicate) return { ok: false, error: "A pending invitation already exists for this game." };

  const rateLimit = policy.rateLimit ?? DEFAULT_RATE_LIMIT;
  const rateWindow = policy.rateWindowMinutes ?? DEFAULT_RATE_WINDOW_MINUTES;
  const recent = (policy.recentChallengeTimes ?? []).filter((time) => withinWindow(time, now, rateWindow));
  if (recent.length >= rateLimit) return { ok: false, error: "Too many invitations. Try again later." };

  const expiresAt = new Date(now.getTime() + (policy.expiryMinutes ?? DEFAULT_EXPIRY_MINUTES) * 60_000).toISOString();
  return {
    ok: true,
    challenge: {
      id: input.id,
      gameSlug: input.gameSlug,
      challengerId: input.challengerId,
      opponentId: input.opponentId,
      status: "pending",
      settings: input.settings ?? {},
      message: input.message?.trim() ? input.message.trim().slice(0, 240) : null,
      createdAt: now.toISOString(),
      expiresAt,
      respondedAt: null,
      matchId: null,
    },
  };
}

export function isExpired(challenge: GameChallenge, now: Date = new Date()): boolean {
  return challenge.status === "pending" && Date.parse(challenge.expiresAt) <= now.getTime();
}

export function effectiveStatus(challenge: GameChallenge, now: Date = new Date()): ChallengeStatus {
  return isExpired(challenge, now) ? "expired" : challenge.status;
}

export function respondToChallenge(
  challenge: GameChallenge,
  response: "accept" | "reject",
  actorId: string,
  now: Date = new Date(),
): ChallengeResult {
  if (challenge.opponentId !== actorId) return { ok: false, error: "Only the invited student can respond." };
  if (effectiveStatus(challenge, now) !== "pending") return { ok: false, error: "This invitation is no longer pending." };
  return {
    ok: true,
    challenge: {
      ...challenge,
      status: response === "accept" ? "accepted" : "rejected",
      respondedAt: now.toISOString(),
    },
  };
}

export function cancelChallenge(challenge: GameChallenge, actorId: string, now: Date = new Date()): ChallengeResult {
  if (challenge.challengerId !== actorId) return { ok: false, error: "Only the sender can cancel this invitation." };
  if (effectiveStatus(challenge, now) !== "pending") return { ok: false, error: "This invitation can no longer be cancelled." };
  return { ok: true, challenge: { ...challenge, status: "cancelled", respondedAt: now.toISOString() } };
}

export function linkChallengeToMatch(challenge: GameChallenge, matchId: string, actorId: string): ChallengeResult {
  if (challenge.challengerId !== actorId && challenge.opponentId !== actorId) {
    return { ok: false, error: "You are not a participant in this invitation." };
  }
  if (challenge.status !== "accepted") return { ok: false, error: "The invitation must be accepted first." };
  return { ok: true, challenge: { ...challenge, status: "match_created", matchId } };
}

export function normaliseSearchTerm(term: string): string {
  return term.trim().replace(/[\s\-_/.]+/g, "").toUpperCase().slice(0, 32);
}

/** Public search never returns full USNs or emails — only permitted identifiers. */
export function validateSearchTerm(term: string): ChallengeResult<string> {
  const normalised = normaliseSearchTerm(term);
  if (normalised.length < 2) return { ok: false, error: "Enter at least two characters to search." };
  if (!/^[A-Z0-9]+$/.test(normalised)) return { ok: false, error: "Use letters and numbers only." };
  return { ok: true, challenge: normalised };
}
