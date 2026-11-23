import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { isGameSlug } from "@/lib/games/catalog";
import { evaluateTimeout, TIMEOUT_OPEN_STATUSES, type TimeoutCandidate } from "@/lib/games/timeout-policy";
import type { Json } from "@/types/database";

export interface TimeoutProcessResult {
  status: "finalised" | "skipped" | "error" | "not_found";
  publicId: string;
  reason?: string;
}

interface CandidateRow {
  id: string;
  public_id: string;
  game_slug: string;
  mode: string;
  status: string;
  state: Json;
  updated_at: string;
  players?: Array<{ player_index: number; connected: boolean; user_id: string | null }>;
}

async function graceMinutesFor(admin: ReturnType<typeof createAdminClient>, gameSlug: string): Promise<number> {
  if (!isGameSlug(gameSlug)) return 5;
  const { data } = await admin
    .from("game_settings")
    .select("reconnection_grace_minutes")
    .eq("game_slug", gameSlug)
    .maybeSingle();
  const configured = data?.reconnection_grace_minutes;
  return typeof configured === "number" && configured >= 1 ? configured : 5;
}

function toCandidate(row: CandidateRow): TimeoutCandidate {
  return {
    publicId: row.public_id,
    gameSlug: row.game_slug,
    mode: row.mode,
    status: row.status,
    state: row.state,
    updatedAt: row.updated_at,
    players: (row.players ?? [])
      .slice()
      .sort((a, b) => a.player_index - b.player_index)
      .map((player) => ({
        playerIndex: player.player_index,
        connected: player.connected,
        userId: player.user_id,
      })),
  };
}

async function finalizeCandidate(
  admin: ReturnType<typeof createAdminClient>,
  row: CandidateRow,
  graceMinutes: number,
  now: number,
): Promise<TimeoutProcessResult> {
  const candidate = toCandidate(row);
  const decision = evaluateTimeout(candidate, graceMinutes, now);
  if (!decision.shouldFinalize) {
    return { status: "skipped", publicId: candidate.publicId, reason: decision.reason };
  }

  const { data, error } = await admin.rpc("phase5_finalize_timeout", {
    p_public_id: candidate.publicId,
    p_outcome: decision.outcome as unknown as Json,
    p_reason: decision.reason,
    p_actor: decision.actor,
    p_clock_expired: decision.clockExpired,
    p_grace_minutes: null,
    p_apply_rating: decision.applyRating,
  });

  if (error) {
    return { status: "error", publicId: candidate.publicId, reason: error.message.slice(0, 200) };
  }

  const result = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  if (result.status === "not_found") return { status: "not_found", publicId: candidate.publicId };
  if (result.status === "skipped") {
    return { status: "skipped", publicId: candidate.publicId, reason: String(result.reason ?? "skipped") };
  }
  return { status: "finalised", publicId: candidate.publicId };
}

/** Lazy fallback: called when a match is opened or an action is attempted. */
export async function lazyExpireMatch(publicId: string): Promise<TimeoutProcessResult | null> {
  if (!/^[a-f0-9]{16,64}$/.test(publicId)) return null;
  const admin = createAdminClient();
  const { data: match } = await admin
    .from("game_matches")
    .select("id, public_id, game_slug, mode, status, state, updated_at")
    .eq("public_id", publicId)
    .maybeSingle();
  if (!match) return null;

  const { data: players } = await admin
    .from("game_match_players")
    .select("player_index, connected, user_id")
    .eq("match_id", match.id);
  const row: CandidateRow = {
    ...(match as CandidateRow),
    players: (players ?? []) as CandidateRow["players"],
  };
  return finalizeCandidate(admin, row, await graceMinutesFor(admin, match.game_slug), Date.now());
}

/** Bounded batch for a generic scheduler invocation. */
export async function processTimeoutBatch(
  limit = 25,
  graceOverrideMinutes?: number,
): Promise<{ scanned: number; results: TimeoutProcessResult[] }> {
  const bounded = Math.max(1, Math.min(Math.trunc(limit), 100));
  const admin = createAdminClient();
  const now = Date.now();

  const { data: matches, error } = await admin
    .from("game_matches")
    .select("id, public_id, game_slug, mode, status, state, updated_at")
    .in("status", [...TIMEOUT_OPEN_STATUSES])
    .order("updated_at", { ascending: true })
    .limit(bounded * 4);
  if (error || !matches?.length) return { scanned: 0, results: [] };

  const ids = matches.map((match) => match.id);
  const { data: players } = await admin
    .from("game_match_players")
    .select("match_id, player_index, connected, user_id")
    .in("match_id", ids);

  const graceCache = new Map<string, number>();
  const getGrace = async (slug: string) => {
    if (graceCache.has(slug)) return graceCache.get(slug)!;
    const value = await graceMinutesFor(admin, slug);
    graceCache.set(slug, value);
    return value;
  };

  const results: TimeoutProcessResult[] = [];
  let finalised = 0;
  for (const match of matches as CandidateRow[]) {
    if (finalised >= bounded) break;
    const row: CandidateRow = {
      ...match,
      players: (players ?? []).filter((player) => player.match_id === match.id),
    };
    const grace =
      graceOverrideMinutes && graceOverrideMinutes >= 1
        ? graceOverrideMinutes
        : await getGrace(match.game_slug);
    const result = await finalizeCandidate(admin, row, grace, now);
    if (result.status === "finalised") finalised += 1;
    results.push(result);
  }

  return { scanned: results.length, results };
}
