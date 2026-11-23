import { describe, expect, it } from "vitest";
import { createChallenge, respondToChallenge, linkChallengeToMatch } from "@/lib/games/challenges";
import { createMatchEnvelope, applyAuthoritativeAction, participantIndex } from "@/lib/games/match-service";
import { engineFor } from "@/lib/games/registry";
import { calculateRatingUpdates, applyRatingRecord, emptyRating, ratingEligibility } from "@/lib/games/rating";
import type { MatchEnvelope, Outcome } from "@/lib/games/types";
import type { Json } from "@/types/database";

function action(seq: number, version: number, actor: 0 | 1, cell: number) {
  return { seq, expectedVersion: version, actor, type: "move", payload: { cell } };
}

describe("Phase 5 — ranked match integration", () => {
  it("carries an accepted challenge through authoritative play to independent rating updates", () => {
    const challenge = createChallenge({
      id: "challenge-1",
      gameSlug: "tic-tac-toe",
      challengerId: "user-a",
      opponentId: "user-b",
    }, [], { now: new Date("2026-06-01T12:00:00.000Z") }).challenge!;
    const accepted = respondToChallenge(challenge, "accept", "user-b", new Date("2026-06-01T12:01:00.000Z")).challenge!;
    const linked = linkChallengeToMatch(accepted, "match-1", "user-a").challenge!;
    expect(linked).toMatchObject({ status: "match_created", matchId: "match-1" });

    let match: MatchEnvelope = {
      ...createMatchEnvelope({
        id: "match-1",
        slug: "tic-tac-toe",
        mode: "ranked",
        players: [
          { userId: "user-a", displayName: "Ace" },
          { userId: "user-b", displayName: "Rook" },
        ],
        challengeId: linked.id,
      }),
      status: "active",
    };

    const viewer = { userId: "user-a" };
    expect(participantIndex(match, "user-a")).toBe(0);
    expect(applyAuthoritativeAction(match, action(1, match.version, 1, 0), viewer).ok).toBe(false);

    const moves = [
      action(1, match.version, 0, 0), action(2, match.version + 1, 1, 3),
      action(3, match.version + 2, 0, 1), action(4, match.version + 3, 1, 4),
      action(5, match.version + 4, 0, 2),
    ];
    for (const move of moves) {
      const result = applyAuthoritativeAction(match, move, {
        userId: move.actor === 0 ? "user-a" : "user-b",
      });
      expect(result.ok).toBe(true);
      if (!result.match) throw new Error("missing match");
      match = result.match;
    }

    expect(match.status).toBe("completed");
    const outcome = match.outcome as unknown as Outcome;
    expect(outcome).toMatchObject({ kind: "win", winner: 0 });
    expect(engineFor(match.slug).outcome(engineFor(match.slug).fromJson(match.state))).toEqual(outcome);
    expect(applyAuthoritativeAction(match, action(6, match.version, 1, 5), { userId: "user-b" }).ok).toBe(false);

    expect(ratingEligibility({
      gameSlug: match.slug,
      mode: match.mode,
      status: match.status,
      outcome,
      participantIds: match.players.map((player) => player.userId),
    }).eligible).toBe(true);

    const updates = calculateRatingUpdates({
      gameSlug: match.slug,
      mode: match.mode,
      status: match.status,
      outcome,
      players: [
        { userId: "user-a", record: emptyRating() },
        { userId: "user-b", record: emptyRating() },
      ],
    });
    expect(updates.updates).toHaveLength(2);
    const winnerRating = applyRatingRecord(emptyRating(), updates.updates[0]);
    const loserRating = applyRatingRecord(emptyRating(), updates.updates[1]);
    expect(winnerRating.rating).toBe(1216);
    expect(loserRating.rating).toBe(1184);
    expect(winnerRating.highestRating).toBe(1216);
    expect(loserRating.highestRating).toBe(1200);
  });

  it("keeps guest and practice sessions outside ranked state entirely", () => {
    const guest = createMatchEnvelope({
      id: "guest-1",
      slug: "connect-four",
      mode: "guest",
      players: [
        { userId: null, guestId: "guest-a", displayName: "Guest A" },
        { userId: null, guestId: "guest-b", displayName: "Guest B" },
      ],
    });
    expect(guest.players.every((player) => player.userId === null)).toBe(true);
    expect(ratingEligibility({
      gameSlug: guest.slug,
      mode: guest.mode,
      status: "completed",
      outcome: { kind: "win", winner: 0, reason: "Local win." },
      participantIds: guest.players.map((player) => player.userId),
    }).eligible).toBe(false);

    const practice = engineFor("basketball").create({ attempts: 10 });
    const practiceState = engineFor("basketball").apply(practice as never, {
      seq: 1, expectedVersion: practice.version, actor: 0, type: "shoot",
      payload: { angle: 52, power: 72, timing: 50 } as Record<string, Json>,
    } as never, {} as never);
    expect(practiceState.accepted).toBe(true);
    expect(calculateRatingUpdates({
      gameSlug: "basketball",
      mode: "practice",
      status: practiceState.state.status,
      outcome: practiceState.state.outcome as unknown as Outcome,
      players: [{ userId: "user-a", record: emptyRating() }, { userId: "user-b", record: emptyRating() }],
    }).updates).toEqual([]);
  });
});
