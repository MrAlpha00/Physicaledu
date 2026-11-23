"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePeAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { generateManualKnockout, generateTournament } from "@/lib/tournament/engine";
import { validateTournamentGraph } from "@/lib/tournament/graph";
import { recordWinnerAchievements, syncMatchToCalendar } from "@/lib/operations/phase4";
import { drawSchema, matchScheduleSchema, resultSchema } from "@/lib/validations/phase4";
import type { PointsConfig, TournamentPlan } from "@/lib/tournament/types";
import type { Json } from "@/types/database";

function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Check the form and try again.";
}

function refresh(eventId: string, sportId: string) {
  revalidatePath(`/admin/events/${eventId}/sports/${sportId}/tournament`);
  revalidatePath(`/admin/events/${eventId}/sports/${sportId}/matches`);
  revalidatePath(`/admin/events/${eventId}/sports/${sportId}/registrations`);
  revalidatePath(`/events`);
}

async function loadGenerationContext(sportId: string) {
  const supabase = await createClient();
  const [{ data: sport }, { data: payment }, { data: entries }] = await Promise.all([
    supabase.from("event_sports").select("*").eq("id", sportId).maybeSingle(),
    supabase.from("competition_payment_settings").select("*").eq("competition_id", sportId).maybeSingle(),
    supabase.from("competition_entries").select("*").eq("competition_id", sportId).eq("status", "approved"),
  ]);
  if (!sport) return null;
  const eligible = (entries ?? []).filter((entry) =>
    !payment?.is_required || ["verified", "waived", "refunded", "not_required"].includes(entry.payment_status));
  return {
    supabase,
    sport,
    payment,
    entries: eligible.map((entry) => ({
      entryId: entry.id,
      label: entry.team_name ?? `Competitor ${entry.id.slice(0, 6)}`,
      seed: entry.seed,
    })),
  };
}

async function persistPlan(
  sportId: string,
  eventId: string,
  plan: TournamentPlan,
  reason: string | null,
): Promise<{ status: "success" | "error"; message: string }> {
  const validation = validateTournamentGraph(plan);
  if (!validation.valid) {
    return { status: "error", message: `Draw validation failed: ${validation.errors[0]}` };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("phase4_save_draw", {
    p_competition_id: sportId,
    p_plan: plan as unknown as Json,
    p_reason: reason || null,
  });
  if (error) return { status: "error", message: error.message };
  refresh(eventId, sportId);
  const payload = data as { matchCount?: number; version?: number } | null;
  return {
    status: "success",
    message: `Tournament generated (${payload?.matchCount ?? plan.matches.length} matches, version ${payload?.version ?? 1}).`,
  };
}

export async function generateTournamentAction(input: z.input<typeof drawSchema>): Promise<
  { status: "success" | "error"; message: string }
> {
  await requirePeAdmin();
  const parsed = drawSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: firstIssue(parsed.error) };
  const context = await loadGenerationContext(parsed.data.competitionId);
  if (!context) return { status: "error", message: "Competition not found." };
  if (!context.entries.length) {
    return { status: "error", message: "Approve entries (and payments where required) before generating a draw." };
  }

  try {
    const plan = generateTournament({
      format: context.sport.tournament_format,
      drawMode: context.sport.draw_mode,
      drawSeed: parsed.data.drawSeed ?? Math.floor(Math.random() * 2_000_000_000),
      entries: context.entries,
      thirdPlace: parsed.data.thirdPlace ?? context.sport.third_place,
      groupCount: context.sport.group_count ?? undefined,
      qualifiersPerGroup: context.sport.qualifiers_per_group ?? undefined,
      legs: context.sport.legs,
      points: context.sport.points as PointsConfig,
      version: 1,
    });
    return await persistPlan(parsed.data.competitionId, context.sport.event_id, plan, parsed.data.reason ?? null);
  } catch (caught) {
    return { status: "error", message: caught instanceof Error ? caught.message : "Draw generation failed." };
  }
}

const manualDrawSchema = z.object({
  eventId: z.string().uuid(),
  sportId: z.string().uuid(),
  pairings: z.array(z.tuple([z.string().uuid().nullable(), z.string().uuid().nullable()])).min(1),
  reason: z.string().trim().max(1000).optional().default(""),
});

export async function saveManualPairings(input: z.input<typeof manualDrawSchema>): Promise<
  { status: "success" | "error"; message: string }
> {
  await requirePeAdmin();
  const parsed = manualDrawSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: firstIssue(parsed.error) };
  const context = await loadGenerationContext(parsed.data.sportId);
  if (!context) return { status: "error", message: "Competition not found." };
  try {
    const plan = generateManualKnockout(context.entries, parsed.data.pairings, {
      format: "knockout",
      entries: context.entries,
      drawSeed: 0,
      points: context.sport.points as PointsConfig,
      thirdPlace: context.sport.third_place,
    });
    return await persistPlan(parsed.data.sportId, parsed.data.eventId, plan, parsed.data.reason || null);
  } catch (caught) {
    return { status: "error", message: caught instanceof Error ? caught.message : "Manual pairing failed." };
  }
}

