import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { GAME_DEFINITIONS, GAME_LIST, isGameSlug, type GameDefinition } from "@/lib/games/catalog";
import type { GameSlug } from "@/lib/games/types";
import type {
  Phase5ActionRow,
  Phase5ChallengeRow,
  Phase5GameRow,
  Phase5GameSettingsRow,
  Phase5GamingProfileRow,
  Phase5MatchPlayerRow,
  Phase5MatchRow,
  Phase5RatingRow,
  Phase5ResultRow,
} from "@/types/database";

export interface GameView extends GameDefinition {
  isEnabled: boolean;
  guestEnabled: boolean;
  competitiveEnabled: boolean;
  challengeEnabled: boolean;
  practiceEnabled: boolean;
  leaderboardVisible: boolean;
  maintenanceMessage: string | null;
  settings: Phase5GameSettingsRow | null;
}

export interface LeaderboardEntry {
  userId: string;
  gamingName: string;
  rating: number;
  highestRating: number;
  played: number;
  wins: number;
  losses: number;
  draws: number;
  rank: number;
}

export interface MatchView extends Phase5MatchRow {
  players: Phase5MatchPlayerRow[];
  result: Phase5ResultRow | null;
  actions: Phase5ActionRow[];
}

export interface ChallengeView extends Phase5ChallengeRow {
  challengerName: string | null;
  opponentName: string | null;
}

function asJsonRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function toGameView(row: Phase5GameRow | null, settings: Phase5GameSettingsRow | null, slug: GameSlug): GameView {
  const fallback = GAME_DEFINITIONS[slug];
  return {
    ...fallback,
    name: row?.name ?? fallback.name,
    shortName: row?.short_name ?? fallback.shortName,
    tagline: row?.tagline ?? fallback.tagline,
    description: row?.description ?? fallback.description,
    rules: Array.isArray(row?.rules) ? (row?.rules as GameDefinition["rules"]) : fallback.rules,
    category: row?.category ?? fallback.category,
    accent: row?.accent ?? fallback.accent,
    isEnabled: row?.is_enabled ?? true,
    guestEnabled: row?.guest_enabled ?? true,
    competitiveEnabled: row?.competitive_enabled ?? true,
    challengeEnabled: row?.challenge_enabled ?? true,
    practiceEnabled: row?.practice_enabled ?? true,
    leaderboardVisible: row?.leaderboard_visible ?? true,
    maintenanceMessage: row?.maintenance_message ?? null,
    settings,
  };
}

/** Public catalog read with a safe static fallback while the migration is pending. */
export const getPublicGames = cache(async (): Promise<GameView[]> => {
  const supabase = await createClient();
  const { data } = await supabase.from("game_catalog").select("*").order("sort_order");
  const { data: settingsRows } = await supabase.from("game_settings").select("*");
  const rows = new Map((data ?? []).map((row) => [row.slug, row]));
  const settings = new Map((settingsRows ?? []).map((row) => [row.game_slug, row]));
  return GAME_LIST.map((definition) =>
    toGameView(rows.get(definition.slug) ?? null, settings.get(definition.slug) ?? null, definition.slug),
  );
});

export const getGameView = cache(async (slug: string): Promise<GameView | null> => {
  if (!isGameSlug(slug)) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("game_catalog").select("*").eq("slug", slug).maybeSingle();
  const { data: settingRow } = await supabase.from("game_settings").select("*").eq("game_slug", slug).maybeSingle();
  return toGameView(data ?? null, settingRow ?? null, slug);
});

export const getGameSettings = cache(async (slug: GameSlug): Promise<Phase5GameSettingsRow | null> => {
  const supabase = await createClient();
  const { data } = await supabase.from("game_settings").select("*").eq("game_slug", slug).maybeSingle();
  return data ?? null;
});

