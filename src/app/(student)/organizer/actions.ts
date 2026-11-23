"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isCurrentUserPeAdmin, requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { recordFinalWinnerAchievements } from "@/lib/operations/phase4";
import {
  invitationTokenSchema,
  organizerMatchUpdateSchema,
  resultSchema,
} from "@/lib/validations/phase4";
import type { ActionState } from "@/types/domain";
import type { Json } from "@/types/database";

function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Check the form and try again.";
}

function refresh(eventId?: string, sportId?: string) {
  revalidatePath("/organizer");
  revalidatePath("/my-events");
  revalidatePath("/events");
  if (eventId && sportId) {
    revalidatePath(`/admin/events/${eventId}/sports/${sportId}/matches`);
    revalidatePath(`/admin/events/${eventId}/sports/${sportId}/registrations`);
  }
}

async function loadMatchContext(matchId: string): Promise<{
  eventId: string;
  sportId: string;
  requireApproval: boolean;
} | null> {
  const supabase = await createClient();
  const { data: match } = await supabase
    .from("tournament_matches").select("draw_id").eq("id", matchId).maybeSingle();
  if (!match) return null;
  const { data: draw } = await supabase
    .from("tournament_draws").select("competition_id").eq("id", match.draw_id).maybeSingle();
  if (!draw) return null;
  const { data: sport } = await supabase
    .from("event_sports").select("event_id,organizer_results_require_approval")
    .eq("id", draw.competition_id).maybeSingle();
  if (!sport) return null;
  return {
    eventId: sport.event_id,
    sportId: draw.competition_id,
    requireApproval: sport.organizer_results_require_approval && !(await isCurrentUserPeAdmin()),
  };
}

export async function acceptOrganizerInvitationAction(token: string): Promise<ActionState> {
  await requireUser();
  const parsed = invitationTokenSchema.safeParse({ token });
  if (!parsed.success) return { status: "error", message: firstIssue(parsed.error) };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("phase4_accept_organizer_invitation", {
    p_token: parsed.data.token,
  });
  if (error) return { status: "error", message: error.message };
  refresh();
  const result = data as { competitionId?: string } | null;
  return {
    status: "success",
    message: result?.competitionId ? "You are now assigned to this sport." : "Invitation accepted.",
  };
}

export async function submitOrganizerResultAction(
  input: z.input<typeof resultSchema>,
): Promise<ActionState> {
  await requireUser();
  const parsed = resultSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: firstIssue(parsed.error) };
  const context = await loadMatchContext(parsed.data.matchId);
  if (!context) return { status: "error", message: "Match context could not be loaded." };
  const supabase = await createClient();
  const result = {
    scoreA: parsed.data.scoreA ? Number(parsed.data.scoreA) : null,
    scoreB: parsed.data.scoreB ? Number(parsed.data.scoreB) : null,
    winnerEntryId: parsed.data.winnerEntryId,
    notes: parsed.data.notes,
    breakdown: parsed.data.breakdown,
  } as unknown as Json;
  const { error } = await supabase.rpc("phase4_submit_match_result", {
    p_match_id: parsed.data.matchId,
    p_result: result,
    p_require_approval: context.requireApproval,
  });
  if (error) return { status: "error", message: error.message };
  if (!context.requireApproval) await recordFinalWinnerAchievements(parsed.data.matchId);
  refresh(context.eventId, context.sportId);
  return {
    status: "success",
    message: context.requireApproval
      ? "Result submitted and awaiting PE Admin approval."
      : "Result confirmed and bracket advanced.",
  };
}

export async function setOrganizerMatchStatusAction(
  input: z.input<typeof organizerMatchUpdateSchema>,
): Promise<ActionState> {
  await requireUser();
  const parsed = organizerMatchUpdateSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: firstIssue(parsed.error) };
  const context = await loadMatchContext(parsed.data.matchId);
  if (!context) return { status: "error", message: "Match context could not be loaded." };
  const data: Record<string, string | null> = { status: parsed.data.status };
  if (parsed.data.venue !== undefined) data.venue = parsed.data.venue || null;
  if (parsed.data.notes !== undefined) data.notes = parsed.data.notes || null;
  const supabase = await createClient();
  const { error } = await supabase.rpc("phase4_organizer_update_match", {
    p_match_id: parsed.data.matchId,
    p_data: data as unknown as Json,
  });
  if (error) return { status: "error", message: error.message };
  refresh(context.eventId, context.sportId);
  return { status: "success", message: `Match marked ${parsed.data.status.replaceAll("_", " ")}.` };
}
