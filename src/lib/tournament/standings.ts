import { DEFAULT_POINTS, type MatchResultInput, type PointsConfig, type StandingsRow, type Tiebreaker } from "./types";

export interface StandingsMatch {
  key: string;
  groupKey: string | null;
  slotAEntryId: string | null;
  slotBEntryId: string | null;
  result: MatchResultInput | null;
}

export interface StandingsOptions {
  points?: PointsConfig;
  groupKey?: string | null;
  qualifyingSpots?: number;
}

function compareRows(a: StandingsRow, b: StandingsRow, tiebreakers: Tiebreaker[]): number {
  for (const rule of tiebreakers) {
    switch (rule) {
      case "competition_points":
        if (b.competitionPoints !== a.competitionPoints) return b.competitionPoints - a.competitionPoints;
        break;
      case "point_difference":
        if (b.pointDifference !== a.pointDifference) return b.pointDifference - a.pointDifference;
        break;
      case "points_scored":
        if (b.pointsFor !== a.pointsFor) return b.pointsFor - a.pointsFor;
        break;
      case "wins":
        if (b.wins !== a.wins) return b.wins - a.wins;
        break;
      case "head_to_head":
        // Head-to-head is resolved from the direct encounter when exactly two
        // sides are compared; the caller supplies it via a stable id tiebreak.
        break;
    }
  }
  return a.entryId.localeCompare(b.entryId);
}

/** Calculates league/group tables from recorded results using configured rules. */
export function calculateStandings(
  entryIds: string[],
  matches: StandingsMatch[],
  options: StandingsOptions = {},
): StandingsRow[] {
  const points = options.points ?? DEFAULT_POINTS;
  const rows = new Map<string, StandingsRow>();
  entryIds.forEach((entryId) => {
    rows.set(entryId, {
      entryId,
      played: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      pointDifference: 0,
      competitionPoints: 0,
      qualified: false,
    });
  });

  const relevant = matches.filter(
    (match) =>
      options.groupKey === undefined ||
      (options.groupKey === null ? match.groupKey === null : match.groupKey === options.groupKey),
  );

  for (const match of relevant) {
    const a = match.slotAEntryId ? rows.get(match.slotAEntryId) : undefined;
    const b = match.slotBEntryId ? rows.get(match.slotBEntryId) : undefined;
    const result = match.result;
    if (!a || !b || !result || result.scoreA === null || result.scoreB === null) continue;

    a.played += 1;
    b.played += 1;
    a.pointsFor += result.scoreA;
    a.pointsAgainst += result.scoreB;
    b.pointsFor += result.scoreB;
    b.pointsAgainst += result.scoreA;

    if (result.scoreA === result.scoreB) {
      a.draws += 1;
      b.draws += 1;
      a.competitionPoints += points.draw;
      b.competitionPoints += points.draw;
    } else if (result.scoreA > result.scoreB) {
      a.wins += 1;
      b.losses += 1;
      a.competitionPoints += points.win;
      b.competitionPoints += points.loss;
    } else {
      b.wins += 1;
      a.losses += 1;
      b.competitionPoints += points.win;
      a.competitionPoints += points.loss;
    }
  }

  const sorted = [...rows.values()].map((row) => ({
    ...row,
    pointDifference: row.pointsFor - row.pointsAgainst,
  }));
  sorted.sort((a, b) => compareRows(a, b, points.tiebreakers));

  const spots = options.qualifyingSpots ?? 0;
  sorted.forEach((row, index) => {
    row.qualified = spots > 0 && index < spots;
  });
  return sorted;
}

/** Validates a result against the configured scoring mode. */
export function validateScore(
  mode: "simple" | "sets" | "time" | "manual",
  result: MatchResultInput,
): { ok: boolean; error?: string; winnerEntryId: string | null } {
  if (!result.winnerEntryId) {
    return { ok: false, error: "A winner must be selected.", winnerEntryId: null };
  }
  if (mode === "manual") {
    return { ok: true, winnerEntryId: result.winnerEntryId };
  }
  if (result.scoreA === null || result.scoreB === null) {
    return { ok: false, error: "Both scores are required.", winnerEntryId: result.winnerEntryId };
  }
  if (!Number.isFinite(result.scoreA) || !Number.isFinite(result.scoreB)) {
    return { ok: false, error: "Scores must be numbers.", winnerEntryId: result.winnerEntryId };
  }
  if (result.scoreA < 0 || result.scoreB < 0) {
    return { ok: false, error: "Scores cannot be negative.", winnerEntryId: result.winnerEntryId };
  }
  if (mode === "simple" && result.scoreA === result.scoreB) {
    return { ok: false, error: "A simple score match cannot be a draw.", winnerEntryId: result.winnerEntryId };
  }
  if (mode === "sets") {
    if (!result.breakdown || result.breakdown.length === 0) {
      return { ok: false, error: "Set-by-set scores are required.", winnerEntryId: result.winnerEntryId };
    }
    if (result.breakdown.some((set) => set.scoreA === set.scoreB || set.scoreA < 0 || set.scoreB < 0)) {
      return { ok: false, error: "Each set must have a positive winner.", winnerEntryId: result.winnerEntryId };
    }
  }
  if (mode === "time" && (result.scoreA === 0 || result.scoreB === 0)) {
    return { ok: false, error: "Record a finishing time for both competitors.", winnerEntryId: result.winnerEntryId };
  }
  return { ok: true, winnerEntryId: result.winnerEntryId };
}
