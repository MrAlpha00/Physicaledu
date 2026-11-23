"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePeAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { notifyPhaseUsers } from "@/lib/operations/phase4";
import { memberConfirmationSchema } from "@/lib/validations/phase4";

const reviewSchema = z.object({
  entryId: z.string().uuid(),
  status: z.enum(["submitted", "under_review", "approved", "rejected", "waitlisted", "withdrawn"]),
  note: z.string().trim().max(1000).optional().default(""),
});

const paymentSchema = z.object({
  paymentId: z.string().uuid(),
  status: z.enum(["verified", "rejected", "waived", "refunded", "pending_verification", "not_required"]),
  note: z.string().trim().max(1000).optional().default(""),
});

function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Check the form and try again.";
}

function refresh(eventId: string, competitionId: string) {
  revalidatePath(`/admin/events/${eventId}/sports/${competitionId}/registrations`);
  revalidatePath(`/admin/events/${eventId}/sports/${competitionId}/payments`);
  revalidatePath(`/admin/events/${eventId}/sports/${competitionId}/tournament`);
  revalidatePath("/admin/events/dashboard");
  revalidatePath("/my-events");
}

export async function reviewRegistration(input: z.input<typeof reviewSchema>): Promise<
  { status: "success" | "error"; message: string }
> {
  await requirePeAdmin();
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: firstIssue(parsed.error) };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("phase4_review_entry", {
    p_entry_id: parsed.data.entryId,
    p_status: parsed.data.status,
    p_note: parsed.data.note || null,
  });
  if (error) return { status: "error", message: error.message };
  const payload = data as { status?: string } | null;
  const { data: entry } = await supabase
    .from("competition_entries").select("competition_id").eq("id", parsed.data.entryId).maybeSingle();
  const { data: sport } = entry
    ? await supabase.from("event_sports").select("event_id").eq("id", entry.competition_id).maybeSingle()
    : { data: null };
  if (sport) refresh(sport.event_id, entry!.competition_id);
  return {
    status: "success",
    message: `Registration is now ${(payload?.status ?? parsed.data.status).replaceAll("_", " ")}.`,
  };
}

export async function verifyPaymentAction(input: z.input<typeof paymentSchema>): Promise<
  { status: "success" | "error"; message: string }
> {
  await requirePeAdmin();
  const parsed = paymentSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: firstIssue(parsed.error) };
  const supabase = await createClient();
  const { error } = await supabase.rpc("phase4_verify_payment", {
    p_payment_id: parsed.data.paymentId,
    p_status: parsed.data.status,
    p_note: parsed.data.note || null,
  });
  if (error) return { status: "error", message: error.message };
  const { data: payment } = await supabase
    .from("competition_payment_records").select("entry_id").eq("id", parsed.data.paymentId).maybeSingle();
  if (payment) {
    const { data: entry } = await supabase
      .from("competition_entries").select("competition_id").eq("id", payment.entry_id).maybeSingle();
    const { data: sport } = entry
      ? await supabase.from("event_sports").select("event_id").eq("id", entry.competition_id).maybeSingle()
      : { data: null };
    if (sport && entry) refresh(sport.event_id, entry.competition_id);
  }
  return { status: "success", message: `Payment marked ${parsed.data.status.replaceAll("_", " ")}.` };
}

const editEntrySchema = z.object({
  entryId: z.string().uuid(),
  seed: z.number().int().positive().nullable().optional(),
  teamName: z.string().trim().max(120).nullable().optional(),
  note: z.string().trim().max(500).optional().default("Administrative correction."),
});

export async function editEntryDetails(input: z.input<typeof editEntrySchema>): Promise<
  { status: "success" | "error"; message: string }
> {
  await requirePeAdmin();
  const parsed = editEntrySchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: firstIssue(parsed.error) };
  const supabase = await createClient();
  const { data: entry } = await supabase
    .from("competition_entries").select("competition_id,seed,team_name")
    .eq("id", parsed.data.entryId).maybeSingle();
  if (!entry) return { status: "error", message: "Registration not found." };
  const { data: sport } = await supabase
    .from("event_sports").select("event_id").eq("id", entry.competition_id).maybeSingle();
  const { error } = await supabase.from("competition_entries").update({
    seed: parsed.data.seed ?? null,
    team_name: parsed.data.teamName ?? entry.team_name,
  }).eq("id", parsed.data.entryId);
  if (error) return { status: "error", message: error.message };
  await supabase.from("registration_history").insert({
    entry_id: parsed.data.entryId,
    actor_id: (await requirePeAdmin()).id,
    action: "admin_edited",
    from_status: null,
    to_status: null,
    details: { before: { seed: entry.seed, teamName: entry.team_name }, after: parsed.data, reason: parsed.data.note },
  });
  if (sport) refresh(sport.event_id, entry.competition_id);
  return { status: "success", message: "Registration updated and audited." };
}

export async function confirmEntryMemberAction(
  input: z.input<typeof memberConfirmationSchema>,
): Promise<{ status: "success" | "error"; message: string }> {
  await requirePeAdmin();
  const parsed = memberConfirmationSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: firstIssue(parsed.error) };
  const supabase = await createClient();
  const admin = await requirePeAdmin();
  const { data: member } = await supabase
    .from("competition_entry_members").select("entry_id,confirmation_status,user_id")
    .eq("id", parsed.data.memberId).maybeSingle();
  if (!member) return { status: "error", message: "Participant not found." };
  const { error } = await supabase.from("competition_entry_members").update({
    confirmation_status: parsed.data.status,
    confirmed_at: parsed.data.status === "pending" ? null : new Date().toISOString(),
    verified_by: parsed.data.status === "verified" ? admin.id : null,
    verified_at: parsed.data.status === "verified" ? new Date().toISOString() : null,
  }).eq("id", parsed.data.memberId);
  if (error) return { status: "error", message: error.message };
  const { data: entry } = await supabase
    .from("competition_entries").select("competition_id").eq("id", member.entry_id).maybeSingle();
  const { data: sport } = entry
    ? await supabase.from("event_sports").select("event_id").eq("id", entry.competition_id).maybeSingle()
    : { data: null };
  if (member.user_id) {
    await notifyPhaseUsers(
      [member.user_id],
      "Roster status updated",
      `Your registration roster is now ${parsed.data.status}.`,
      "future_event",
      "/my-events",
    );
  }
  if (sport && entry) refresh(sport.event_id, entry.competition_id);
  return { status: "success", message: `Participant marked ${parsed.data.status}.` };
}
