/** Modular, per-game Elo rating service. Pure functions only. */
import type { GameSlug, MatchMode, Outcome, PlayerIndex } from "./types";

export const DEFAULT_STARTING_RATING = 1200;
export const DEFAULT_K_FACTOR = 32;

export interface RatingRecord {
  rating: number;
  highestRating: number;
  played: number;
  wins: number;
  losses: number;
  draws: number;
}

export function emptyRating(starting = DEFAULT_STARTING_RATING): RatingRecord {
  return { rating: starting, highestRating: starting, played: 0, wins: 0, losses: 0, draws: 0 };
}

export function expectedScore(player: number, opponent: number): number {
  return 1 / (1 + 10 ** ((opponent - player) / 400));
}

export function scoreForPlayer(outcome: Outcome, player: PlayerIndex): number {
  if (outcome.kind === "draw") return 0.5;
  return outcome.winner === player ? 1 : 0;
}

export function ratingDelta(player: number, opponent: number, outcome: Outcome, playerIndex: PlayerIndex, kFactor = DEFAULT_K_FACTOR): number {
  const actual = scoreForPlayer(outcome, playerIndex);
  const expected = expectedScore(player, opponent);
  return Math.round(kFactor * (actual - expected));
}

export interface RatingEligibility {
  eligible: boolean;
  reason?: string;
}

/**
 * Only confirmed, completed, non-disputed ranked matches between two
 * authenticated students may move an official rating.
 */
export function ratingEligibility(input: {
  mode: MatchMode;
  status: string;
  disputed?: boolean;
  participantIds: Array<string | null>;
  outcome: Outcome | null;
}): RatingEligibility {
  if (input.mode !== "ranked") return { eligible: false, reason: `${input.mode} matches are unrated.` };
  if (input.status !== "completed") return { eligible: false, reason: "Only completed matches are rated." };
  if (input.disputed) return { eligible: false, reason: "Disputed results are not rated." };
  if (input.participantIds.length !== 2 || input.participantIds.some((id) => !id)) {
    return { eligible: false, reason: "Both players must be authenticated students." };
  }
  if (!input.outcome) return { eligible: false, reason: "The match has no confirmed outcome." };
  return { eligible: true };
}

export interface RatingUpdate {
  gameSlug: GameSlug;
  playerId: string;
  before: number;
  after: number;
  delta: number;
  outcome: "win" | "loss" | "draw";
}

export function calculateRatingUpdates(input: {
  gameSlug: GameSlug;
  mode: MatchMode;
  status: string;
  disputed?: boolean;
  outcome: Outcome | null;
  players: Array<{ userId: string | null; record: RatingRecord }>;
  kFactor?: number;
}): { eligible: boolean; reason?: string; updates: RatingUpdate[] } {
  const eligibility = ratingEligibility({
    mode: input.mode,
    status: input.status,
    disputed: input.disputed,
    participantIds: input.players.map((player) => player.userId),
    outcome: input.outcome,
  });
  if (!eligibility.eligible) return { ...eligibility, updates: [] };
  if (input.players.length !== 2 || !input.outcome) return { eligible: false, reason: "Invalid participants.", updates: [] };

  const [a, b] = input.players;
  const deltaA = ratingDelta(a.record.rating, b.record.rating, input.outcome, 0, input.kFactor ?? DEFAULT_K_FACTOR);
  const deltaB = ratingDelta(b.record.rating, a.record.rating, input.outcome, 1, input.kFactor ?? DEFAULT_K_FACTOR);
  const label = (index: PlayerIndex) =>
    input.outcome?.kind === "draw" ? "draw" : input.outcome?.winner === index ? "win" : "loss";

  return {
    eligible: true,
    updates: [
      { gameSlug: input.gameSlug, playerId: a.userId as string, before: a.record.rating, after: a.record.rating + deltaA, delta: deltaA, outcome: label(0) },
      { gameSlug: input.gameSlug, playerId: b.userId as string, before: b.record.rating, after: b.record.rating + deltaB, delta: deltaB, outcome: label(1) },
    ],
  };
}

export function applyRatingRecord(record: RatingRecord, update: RatingUpdate): RatingRecord {
  return {
    rating: update.after,
    highestRating: Math.max(record.highestRating, update.after),
    played: record.played + 1,
    wins: record.wins + (update.outcome === "win" ? 1 : 0),
    losses: record.losses + (update.outcome === "loss" ? 1 : 0),
    draws: record.draws + (update.outcome === "draw" ? 1 : 0),
  };
}

export function winPercentage(record: Pick<RatingRecord, "played" | "wins">): number {
  if (record.played === 0) return 0;
  return Math.round((record.wins / record.played) * 1000) / 10;
}
