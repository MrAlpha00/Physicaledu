"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser, requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMatchByPublicId } from "@/lib/data/phase5";
import { applyAuthoritativeAction, participantIndex } from "@/lib/games/match-service";
import { engineFor } from "@/lib/games/registry";
import { broadcastChannelMessage, matchChannelName } from "@/lib/games/realtime";
import type { GameSlug, MatchEnvelope, MatchMode, PlayerIndex } from "@/lib/games/types";
import { awardGameAchievements, notifyGameUsers, recordGameParticipation, writeGameAudit } from "@/lib/operations/phase5";
import {
  challengeSearchSchema,
  createChallengeSchema,
  disputeSchema,
  gameActionSchema,
  gamingProfileSchema,
  reportSchema,
} from "@/lib/validations/phase5";
import type { Json } from "@/types/database";

export interface ActionState {
  ok: boolean;
  message: string;
  fieldErrors?: Record<string, string[]>;
  publicId?: string;
}

function fail(message: string, fieldErrors?: Record<string, string[]>): ActionState {
  return { ok: false, message, fieldErrors };
}

function jsonRecord(value: unknown): Record<string, Json> {
  const cleaned = JSON.parse(JSON.stringify(value ?? {})) as Record<string, unknown>;
  const result: Record<string, Json> = {};
  for (const [key, item] of Object.entries(cleaned)) {
    result[key] = item as Json;
  }
  return result;
}

function toEnvelope(view: NonNullable<Awaited<ReturnType<typeof getMatchByPublicId>>>): MatchEnvelope {
  return {
    id: view.id,
    slug: view.game_slug as GameSlug,
    mode: view.mode as MatchMode,
    status: view.status,
    version: view.version,
    config: jsonRecord(view.config),
    players: [...view.players]
      .sort((a, b) => a.player_index - b.player_index)
      .map((player) => ({
        index: player.player_index as PlayerIndex,
        userId: player.user_id,
        displayName: player.display_name,
        ready: player.ready,
        connected: player.connected,
        ratingBefore: player.rating_before,
        ratingAfter: player.rating_after,
        ratingDelta: player.rating_delta,
      })),
    state: view.state,
    createdAt: view.created_at,
    updatedAt: view.updated_at,
    challengeId: view.challenge_id,
  };
}

function revalidateGamePaths(publicId?: string, slug?: GameSlug) {
  revalidatePath("/games/dashboard");
  revalidatePath("/games/challenges");
  revalidatePath("/games/history");
  if (publicId) revalidatePath(`/games/match/${publicId}`);
  if (slug) {
    revalidatePath(`/games/${slug}/leaderboard`);
    revalidatePath(`/games/${slug}`);
  }
}

export async function saveGamingProfileAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = gamingProfileSchema.safeParse({
    gamingName: formData.get("gamingName"),
    visibility: formData.get("visibility"),
    searchable: formData.get("searchable") === "on",
    challengesEnabled: formData.get("challengesEnabled") === "on",
    bio: formData.get("bio") ?? "",
  });
  if (!parsed.success) return fail("Check your gaming profile details.", parsed.error.flatten().fieldErrors as Record<string, string[]>);

  const supabase = await createClient();
  const hasProfile = await supabase.from("gaming_profiles").select("user_id").eq("user_id", user.id).maybeSingle();
  const { error } = hasProfile.data
    ? await supabase.rpc("phase5_update_profile", {
        p_gaming_name: parsed.data.gamingName,
        p_visibility: parsed.data.visibility,
        p_searchable: parsed.data.searchable,
        p_challenges_enabled: parsed.data.challengesEnabled,
        p_bio: parsed.data.bio,
      })
    : await supabase.rpc("phase5_ensure_profile", { p_gaming_name: parsed.data.gamingName });
  if (error) return fail(error.message);

  revalidatePath("/games/profile");
  revalidatePath("/games/dashboard");
  return { ok: true, message: "Gaming profile saved." };
}

export async function searchOpponentsAction(query: string): Promise<{ ok: boolean; results: Array<{ userId: string; gamingName: string; departmentName: string | null }>; message?: string }> {
  await requireUser();
  const parsed = challengeSearchSchema.safeParse({ query });
  if (!parsed.success) return { ok: false, results: [], message: parsed.error.issues[0]?.message };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("phase5_search_profiles", { p_query: parsed.data.query });
  if (error) return { ok: false, results: [], message: error.message };
  return {
    ok: true,
    results: (data ?? []).map((row) => ({
      userId: row.user_id,
      gamingName: row.gaming_name,
      departmentName: row.department_name,
    })),
  };
}

