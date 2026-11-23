import { describe, expect, it } from "vitest";
import {
  cancelChallenge,
  createChallenge,
  effectiveStatus,
  linkChallengeToMatch,
  normaliseSearchTerm,
  respondToChallenge,
  validateSearchTerm,
  type GameChallenge,
} from "@/lib/games/challenges";
import {
  applyRatingRecord,
  calculateRatingUpdates,
  emptyRating,
  expectedScore,
  ratingEligibility,
  ratingDelta,
  winPercentage,
} from "@/lib/games/rating";
import type { Outcome } from "@/lib/games/types";

const now = new Date("2026-06-01T12:00:00.000Z");
const baseInput = {
  id: "challenge-1",
  gameSlug: "chess" as const,
  challengerId: "user-a",
  opponentId: "user-b",
};

function acceptedChallenge(): GameChallenge {
  const created = createChallenge(baseInput, [], { now });
  if (!created.challenge) throw new Error("fixture failed");
  return respondToChallenge(created.challenge, "accept", "user-b", now).challenge!;
}

describe("Phase 5 — challenge lifecycle", () => {
  it("prevents self-challenges, duplicates and rate-limit breaches", () => {
    expect(createChallenge({ ...baseInput, opponentId: "user-a" }, [], { now }).ok).toBe(false);
    const first = createChallenge(baseInput, [], { now });
    expect(first.ok).toBe(true);

    const duplicate = createChallenge(baseInput, [first.challenge!], { now });
    expect(duplicate.ok).toBe(false);
    expect(duplicate.error).toContain("already exists");

    const recent = Array.from({ length: 8 }, (_, index) => new Date(now.getTime() - index * 60_000).toISOString());
    const rateLimited = createChallenge(baseInput, [], { now, recentChallengeTimes: recent });
    expect(rateLimited.ok).toBe(false);
    expect(rateLimited.error).toContain("Too many");
  });

  it("allows only the invited student to respond and only the sender to cancel", () => {
    const created = createChallenge(baseInput, [], { now }).challenge!;
    expect(respondToChallenge(created, "accept", "user-c", now).ok).toBe(false);
    expect(cancelChallenge(created, "user-b", now).ok).toBe(false);
    expect(respondToChallenge(created, "reject", "user-b", now).challenge?.status).toBe("rejected");

    const second = createChallenge({ ...baseInput, id: "challenge-2" }, [], { now }).challenge!;
    expect(cancelChallenge(second, "user-a", now).challenge?.status).toBe("cancelled");
  });

  it("expires pending invitations and links only accepted ones to a match", () => {
    const created = createChallenge(baseInput, [], { now, expiryMinutes: 30 }).challenge!;
    const after = new Date(now.getTime() + 31 * 60_000);
    expect(effectiveStatus(created, after)).toBe("expired");
    expect(respondToChallenge(created, "accept", "user-b", after).ok).toBe(false);

    const accepted = acceptedChallenge();
    expect(linkChallengeToMatch(accepted, "match-1", "outsider").ok).toBe(false);
    expect(linkChallengeToMatch(accepted, "match-1", "user-a").challenge).toMatchObject({ status: "match_created", matchId: "match-1" });
  });

  it("normalises public search terms without exposing identity fields", () => {
    expect(normaliseSearchTerm("  Ace_Star  ")).toBe("ACESTAR");
    expect(validateSearchTerm("Ace Star").challenge).toBe("ACESTAR");
    expect(validateSearchTerm("A").ok).toBe(false);
    expect(validateSearchTerm("ace@star").ok).toBe(false);
  });
});

describe("Phase 5 — independent Elo ratings", () => {
  const win: Outcome = { kind: "win", winner: 0, reason: "Test win." };
  const draw: Outcome = { kind: "draw", winner: null, reason: "Test draw." };

  it("keeps the zero-sum exchange and highest rating", () => {
    expect(expectedScore(1200, 1200)).toBe(0.5);
    expect(ratingDelta(1200, 1200, win, 0)).toBe(16);
    expect(ratingDelta(1200, 1200, win, 1)).toBe(-16);
    expect(ratingDelta(1200, 1200, draw, 0)).toBe(0);

    const updates = calculateRatingUpdates({
      gameSlug: "chess",
      mode: "ranked",
      status: "completed",
      outcome: win,
      players: [
        { userId: "a", record: emptyRating() },
        { userId: "b", record: emptyRating() },
      ],
    });
    expect(updates.eligible).toBe(true);
    expect(updates.updates).toHaveLength(2);
    expect(updates.updates[0].delta + updates.updates[1].delta).toBe(0);

    const improved = applyRatingRecord(emptyRating(), updates.updates[0]);
    expect(improved).toMatchObject({ rating: 1216, highestRating: 1216, played: 1, wins: 1, losses: 0, draws: 0 });
    expect(winPercentage(improved)).toBe(100);
  });

  it("never rates guests, practice, incomplete, cancelled or disputed matches", () => {
    for (const input of [
      { mode: "guest" as const, status: "completed", outcome: win },
      { mode: "practice" as const, status: "completed", outcome: win },
      { mode: "ranked" as const, status: "active", outcome: win },
      { mode: "ranked" as const, status: "cancelled", outcome: win },
    ]) {
      expect(ratingEligibility({ ...input, participantIds: ["a", "b"] }).eligible).toBe(false);
    }
    expect(ratingEligibility({ mode: "ranked", status: "completed", disputed: true, participantIds: ["a", "b"], outcome: win }).eligible).toBe(false);
    expect(ratingEligibility({ mode: "ranked", status: "completed", participantIds: ["a", null], outcome: win }).eligible).toBe(false);

    const result = calculateRatingUpdates({
      gameSlug: "carrom",
      mode: "guest",
      status: "completed",
      outcome: win,
      players: [{ userId: null, record: emptyRating() }, { userId: null, record: emptyRating() }],
    });
    expect(result.updates).toEqual([]);
  });
});