export const getLeaderboard = cache(async (
  slug: GameSlug,
  seasonKey?: string,
  limit = 25,
): Promise<LeaderboardEntry[]> => {
  const supabase = await createClient();
  let query = supabase
    .from("game_ratings")
    .select("user_id, rating, highest_rating, played, wins, losses, draws, season_key")
    .eq("game_slug", slug)
    .order("rating", { ascending: false })
    .order("played", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 100));
  if (seasonKey) query = query.eq("season_key", seasonKey);

  const { data } = await query;
  if (!data?.length) return [];
  // The gaming_profiles join is intentionally a second query: public RLS on
  // game_ratings already guarantees that only visible profiles are returned.
  const ids = data.map((row) => row.user_id);
  const { data: profiles } = await supabase
    .from("gaming_profiles").select("user_id, gaming_name").in("user_id", ids);
  const names = new Map((profiles ?? []).map((row) => [row.user_id, row.gaming_name]));
  return data.map((row, index) => ({
    userId: row.user_id,
    gamingName: names.get(row.user_id) ?? "Varsity Player",
    rating: row.rating,
    highestRating: row.highest_rating,
    played: row.played,
    wins: row.wins,
    losses: row.losses,
    draws: row.draws,
    rank: index + 1,
  }));
});

export const getGamingProfile = cache(async (userId: string): Promise<Phase5GamingProfileRow | null> => {
  const supabase = await createClient();
  const { data } = await supabase.from("gaming_profiles").select("*").eq("user_id", userId).maybeSingle();
  return data ?? null;
});

export const searchGamingProfiles = cache(async (query: string) => {
  const supabase = await createClient();
  const { data } = await supabase.rpc("phase5_search_profiles", { p_query: query });
  return (data ?? []).map((row) => ({
    userId: row.user_id,
    gamingName: row.gaming_name,
    departmentName: row.department_name,
  }));
});

export const getMyRatings = cache(async (userId: string): Promise<Phase5RatingRow[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("game_ratings").select("*").eq("user_id", userId).order("game_slug");
  return data ?? [];
});

export const getMyChallenges = cache(async (userId: string): Promise<ChallengeView[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("game_challenges").select("*")
    .or(`challenger_id.eq.${userId},opponent_id.eq.${userId}`)
    .order("created_at", { ascending: false }).limit(100);
  const rows = data ?? [];
  const ids = [...new Set(rows.flatMap((row) => [row.challenger_id, row.opponent_id]))];
  const { data: profiles } = ids.length
    ? await supabase.from("gaming_profiles").select("user_id, gaming_name").in("user_id", ids)
    : { data: [] };
  const names = new Map((profiles ?? []).map((row) => [row.user_id, row.gaming_name]));
  return rows.map((row) => ({
    ...row,
    challengerName: names.get(row.challenger_id) ?? "Varsity Player",
    opponentName: names.get(row.opponent_id) ?? "Varsity Player",
  }));
});

export const getMyMatches = cache(async (userId: string, limit = 50): Promise<MatchView[]> => {
  const supabase = await createClient();
  const { data: players } = await supabase
    .from("game_match_players").select("match_id").eq("user_id", userId);
  const matchIds = [...new Set((players ?? []).map((row) => row.match_id))];
  if (!matchIds.length) return [];
  const { data } = await supabase
    .from("game_matches").select("*").in("id", matchIds)
    .order("updated_at", { ascending: false }).limit(limit);
  return hydrateMatches(data ?? []);
});

export const getMatchByPublicId = cache(async (publicId: string): Promise<MatchView | null> => {
  if (!/^[a-f0-9]{16,64}$/.test(publicId)) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("game_matches").select("*").eq("public_id", publicId).maybeSingle();
  if (!data) return null;
  const [view] = await hydrateMatches([data]);
  return view ?? null;
});

async function hydrateMatches(rows: Phase5MatchRow[]): Promise<MatchView[]> {
  if (!rows.length) return [];
  const supabase = await createClient();
  const ids = rows.map((row) => row.id);
  const [{ data: players }, { data: results }, { data: actions }] = await Promise.all([
    supabase.from("game_match_players").select("*").in("match_id", ids),
    supabase.from("game_match_results").select("*").in("match_id", ids),
    supabase.from("game_match_actions").select("*").in("match_id", ids).order("seq").limit(500),
  ]);
  return rows.map((row) => ({
    ...row,
    players: (players ?? []).filter((player) => player.match_id === row.id),
    result: (results ?? []).find((result) => result.match_id === row.id) ?? null,
    actions: (actions ?? []).filter((action) => action.match_id === row.id),
  }));
}

