import { describe, expect, it } from "vitest";
import { evaluateTimeout, type TimeoutCandidate } from "../src/lib/games/timeout-policy";

const now = Date.parse("2026-11-23T12:00:00.000Z");

function candidate(overrides: Partial<TimeoutCandidate> = {}): TimeoutCandidate {
  return {
    publicId: "abcdef0123456789",
    gameSlug: "tic-tac-toe",
    mode: "ranked",
    status: "active",
    state: { version: 2, seq: 2, turn: 0, status: "active" } as TimeoutCandidate["state"],
    updatedAt: new Date(now - 10 * 60_000).toISOString(),
    players: [
      { playerIndex: 0, connected: true, userId: "user-a" },
      { playerIndex: 1, connected: false, userId: "user-b" },
    ],
    ...overrides,
  };
}

describe("Phase 6 timeout policy", () => {
  it("does not finalise an active match inside the grace period", () => {
    const decision = evaluateTimeout(
      candidate({ updatedAt: new Date(now - 60_000).toISOString() }),
      5,
      now,
    );
    expect(decision.shouldFinalize).toBe(false);
    expect(decision.reason).toBe("not_expired");
  });

  it("awards the connected player after the grace period", () => {
    const decision = evaluateTimeout(candidate(), 5, now);
    expect(decision).toMatchObject({
      shouldFinalize: true,
      reason: "opponent_disconnected",
      actor: 0,
      clockExpired: false,
      applyRating: true,
    });
    expect(decision.outcome).toMatchObject({ kind: "win", winner: 0 });
  });

  it("never awards a rating when both players disconnected", () => {
    const decision = evaluateTimeout(
      candidate({
        players: [
          { playerIndex: 0, connected: false, userId: "user-a" },
          { playerIndex: 1, connected: false, userId: "user-b" },
        ],
      }),
      5,
      now,
    );
    expect(decision.shouldFinalize).toBe(true);
    expect(decision.applyRating).toBe(false);
    expect(decision.outcome.kind).toBe("draw");
  });

  it("uses the server-held chess clock before the idle grace expires", () => {
    const decision = evaluateTimeout(
      candidate({
        gameSlug: "chess",
        updatedAt: new Date(now - 1_000).toISOString(),
        state: {
          version: 4,
          seq: 4,
          turn: 1,
          status: "active",
          timeControl: "5",
          clocksMs: [300_000, 2_000],
          lastActionAt: new Date(now - 10_000).toISOString(),
        } as TimeoutCandidate["state"],
      }),
      5,
      now,
    );
    expect(decision.shouldFinalize).toBe(true);
    expect(decision.reason).toBe("chess_clock");
    expect(decision.clockExpired).toBe(true);
    expect(decision.outcome.winner).toBe(0);
  });

  it("does not treat unlimited chess as clock-expired", () => {
    const decision = evaluateTimeout(
      candidate({
        gameSlug: "chess",
        updatedAt: new Date(now - 1_000).toISOString(),
        state: {
          version: 4,
          seq: 4,
          turn: 0,
          status: "active",
          timeControl: "unlimited",
          clocksMs: [0, 0],
          lastActionAt: new Date(now - 10_000).toISOString(),
        } as TimeoutCandidate["state"],
      }),
      5,
      now,
    );
    expect(decision.shouldFinalize).toBe(false);
  });

  it("ignores terminal matches", () => {
    const decision = evaluateTimeout(candidate({ status: "completed" }), 5, now);
    expect(decision.shouldFinalize).toBe(false);
    expect(decision.reason).toBe("not_open");
  });
});
