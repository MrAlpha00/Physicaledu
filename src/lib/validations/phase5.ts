import { z } from "zod";
import { GAME_SLUGS } from "@/lib/games/types";

const gameSlug = z.enum(GAME_SLUGS);
const displayName = z.string().trim().min(2, "Enter at least two characters.").max(40);

export const gameActionSchema = z.object({
  seq: z.number().int().positive(),
  expectedVersion: z.number().int().positive(),
  actor: z.union([z.literal(0), z.literal(1)]),
  type: z.string().regex(/^[a-z_]{2,40}$/),
  payload: z.record(z.string(), z.unknown()),
});

export type GameActionInput = z.infer<typeof gameActionSchema>;

export const guestSetupSchema = z.object({
  gameSlug,
  playerOne: displayName,
  playerTwo: displayName,
  mode: z.enum(["local", "practice"]),
  config: z.record(z.string(), z.unknown()).default({}),
}).superRefine((value, context) => {
  if (value.mode === "local" && value.playerOne.toLowerCase() === value.playerTwo.toLowerCase()) {
    context.addIssue({ code: "custom", path: ["playerTwo"], message: "Use two different player names." });
  }
});

export type GuestSetupInput = z.infer<typeof guestSetupSchema>;

export const challengeSearchSchema = z.object({
  query: z.string().trim().min(2, "Enter at least two characters.").max(40),
});

export const createChallengeSchema = z.object({
  gameSlug,
  opponentId: z.string().uuid("Select a student from the search results."),
  message: z.string().trim().max(240).optional().default(""),
  settings: z.record(z.string(), z.unknown()).default({}),
  timeControl: z.enum(["unlimited", "5", "10", "15"]).optional(),
});

export type CreateChallengeInput = z.infer<typeof createChallengeSchema>;

export const gamingProfileSchema = z.object({
  gamingName: displayName.regex(/^[a-zA-Z0-9 _-]+$/, "Use letters, numbers, spaces, hyphens or underscores."),
  visibility: z.enum(["private", "public"]),
  searchable: z.boolean(),
  challengesEnabled: z.boolean(),
  bio: z.string().trim().max(500).optional().default(""),
});

export type GamingProfileInput = z.infer<typeof gamingProfileSchema>;

export const chessTimeControlSchema = z.enum(["unlimited", "5", "10", "15"]);

export const gameSettingsSchema = z.object({
  startingRating: z.number().int().min(100).max(5000),
  kFactor: z.number().int().min(8).max(128),
  defaultAttempts: z.number().int().min(1).max(100),
  penaltyAttempts: z.number().int().min(1).max(20),
  queenValue: z.number().int().min(1).max(20),
  coinValue: z.number().int().min(1).max(20),
  suddenDeath: z.boolean(),
  challengeExpiryMinutes: z.number().int().min(5).max(10080),
  challengeRateLimit: z.number().int().min(1).max(100),
  reconnectionGraceMinutes: z.number().int().min(1).max(60),
  seasonKey: z.string().trim().min(2).max(40),
  seasonLabel: z.string().trim().min(2).max(60),
  defaultTimeControl: chessTimeControlSchema,
});

export type GameSettingsInput = z.infer<typeof gameSettingsSchema>;

export const gameCatalogSchema = z.object({
  name: z.string().trim().min(2).max(60),
  shortName: z.string().trim().min(2).max(30),
  tagline: z.string().trim().max(120),
  description: z.string().trim().max(2000),
  instructions: z.string().trim().max(4000),
  category: z.string().trim().max(60),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  sortOrder: z.number().int().min(0).max(100),
  isEnabled: z.boolean(),
  guestEnabled: z.boolean(),
  competitiveEnabled: z.boolean(),
  challengeEnabled: z.boolean(),
  practiceEnabled: z.boolean(),
  leaderboardVisible: z.boolean(),
  maintenanceMessage: z.string().trim().max(300).optional().default(""),
});

export type GameCatalogInput = z.infer<typeof gameCatalogSchema>;

export const reportSchema = z.object({
  reportedUserId: z.string().uuid().optional().nullable(),
  matchId: z.string().uuid().optional().nullable(),
  gameSlug: gameSlug.optional().nullable(),
  reason: z.enum(["abuse", "cheating", "harassment", "inappropriate_name", "dispute", "other"]),
  details: z.string().trim().min(10, "Add a few details.").max(2000),
});

export const disputeSchema = z.object({
  publicId: z.string().regex(/^[a-f0-9]{16,64}$/, "Invalid match identifier."),
  reason: z.string().trim().min(5, "Give a short reason.").max(200),
  details: z.string().trim().max(2000).optional().default(""),
});

export const ratingAdjustmentSchema = z.object({
  userId: z.string().uuid(),
  gameSlug,
  rating: z.number().int().min(100).max(5000),
  reason: z.string().trim().min(5, "A detailed reason is required.").max(500),
});

export const restrictionSchema = z.object({
  userId: z.string().uuid(),
  gameSlug: gameSlug.optional().nullable(),
  type: z.enum(["all", "ranked", "challenge", "public_profile"]),
  reason: z.string().trim().min(5).max(500),
  expiresAt: z.string().datetime().optional().nullable(),
  active: z.boolean().default(true),
});

export const moderationActionSchema = z.object({
  userId: z.string().uuid(),
  action: z.enum(["flag", "clear"]),
  note: z.string().trim().max(500).optional().default(""),
});

export const reviewSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["reviewing", "resolved", "dismissed", "rejected"]),
  note: z.string().trim().max(1000).optional().default(""),
});