export const getRecentResults = cache(async (userId: string, limit = 20): Promise<MatchView[]> => {
  const supabase = await createClient();
  const { data: players } = await supabase
    .from("game_match_players").select("match_id").eq("user_id", userId);
  const matchIds = [...new Set((players ?? []).map((row) => row.match_id))];
  if (!matchIds.length) return [];
  const { data } = await supabase
    .from("game_matches").select("*").in("id", matchIds).eq("status", "completed")
    .order("ended_at", { ascending: false }).limit(limit);
  return hydrateMatches(data ?? []);
});

export const getRatingHistory = cache(async (userId: string, gameSlug?: GameSlug) => {
  const supabase = await createClient();
  let query = supabase.from("game_rating_history").select("*")
    .eq("user_id", userId).order("created_at", { ascending: false }).limit(100);
  if (gameSlug) query = query.eq("game_slug", gameSlug);
  const { data } = await query;
  return data ?? [];
});

export const getAchievementRules = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.from("game_achievement_rules").select("*")
    .eq("is_enabled", true).order("title");
  return data ?? [];
});

/* ----------------------------- administration ---------------------------- */

export const getAdminCatalog = cache(async (): Promise<{ game: Phase5GameRow; settings: Phase5GameSettingsRow | null }[]> => {
  const supabase = await createClient();
  const { data: games } = await supabase.from("game_catalog").select("*").order("sort_order");
  const { data: settings } = await supabase.from("game_settings").select("*");
  return (games ?? []).map((game) => ({
    game,
    settings: (settings ?? []).find((row) => row.game_slug === game.slug) ?? null,
  }));
});

export const getAdminReports = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.from("game_reports").select("*")
    .order("created_at", { ascending: false }).limit(100);
  return data ?? [];
});

export const getAdminDisputes = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.from("match_disputes").select("*")
    .order("created_at", { ascending: false }).limit(100);
  return data ?? [];
});

export const getAdminRestrictions = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.from("gaming_restrictions").select("*")
    .order("created_at", { ascending: false }).limit(100);
  return data ?? [];
});

export const getAdminAdjustments = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.from("rating_adjustment_history").select("*")
    .order("created_at", { ascending: false }).limit(100);
  return data ?? [];
});

export function gameSettingsPayload(record: Record<string, unknown>): Record<string, unknown> {
  const numeric = (key: string, fallback: number) => {
    const value = record[key];
    return typeof value === "number" && Number.isFinite(value) ? value : fallback;
  };
  return {
    startingRating: numeric("starting_rating", 1200),
    kFactor: numeric("k_factor", 32),
    defaultAttempts: numeric("default_attempts", 10),
    penaltyAttempts: numeric("penalty_attempts", 5),
    queenValue: numeric("queen_value", 3),
    coinValue: numeric("coin_value", 1),
    suddenDeath: record.sudden_death !== false,
    challengeExpiryMinutes: numeric("challenge_expiry_minutes", 60),
    challengeRateLimit: numeric("challenge_rate_limit", 8),
    reconnectionGraceMinutes: numeric("reconnection_grace_minutes", 5),
    seasonKey: typeof record.season_key === "string" ? record.season_key : "all-time",
    seasonLabel: typeof record.season_label === "string" ? record.season_label : "All time",
    defaultTimeControl: typeof record.default_time_control === "string" ? record.default_time_control : "10",
  };
}

export function gameCatalogPayload(record: Phase5GameRow): Record<string, unknown> {
  return {
    name: record.name,
    shortName: record.short_name,
    tagline: record.tagline,
    description: record.description,
    instructions: record.instructions,
    rules: record.rules,
    category: record.category,
    accent: record.accent,
    sortOrder: record.sort_order,
    isEnabled: record.is_enabled,
    guestEnabled: record.guest_enabled,
    competitiveEnabled: record.competitive_enabled,
    challengeEnabled: record.challenge_enabled,
    practiceEnabled: record.practice_enabled,
    leaderboardVisible: record.leaderboard_visible,
    maintenanceMessage: record.maintenance_message ?? "",
  };
}

export function toJsonConfig(value: unknown): Record<string, unknown> {
  return asJsonRecord(value);
}
