import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  challengeSearchSchema,
  createChallengeSchema,
  disputeSchema,
  gameActionSchema,
  gameCatalogSchema,
  gameSettingsSchema,
  gamingProfileSchema,
  guestSetupSchema,
  moderationActionSchema,
  ratingAdjustmentSchema,
  reportSchema,
  restrictionSchema,
  reviewSchema,
} from "@/lib/validations/phase5";
import { gameConfigFor, GAME_DEFINITIONS, GAME_LIST, isGameSlug } from "@/lib/games/catalog";
import { challengeChannelName, leaderboardChannelName, matchChannelName } from "@/lib/games/realtime";
import { GAME_SLUGS, MODE_LABELS, validateEnvelope } from "@/lib/games/types";
import { engineFor } from "@/lib/games/registry";

const uuid = "11111111-1111-4111-8111-111111111111";

describe("Phase 5 — input validation", () => {
  it("validates guest setup and blocks identical local player names", () => {
    const base = { gameSlug: "chess", mode: "local" as const, playerOne: "Ace", playerTwo: "Rook", config: {} };
    expect(guestSetupSchema.safeParse(base).success).toBe(true);
    expect(guestSetupSchema.safeParse({ ...base, playerTwo: " ace " }).success).toBe(false);
    expect(guestSetupSchema.safeParse({ ...base, mode: "practice", playerTwo: "Ace" }).success).toBe(true);
    expect(guestSetupSchema.safeParse({ ...base, playerOne: "A" }).success).toBe(false);
    expect(guestSetupSchema.safeParse({ ...base, gameSlug: "poker" }).success).toBe(false);
  });

  it("validates challenge, search and gaming profile inputs", () => {
    expect(challengeSearchSchema.safeParse({ query: "  Ace " }).success).toBe(true);
    expect(challengeSearchSchema.safeParse({ query: "A" }).success).toBe(false);

    expect(createChallengeSchema.safeParse({ gameSlug: "chess", opponentId: uuid }).success).toBe(true);
    expect(createChallengeSchema.safeParse({ gameSlug: "chess", opponentId: "bad" }).success).toBe(false);
    expect(createChallengeSchema.safeParse({ gameSlug: "chess", opponentId: uuid, timeControl: "60" }).success).toBe(false);

    expect(gamingProfileSchema.safeParse({
      gamingName: "Ace_Star-1", visibility: "public", searchable: true, challengesEnabled: true, bio: "Hi",
    }).success).toBe(true);
    expect(gamingProfileSchema.safeParse({
      gamingName: "ace@star", visibility: "public", searchable: true, challengesEnabled: true,
    }).success).toBe(false);
  });

  it("validates competitive action intent without trusting client scores", () => {
    expect(gameActionSchema.safeParse({
      seq: 1, expectedVersion: 1, actor: 0, type: "offer_draw", payload: { now: 100 },
    }).success).toBe(true);
    expect(gameActionSchema.safeParse({
      seq: 1, expectedVersion: 1, actor: 2, type: "move", payload: {},
    }).success).toBe(false);
    expect(gameActionSchema.safeParse({
      seq: 1, expectedVersion: 1, actor: 0, type: "finish", payload: { winner: 0, scores: [9, 0] },
    }).success).toBe(false);
  });

  it("validates admin settings, reports and audited adjustments", () => {
    const settings = {
      startingRating: 1200, kFactor: 32, defaultAttempts: 10, penaltyAttempts: 5,
      queenValue: 3, coinValue: 1, suddenDeath: true, challengeExpiryMinutes: 60,
      challengeRateLimit: 8, reconnectionGraceMinutes: 5, seasonKey: "2026-1",
      seasonLabel: "2026 Season", defaultTimeControl: "10",
    };
    expect(gameSettingsSchema.safeParse(settings).success).toBe(true);
    expect(gameSettingsSchema.safeParse({ ...settings, kFactor: 1000 }).success).toBe(false);

    const catalog = {
      name: "Chess", shortName: "Chess", tagline: "Strategy", description: "A game",
      instructions: "Move pieces", category: "Strategy", accent: "#3564E9", sortOrder: 1,
      isEnabled: true, guestEnabled: true, competitiveEnabled: true, challengeEnabled: true,
      practiceEnabled: true, leaderboardVisible: true,
    };
    expect(gameCatalogSchema.safeParse(catalog).success).toBe(true);
    expect(gameCatalogSchema.safeParse({ ...catalog, accent: "blue" }).success).toBe(false);

    expect(reportSchema.safeParse({ reason: "cheating", details: "Moved twice", gameSlug: "chess" }).success).toBe(true);
    expect(reportSchema.safeParse({ reason: "cheating", details: "short" }).success).toBe(false);
    expect(disputeSchema.safeParse({ publicId: "abcdef1234567890", reason: "Wrong result" }).success).toBe(true);
    expect(disputeSchema.safeParse({ publicId: "abc", reason: "Wrong result" }).success).toBe(false);
    expect(ratingAdjustmentSchema.safeParse({ userId: uuid, gameSlug: "chess", rating: 1300, reason: "Audited fix" }).success).toBe(true);
    expect(ratingAdjustmentSchema.safeParse({ userId: uuid, gameSlug: "chess", rating: 9, reason: "Audited fix" }).success).toBe(false);
    expect(restrictionSchema.safeParse({ userId: uuid, type: "ranked", reason: "Repeated abuse", expiresAt: "2026-07-01T00:00:00.000Z" }).success).toBe(true);
    expect(restrictionSchema.safeParse({ userId: uuid, type: "ranked", reason: "Bad", expiresAt: "tomorrow" }).success).toBe(false);
    expect(moderationActionSchema.safeParse({ userId: uuid, action: "flag", note: "Review" }).success).toBe(true);
    expect(reviewSchema.safeParse({ id: uuid, status: "resolved", note: "Done" }).success).toBe(true);
  });
});

