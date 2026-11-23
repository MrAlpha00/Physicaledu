/**
 * Phase 4 — core tournament domain types.
 *
 * These types are intentionally independent of Supabase and React so the
 * tournament rules can be exercised by unit tests without live services.
 */

export type CompetitionMode = "team" | "individual";

export type TournamentFormat = "knockout" | "round_robin" | "group_knockout";

export type DrawMode = "random" | "seeded" | "manual";

export type ScoringMode = "simple" | "sets" | "time" | "manual";

export type EntryStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "approved"
  | "rejected"
  | "waitlisted"
  | "withdrawn";

export type PaymentStatus =
  | "not_required"
  | "pending_verification"
  | "verified"
  | "rejected"
  | "waived"
  | "refunded";

export type MatchStatus =
  | "scheduled"
  | "ready"
  | "ongoing"
  | "result_submitted"
  | "completed"
  | "postponed"
  | "cancelled"
  | "disputed";

export type TournamentStage = "group" | "league" | "knockout" | "third_place";

export type Tiebreaker =
  | "competition_points"
  | "point_difference"
  | "points_scored"
  | "wins"
  | "head_to_head";

export interface PointsConfig {
  win: number;
  draw: number;
  loss: number;
  tiebreakers: Tiebreaker[];
}

export const DEFAULT_POINTS: PointsConfig = {
  win: 3,
  draw: 1,
  loss: 0,
  tiebreakers: [
    "competition_points",
    "point_difference",
    "points_scored",
    "wins",
  ],
};

/** A competitor in the draw — a competition entry (team or individual). */
export interface TournamentEntry {
  entryId: string;
  label: string;
  seed?: number | null;
}

/** One side of a generated match. */
export interface TournamentSlot {
  /** Direct entry, when the slot is known at generation time. */
  entryId: string | null;
  /** Match whose winner feeds this slot. */
  sourceMatchKey: string | null;
  /** True when the slot came from a bye rather than a played match. */
  fromBye: boolean;
}

export interface GeneratedMatch {
  key: string;
  matchNumber: number;
  roundKey: string;
  roundName: string;
  stage: TournamentStage;
  groupKey: string | null;
  slotA: TournamentSlot;
  slotB: TournamentSlot;
  /** A bye record is shown explicitly and never counted as a played match. */
  isBye: boolean;
  /** Entry that advances without a match being played. */
  byeWinnerEntryId: string | null;
  scheduledAt: string | null;
  venue: string | null;
}

export interface GeneratedRound {
  key: string;
  name: string;
  roundNumber: number;
  stage: TournamentStage;
  groupKey: string | null;
  matchKeys: string[];
}

export interface GeneratedGroup {
  key: string;
  name: string;
  entryIds: string[];
}

/** Authoritative progression edge (winner feed, or loser feed for a third-place match). */
export interface TournamentProgressionEdge {
  sourceMatchKey: string;
  targetMatchKey: string;
  targetSlot: "a" | "b";
  feed?: "winner" | "loser";
}

export interface TournamentPlan {
  format: TournamentFormat;
  drawMode: DrawMode;
  /** Deterministic PRNG seed; stored so a draw is reproducible. */
  drawSeed: number;
  version: number;
  generatedAt: string;
  bracketSize: number;
  groups: GeneratedGroup[];
  rounds: GeneratedRound[];
  matches: GeneratedMatch[];
  edges: TournamentProgressionEdge[];
  points: PointsConfig;
  thirdPlace: boolean;
  qualifiersPerGroup: number;
  legs: number;
}

export interface TournamentGenerationOptions {
  format: TournamentFormat;
  drawMode?: DrawMode;
  drawSeed?: number;
  entries: TournamentEntry[];
  version?: number;
  generatedAt?: string;
  thirdPlace?: boolean;
  groupCount?: number;
  qualifiersPerGroup?: number;
  legs?: number;
  points?: PointsConfig;
  /** Explicit entry order for manual draws. */
  manualOrder?: string[];
}

export interface MatchResultInput {
  scoreA: number | null;
  scoreB: number | null;
  winnerEntryId: string | null;
  breakdown?: Array<{ set: number; scoreA: number; scoreB: number }>;
  notes?: string | null;
}

export interface StandingsRow {
  entryId: string;
  played: number;
  wins: number;
  losses: number;
  draws: number;
  pointsFor: number;
  pointsAgainst: number;
  pointDifference: number;
  competitionPoints: number;
  qualified: boolean;
}

export function emptySlot(): TournamentSlot {
  return { entryId: null, sourceMatchKey: null, fromBye: false };
}

export function directSlot(entryId: string): TournamentSlot {
  return { entryId, sourceMatchKey: null, fromBye: false };
}
