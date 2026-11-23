"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePeAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { syncEventToCalendar } from "@/lib/operations/phase4";
import {
  competitionRulesSchema,
  eligibilityRuleSchema,
  eventSchema,
  eventStatusSchema,
  paymentSettingsSchema,
  sportSchema,
} from "@/lib/validations/phase4";
import type { ActionState } from "@/types/domain";
import type { Json } from "@/types/database";

function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Check the form and try again.";
}

function refreshEvents(eventId?: string) {
  revalidatePath("/admin/events");
  revalidatePath("/admin/events/dashboard");
  revalidatePath("/events");
  if (eventId) {
    revalidatePath(`/admin/events/${eventId}`);
    revalidatePath(`/admin/events/${eventId}/sports`);
  }
}

export async function saveEvent(input: z.input<typeof eventSchema>): Promise<
  ActionState & { eventId?: string }
> {
  await requirePeAdmin();
  const parsed = eventSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: firstIssue(parsed.error) };
  const data = parsed.data;
  const supabase = await createClient();
  const payload = {
    name: data.name,
    slug: data.slug,
    description: data.description || null,
    academic_year: data.academicYear,
    starts_on: data.startsOn || null,
    ends_on: data.endsOn || null,
    registration_opens_at: data.registrationOpensAt || null,
    registration_closes_at: data.registrationClosesAt || null,
    venue: data.venue || null,
    instructions: data.instructions || null,
    contact_information: data.contactInformation || null,
    is_public: data.isPublic,
    status: data.status,
    ...(data.bannerFileId ? { banner_file_id: data.bannerFileId } : {}),
    ...(data.logoFileId ? { logo_file_id: data.logoFileId } : {}),
  };
  const { data: saved, error } = data.id
    ? await supabase.from("sports_events").update(payload).eq("id", data.id).select("id").maybeSingle()
    : await supabase.from("sports_events").insert(payload).select("id").maybeSingle();
  if (error) return { status: "error", message: error.message || "Event could not be saved." };
  const eventId = saved?.id ?? data.id ?? "";
  const { data: event } = await supabase.from("sports_events").select("*").eq("id", eventId).maybeSingle();
  if (event) await syncEventToCalendar(event);
  refreshEvents(eventId);
  return { status: "success", message: data.id ? "Event updated." : "Event created.", eventId };
}

export async function setEventStatus(eventId: string, status: string): Promise<ActionState> {
  await requirePeAdmin();
  const parsed = eventStatusSchema.safeParse(status);
  if (!parsed.success) return { status: "error", message: "Unsupported event status." };
  const supabase = await createClient();
  const { error } = await supabase.from("sports_events").update({ status: parsed.data }).eq("id", eventId);
  if (error) return { status: "error", message: error.message };
  const { data: event } = await supabase.from("sports_events").select("*").eq("id", eventId).maybeSingle();
  if (event) await syncEventToCalendar(event);
  refreshEvents(eventId);
  return { status: "success", message: `Event marked ${status.replaceAll("_", " ")}.` };
}

export async function saveSport(input: z.input<typeof sportSchema>): Promise<
  ActionState & { sportId?: string }