describe("Phase 5 — catalog, registry and transport", () => {
  it("registers exactly six official games and one engine for each", () => {
    expect(GAME_SLUGS).toEqual(["chess", "carrom", "tic-tac-toe", "connect-four", "penalty-shootout", "basketball"]);
    expect(GAME_LIST).toHaveLength(6);
    for (const slug of GAME_SLUGS) {
      expect(isGameSlug(slug)).toBe(true);
      expect(engineFor(slug).slug).toBe(slug);
      expect(GAME_DEFINITIONS[slug].rules.length).toBeGreaterThan(0);
      expect(gameConfigFor(slug)).toBeTruthy();
    }
    expect(isGameSlug("poker")).toBe(false);
  });

  it("uses opaque, namespaced realtime channels", () => {
    expect(matchChannelName("abcdef1234567890")).toBe("phase5:match:abcdef1234567890");
    expect(challengeChannelName(uuid)).toBe(`phase5:challenges:${uuid}`);
    expect(leaderboardChannelName("chess")).toBe("phase5:leaderboard:chess");
  });

  it("labels all four match modes and keeps envelope validation strict", () => {
    expect(Object.keys(MODE_LABELS)).toEqual(["guest", "practice", "friendly", "ranked"]);
    const engine = engineFor("tic-tac-toe");
    const state = engine.create({});
    const base = { seq: 1, expectedVersion: 1, actor: 0 as const, type: "move", payload: { cell: 0 } };
    expect(validateEnvelope(state, base, engine, 0)).toBeNull();
    expect(validateEnvelope(state, { ...base, seq: 2 }, engine, 0)).toContain("sequence");
    expect(validateEnvelope(state, { ...base, expectedVersion: 2 }, engine, 0)).toContain("outdated");
    expect(validateEnvelope(state, { ...base, actor: 1 }, engine, 1)).toContain("another player");
  });
});

describe("Phase 5 — static architecture guards", () => {
  const realtime = readFileSync(resolve(process.cwd(), "src/lib/games/realtime.ts"), "utf8");
  const matchService = readFileSync(resolve(process.cwd(), "src/lib/games/match-service.ts"), "utf8");
  const migration = readFileSync(resolve(process.cwd(), "supabase/migrations/0005_phase5_games_multiplayer.sql"), "utf8");

  it("keeps game rules, persistence and realtime transport separated", () => {
    expect(realtime).toContain("Realtime transport only");
    expect(realtime).toContain("never treated as an authority for game state");
    expect(matchService).toContain("Authoritative match transitions");
    expect(migration).toContain("create table public.game_match_actions");
  });

  it("does not create a sixth game or a new notification category", () => {
    expect(GAME_LIST).toHaveLength(6);
    expect(realtime).not.toContain("match_complete is the authority");
    expect(migration).not.toContain("create type public.game_notification_category");
  });
});