export async function createChallengeAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const parsed = createChallengeSchema.safeParse({
    gameSlug: formData.get("gameSlug"),
    opponentId: formData.get("opponentId"),
    message: formData.get("message") ?? "",
    settings: {},
    timeControl: formData.get("timeControl") || undefined,
  });
  if (!parsed.success) return fail("Check the invitation details.", parsed.error.flatten().fieldErrors as Record<string, string[]>);

  const settings = parsed.data.timeControl ? { config: { timeControl: parsed.data.timeControl } } : {};
  const supabase = await createClient();
  const { error } = await supabase.rpc("phase5_create_challenge", {
    p_game_slug: parsed.data.gameSlug,
    p_opponent_id: parsed.data.opponentId,
    p_settings: settings as Json,
    p_message: parsed.data.message,
  });
  if (error) return fail(error.message);
  revalidateGamePaths(undefined, parsed.data.gameSlug as GameSlug);
  return { ok: true, message: "Invitation sent." };
}

export async function respondChallengeAction(challengeId: string, accept: boolean): Promise<ActionState> {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("phase5_respond_challenge", {
    p_challenge_id: challengeId,
    p_accept: accept,
  });
  if (error) return fail(error.message);
  const record = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  revalidateGamePaths();
  return {
    ok: true,
    message: accept ? "Invitation accepted — your match room is ready." : "Invitation declined.",
    publicId: typeof record.publicId === "string" ? record.publicId : undefined,
  };
}

export async function cancelChallengeAction(challengeId: string): Promise<ActionState> {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.rpc("phase5_cancel_challenge", { p_challenge_id: challengeId });
  if (error) return fail(error.message);
  revalidateGamePaths();
  return { ok: true, message: "Invitation cancelled." };
}

export async function setReadyAction(publicId: string, ready: boolean): Promise<ActionState> {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.rpc("phase5_set_ready", { p_public_id: publicId, p_ready: ready });
  if (error) return fail(error.message);
  revalidateGamePaths(publicId);
  return { ok: true, message: ready ? "You are ready." : "Readiness withdrawn." };
}

export async function setConnectionAction(publicId: string, connected: boolean): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  const supabase = await createClient();
  await supabase.rpc("phase5_set_connection", { p_public_id: publicId, p_connected: connected });
}

export async function startMatchAction(publicId: string): Promise<ActionState> {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.rpc("phase5_start_match", { p_public_id: publicId });
  if (error) return fail(error.message);
  revalidateGamePaths(publicId);
  return { ok: true, message: "Match started." };
}

export interface SubmitActionResult {
  ok: boolean;
  error?: string;
  state?: Json;
  events?: Array<{ type: string; message: string }>;
  outcome?: Json | null;
}

/**
 * Every competitive move enters here. The browser supplies an intent only; the
 * pure engine decides the next state and the service-role RPC persists it.
 */
export async function submitMatchAction(publicId: string, raw: unknown): Promise<SubmitActionResult> {
  const user = await requireUser();
  const parsed = gameActionSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Malformed action." };

  const view = await getMatchByPublicId(publicId);
  if (!view) return { ok: false, error: "Match not found." };
  const envelope = toEnvelope(view);
  const action = {
    seq: parsed.data.seq,
    expectedVersion: parsed.data.expectedVersion,
    actor: parsed.data.actor,
    type: parsed.data.type,
    payload: jsonRecord(parsed.data.payload),
  };

  const result = applyAuthoritativeAction(envelope, action, { userId: user.id });
  if (!result.ok || !result.match) return { ok: false, error: result.error ?? "Action rejected." };

  const admin = createAdminClient();
  const outcomeJson = result.outcome ? (result.outcome as unknown as Json) : null;
  const { error } = await admin.rpc("phase5_submit_action", {
    p_public_id: publicId,
    p_user_id: user.id,
    p_actor: action.actor,
    p_seq: action.seq,
    p_expected_version: action.expectedVersion,
    p_type: action.type,
    p_payload: action.payload,
    p_state: result.match.state,
    p_events: (result.events ?? []) as unknown as Json,
    p_outcome: outcomeJson,
  });
  if (error) return { ok: false, error: error.message };

  if (outcomeJson) {
    const refreshed = await getMatchByPublicId(publicId);
    if (refreshed) {
      await awardGameAchievements(refreshed, result.outcome ?? null);
      await recordGameParticipation(refreshed);
      const other = refreshed.players.find((player) => player.user_id && player.user_id !== user.id)?.user_id;
      if (other) await notifyGameUsers([other], "Match finished", `Your ${refreshed.game_slug} match has been completed.`, `/games/match/${publicId}`);
    }
  }

  await broadcastChannelMessage(matchChannelName(publicId), {
    type: outcomeJson ? "complete" : "state",
    matchId: publicId,
    payload: { version: result.match.version, outcome: outcomeJson },
  }).catch(() => undefined);

  revalidateGamePaths(publicId, envelope.slug);
  return {
    ok: true,
    state: result.match.state,
    events: result.events,
    outcome: outcomeJson,
  };
}