export async function saveCanvasPositions(
  drawId: string,
  eventId: string,
  sportId: string,
  positions: Record<string, { x: number; y: number }>,
): Promise<{ status: "success" | "error"; message: string }> {
  await requirePeAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("phase4_save_node_positions", {
    p_draw_id: drawId,
    p_positions: positions as unknown as Json,
  });
  if (error) return { status: "error", message: error.message };
  refresh(eventId, sportId);
  return { status: "success", message: "Canvas layout saved (pairings unchanged)." };
}

export async function setBracketLock(
  drawId: string,
  locked: boolean,
  reason: string,
  eventId: string,
  sportId: string,
): Promise<{ status: "success" | "error"; message: string }> {
  await requirePeAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("phase4_set_draw_lock", {
    p_draw_id: drawId, p_locked: locked, p_reason: reason || null,
  });
  if (error) return { status: "error", message: error.message };
  refresh(eventId, sportId);
  return { status: "success", message: locked ? "Bracket locked." : "Bracket unlocked." };
}

export async function updateMatchAction(input: z.input<typeof matchScheduleSchema>): Promise<
  { status: "success" | "error"; message: string }
> {
  await requirePeAdmin();
  const parsed = matchScheduleSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: firstIssue(parsed.error) };
  const supabase = await createClient();
  const { data: match } = await supabase
    .from("tournament_matches").select("*").eq("id", parsed.data.matchId).maybeSingle();
  if (!match) return { status: "error", message: "Match not found." };
  const { data: draw } = await supabase
    .from("tournament_draws").select("competition_id").eq("id", match.draw_id).maybeSingle();
  const { data: sport } = draw
    ? await supabase.from("event_sports").select("event_id").eq("id", draw.competition_id).maybeSingle()
    : { data: null };

  const data: Record<string, string | null> = {};
  if (parsed.data.startsAt !== undefined) data.startsAt = parsed.data.startsAt ?? null;
  if (parsed.data.endsAt !== undefined) data.endsAt = parsed.data.endsAt ?? null;
  if (parsed.data.venue !== undefined) data.venue = parsed.data.venue ?? null;
  if (parsed.data.status !== undefined) data.status = parsed.data.status ?? null;
  if (parsed.data.organizerId !== undefined) data.organizerId = parsed.data.organizerId ?? null;
  if (parsed.data.notes !== undefined) data.notes = parsed.data.notes ?? null;
  if (parsed.data.calendarEventId !== undefined) data.calendarEventId = parsed.data.calendarEventId ?? null;

  const { error } = await supabase.rpc("phase4_admin_update_match", {
    p_match_id: parsed.data.matchId,
    p_data: data as unknown as Json,
    p_reason: parsed.data.reason || null,
  });
  if (error) return { status: "error", message: error.message };

  if (sport && draw) {
    const { data: refreshed } = await supabase
      .from("tournament_matches").select("*").eq("id", parsed.data.matchId).maybeSingle();
    const { data: event } = await supabase
      .from("sports_events").select("*").eq("id", sport.event_id).maybeSingle();
    const { data: sportRow } = await supabase
      .from("event_sports").select("*").eq("id", draw.competition_id).maybeSingle();
    if (refreshed && event && sportRow) await syncMatchToCalendar(refreshed, event, sportRow);
    refresh(sport.event_id, draw.competition_id);
  }
  return { status: "success", message: "Match updated." };
}

export async function correctResultAction(
  matchId: string,
  result: { scoreA: string; scoreB: string; winnerEntryId: string; notes: string; breakdown: unknown[] },
  reason: string,
  eventId: string,
  sportId: string,
): Promise<{ status: "success" | "error"; message: string }> {
  await requirePeAdmin();
  const parsed = resultSchema.safeParse({ matchId, ...result });
  if (!parsed.success) return { status: "error", message: firstIssue(parsed.error) };
  if (!reason.trim()) return { status: "error", message: "A correction reason is required." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("phase4_correct_match_result", {
    p_match_id: matchId,
    p_result: {
      scoreA: parsed.data.scoreA ? Number(parsed.data.scoreA) : null,
      scoreB: parsed.data.scoreB ? Number(parsed.data.scoreB) : null,
      winnerEntryId: parsed.data.winnerEntryId,
      notes: parsed.data.notes,
      breakdown: parsed.data.breakdown,
    } as unknown as Json,
    p_reason: reason,
  });
  if (error) return { status: "error", message: error.message };
  await maybeRecordFinalAchievement(matchId);
  refresh(eventId, sportId);
  return { status: "success", message: "Result corrected and advancement updated." };
}

async function maybeRecordFinalAchievement(matchId: string): Promise<void> {
  const supabase = await createClient();
  const { data: match } = await supabase.from("tournament_matches").select("*").eq("id", matchId).maybeSingle();
  if (!match?.winner_entry_id || match.round_name !== "Final") return;
  const { data: sport } = await supabase
    .from("event_sports").select("*").eq("id", match.competition_id).maybeSingle();
  if (!sport) return;
  const [{ data: entry }, { data: event }] = await Promise.all([
    supabase.from("competition_entries").select("*").eq("id", match.winner_entry_id).maybeSingle(),
    supabase.from("sports_events").select("*").eq("id", sport.event_id).maybeSingle(),
  ]);
  if (entry && event) {
    await recordWinnerAchievements(entry, event, sport, matchId);
  }
}