> {
  await requirePeAdmin();
  const parsed = sportSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: firstIssue(parsed.error) };
  const data = parsed.data;
  const supabase = await createClient();
  const payload = {
    event_id: data.eventId,
    name: data.name,
    slug: data.slug,
    description: data.description || null,
    category: data.category || null,
    mode: data.mode,
    venue: data.venue || null,
    registration_start: data.registrationStart || null,
    registration_deadline: data.registrationDeadline || null,
    competition_date: data.competitionDate || null,
    max_entries: data.maxEntries ?? null,
    is_public: data.isPublic,
    status: data.status,
    scoring_mode: data.scoringMode,
    tournament_format: data.tournamentFormat,
    draw_mode: data.drawMode,
    third_place: data.thirdPlace,
    group_count: data.groupCount ?? null,
    qualifiers_per_group: data.qualifiersPerGroup ?? null,
    legs: data.legs,
    points: {
      win: data.pointsWin,
      draw: data.pointsDraw,
      loss: data.pointsLoss,
      tiebreakers: data.tiebreakers,
    } as unknown as Json,
    auto_advance: data.autoAdvance,
    organizer_results_require_approval: data.organizerResultsRequireApproval,
    ...(data.imageFileId ? { image_file_id: data.imageFileId } : {}),
  };
  const { data: saved, error } = data.id
    ? await supabase.from("event_sports").update(payload).eq("id", data.id).select("id").maybeSingle()
    : await supabase.from("event_sports").insert(payload).select("id").maybeSingle();
  if (error) return { status: "error", message: error.message || "Competition could not be saved." };
  const sportId = saved?.id ?? data.id ?? "";
  if (!data.id) {
    await supabase.from("competition_rules").insert({
      competition_id: sportId,
      team_name_required: data.mode === "team",
      min_team_size: data.mode === "team" ? 7 : null,
      max_team_size: data.mode === "team" ? 10 : null,
      public_rules: data.publicRules || null,
    });
    await supabase.from("competition_payment_settings").insert({ competition_id: sportId });
  } else {
    await supabase.from("competition_rules").update({ public_rules: data.publicRules || null })
      .eq("competition_id", sportId);
  }
  refreshEvents(data.eventId);
  revalidatePath(`/admin/events/${data.eventId}/sports/${sportId}`);
  revalidatePath(`/events`);
  return { status: "success", message: data.id ? "Competition updated." : "Competition added.", sportId };
}

export async function saveCompetitionRules(input: z.input<typeof competitionRulesSchema>): Promise<ActionState> {
  await requirePeAdmin();
  const parsed = competitionRulesSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: firstIssue(parsed.error) };
  const data = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from("competition_rules").upsert({
    competition_id: data.competitionId,
    team_name_required: data.teamNameRequired,
    min_team_size: data.minTeamSize ?? null,
    max_team_size: data.maxTeamSize ?? null,
    team_limit: data.teamLimit ?? null,
    captain_required: data.captainRequired,
    substitute_allowance: data.substituteAllowance,
    allow_multiple_competitions: data.allowMultipleCompetitions,
    allow_duplicate_player_other_team: data.allowDuplicatePlayerOtherTeam,
    require_member_confirmation: data.requireMemberConfirmation,
    require_manual_identity_verification: data.requireManualIdentityVerification,
    required_participant_fields: data.requiredParticipantFields,
    custom_questions: data.customQuestions as unknown as Json,
    public_rules: data.publicRules || null,
    eligibility_summary: data.eligibilitySummary || null,
  });
  if (error) return { status: "error", message: error.message };
  revalidatePath(`/admin/events/${data.competitionId}`);
  return { status: "success", message: "Registration rules saved." };
}

export async function saveEligibilityRule(input: z.input<typeof eligibilityRuleSchema>): Promise<ActionState> {
  await requirePeAdmin();
  const parsed = eligibilityRuleSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: firstIssue(parsed.error) };
  const data = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from("competition_eligibility_rules").insert({
    competition_id: data.competitionId,
    rule_type: data.ruleType,
    rule_value: data.ruleValue as unknown as Json,
    description: data.description || null,
  });
  if (error) return { status: "error", message: error.message };
  revalidatePath(`/admin/events/${data.competitionId}`);
  return { status: "success", message: "Eligibility rule added." };
}

export async function removeEligibilityRule(ruleId: string, competitionId: string): Promise<ActionState> {
  await requirePeAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("competition_eligibility_rules").delete().eq("id", ruleId);
  if (error) return { status: "error", message: error.message };
  revalidatePath(`/admin/events/${competitionId}`);
  return { status: "success", message: "Eligibility rule removed." };
}

export async function savePaymentSettings(input: z.input<typeof paymentSettingsSchema>): Promise<ActionState> {
  await requirePeAdmin();
  const parsed = paymentSettingsSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: firstIssue(parsed.error) };
  const data = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from("competition_payment_settings").upsert({
    competition_id: data.competitionId,
    is_required: data.isRequired,
    fee_amount: data.feeAmount ?? null,
    payment_unit: data.paymentUnit,
    instructions: data.instructions || null,
    payment_deadline: data.paymentDeadline || null,
    ...(data.qrFileId ? { qr_file_id: data.qrFileId } : {}),
  });
  if (error) return { status: "error", message: error.message };
  revalidatePath(`/admin/events/${data.competitionId}`);
  revalidatePath(`/events`);
  return { status: "success", message: "Payment settings saved." };
}
