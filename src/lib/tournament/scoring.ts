import { validateScore } from "./standings";
import type { MatchResultInput, ScoringMode, TournamentSlot } from "./types";

export interface ScoreAdapter {
  mode: ScoringMode;
  label: string;
  description: string;
  validate(result: MatchResultInput): { ok: boolean; error?: string };
  deriveWinner(result: MatchResultInput, slots: { a: TournamentSlot; b: TournamentSlot }): string | null;
}

const scoreResult = (result: MatchResultInput, mode: ScoringMode) => validateScore(mode, result);

/** Reusable scoring adapters — no per-sport scoreboard code required. */
export const SCORE_ADAPTERS: Record<ScoringMode, ScoreAdapter> = {
  simple: {
    mode: "simple",
    label: "Simple score",
    description: "One final numeric score per side; the higher score wins.",
    validate: (result) => {
      const checked = scoreResult(result, "simple");
      return { ok: checked.ok, error: checked.error };
    },
    deriveWinner: (result, slots) => {
      if (result.scoreA === null || result.scoreB === null || result.scoreA === result.scoreB) return null;
      return result.scoreA > result.scoreB ? slots.a.entryId : slots.b.entryId;
    },
  },
  sets: {
    mode: "sets",
    label: "Sets / rounds",
    description: "Record each set separately; the organiser confirms the overall winner.",
    validate: (result) => {
      const checked = scoreResult(result, "sets");
      return { ok: checked.ok, error: checked.error };
    },
    deriveWinner: (result) => result.winnerEntryId,
  },
  time: {
    mode: "time",
    label: "Time-based",
    description: "Lower recorded time wins; the organiser confirms the winner.",
    validate: (result) => {
      const checked = scoreResult(result, "time");
      return { ok: checked.ok, error: checked.error };
    },
    deriveWinner: (result) => result.winnerEntryId,
  },
  manual: {
    mode: "manual",
    label: "Manual winner",
    description: "No numeric score; an authorised official selects the winner.",
    validate: (result) => {
      const checked = scoreResult(result, "manual");
      return { ok: checked.ok, error: checked.error };
    },
    deriveWinner: (result) => result.winnerEntryId,
  },
};

export function getAdapter(mode: ScoringMode | string | null | undefined): ScoreAdapter {
  return mode && mode in SCORE_ADAPTERS ? SCORE_ADAPTERS[mode as ScoringMode] : SCORE_ADAPTERS.manual;
}