export async function resignAction(publicId: string): Promise<ActionState> {
  const user = await requireUser();
  const view = await getMatchByPublicId(publicId);
  if (!view) return fail("Match not found.");
  const envelope = toEnvelope(view);
  const actor = participantIndex(envelope, user.id);
  if (actor === null) return fail("You are not a participant in this match.");
  const engine = engineFor(envelope.slug);
  const state = engine.fromJson(envelope.state);
  const response = await submitMatchAction(publicId, {
    seq: state.seq + 1,
    expectedVersion: state.version,
    actor,
    type: "resign",
    payload: {},
  });
  return response.ok
    ? { ok: true, message: "You resigned from the match." }
    : fail(response.error ?? "Resignation failed.");
}

export async function requestRematchAction(publicId: string): Promise<ActionState> {
  const user = await requireUser();
  const view = await getMatchByPublicId(publicId);
  if (!view || view.status !== "completed") return fail("Only a completed match can be rematched.");
  if (!view.players.some((player) => player.user_id === user.id)) return fail("You are not a participant in this match.");

  const admin = createAdminClient();
  const publicIdNew = Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
  const { data: created, error } = await admin.from("game_matches").insert({
    public_id: publicIdNew,
    game_slug: view.game_slug,
    mode: view.mode,
    status: "waiting",
    config: view.config,
    state: {},
    created_by: user.id,
  }).select("id").single();
  if (error || !created) return fail(error?.message ?? "Could not create the rematch.");

  const playerRows = view.players.map((player) => ({
    match_id: created.id,
    player_index: player.player_index,
    user_id: player.user_id,
    display_name: player.display_name,
  }));
  const { error: playerError } = await admin.from("game_match_players").insert(playerRows);
  if (playerError) return fail(playerError.message);

  const engine = engineFor(view.game_slug as GameSlug);
  const config = jsonRecord(view.config);
  const initialState = engine.toJson(engine.create(config));
  await admin.from("game_matches").update({ state: initialState, version: 1, server_seq: 0 }).eq("id", created.id);

  const other = view.players.find((player) => player.user_id && player.user_id !== user.id)?.user_id;
  if (other) await notifyGameUsers([other], "Rematch requested", "A rematch is ready in your games dashboard.", `/games/match/${publicIdNew}`);
  await writeGameAudit("phase5_rematch_created", "game_matches", created.id, { fromMatch: view.id });
  revalidateGamePaths(publicIdNew, view.game_slug as GameSlug);
  return { ok: true, message: "Rematch created.", publicId: publicIdNew };
}

export async function submitReportAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = reportSchema.safeParse({
    reportedUserId: formData.get("reportedUserId") || null,
    matchId: formData.get("matchId") || null,
    gameSlug: formData.get("gameSlug") || null,
    reason: formData.get("reason"),
    details: formData.get("details"),
  });
  if (!parsed.success) return fail("Check the report details.", parsed.error.flatten().fieldErrors as Record<string, string[]>);
  const supabase = await createClient();
  const { error } = await supabase.from("game_reports").insert({
    reporter_id: user.id,
    reported_user_id: parsed.data.reportedUserId,
    match_id: parsed.data.matchId,
    game_slug: parsed.data.gameSlug,
    reason: parsed.data.reason,
    details: parsed.data.details,
  });
  if (error) return fail(error.message);
  revalidatePath("/games/dashboard");
  return { ok: true, message: "Report submitted for review." };
}

export async function submitDisputeAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const parsed = disputeSchema.safeParse({
    publicId: formData.get("publicId"),
    reason: formData.get("reason"),
    details: formData.get("details") ?? "",
  });
  if (!parsed.success) return fail("Check the dispute details.", parsed.error.flatten().fieldErrors as Record<string, string[]>);
  const supabase = await createClient();
  const { error } = await supabase.rpc("phase5_open_dispute", {
    p_public_id: parsed.data.publicId,
    p_reason: parsed.data.reason,
    p_details: parsed.data.details,
  });
  if (error) return fail(error.message);
  revalidateGamePaths(parsed.data.publicId);
  return { ok: true, message: "Dispute opened. Ratings are frozen pending review." };
}

export async function cleanupGuestSessionsAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.rpc("phase5_cleanup_guest_sessions");
}
