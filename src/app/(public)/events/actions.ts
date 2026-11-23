"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  participantInvitationTokenSchema,
  paymentProofSchema,
  registrationSchema,
} from "@/lib/validations/phase4";
import type { ActionState } from "@/types/domain";
import type { Json } from "@/types/database";

function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Check the form and try again.";
}

/** Student registration is always validated and persisted through a security-definer RPC. */
export async function submitRegistrationAction(
  competitionId: string,
  input: z.input<typeof registrationSchema>,
): Promise<ActionState & { entryId?: string }> {
  await requireUser();
  const parsed = registrationSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: firstIssue(parsed.error) };
  const supabase = await createClient();
  const payload = {
    kind: parsed.data.kind,
    teamName: parsed.data.teamName,
    captainUsn: parsed.data.captainUsn,
    contactEmail: parsed.data.contactEmail,
    contactPhone: parsed.data.contactPhone,
    seed: parsed.data.seed ?? null,
    answers: parsed.data.answers,
    members: parsed.data.members,
  } as unknown as Json;
  const { data, error } = await supabase.rpc("phase4_submit_entry", {
    p_competition_id: competitionId,
    p_payload: payload,
  });
  if (error) return { status: "error", message: error.message };
  revalidatePath("/events");
  revalidatePath("/my-events");
  const result = data as { entryId?: string } | null;
  return {
    status: "success",
    message: "Registration submitted for review.",
    entryId: result?.entryId,
  };
}

/** Payment proofs are private; only the RPC can attach a confirmed file to an owned entry. */
export async function submitPaymentProofAction(
  input: z.input<typeof paymentProofSchema>,
): Promise<ActionState> {
  await requireUser();
  const parsed = paymentProofSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: firstIssue(parsed.error) };
  const supabase = await createClient();
  const { error } = await supabase.rpc("phase4_submit_payment_proof", {
    p_entry_id: parsed.data.entryId,
    p_proof_file_id: parsed.data.proofFileId,
    p_transaction_reference: parsed.data.transactionReference || null,
    p_claimed_amount: parsed.data.claimedAmount ?? null,
  });
  if (error) return { status: "error", message: error.message };
  revalidatePath("/my-events");
  revalidatePath("/admin/events/dashboard");
  return { status: "success", message: "Payment proof submitted for verification." };
}

export async function respondParticipantInvitationAction(
  input: z.input<typeof participantInvitationTokenSchema>,
): Promise<ActionState> {
  await requireUser();
  const parsed = participantInvitationTokenSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: firstIssue(parsed.error) };
  const supabase = await createClient();
  const { error } = await supabase.rpc("phase4_respond_participant_invitation", {
    p_token: parsed.data.token,
    p_accept: parsed.data.accept,
  });
  if (error) return { status: "error", message: error.message };
  revalidatePath("/my-events");
  return {
    status: "success",
    message: parsed.data.accept ? "Participation confirmed." : "Participation declined.",
  };
}
