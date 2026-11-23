"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePeAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { notifyPhaseUsers } from "@/lib/operations/phase4";
import { invitationSchema } from "@/lib/validations/phase4";
import type { ActionState } from "@/types/domain";

function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Check the form and try again.";
}

function refresh(eventId: string, sportId: string) {
  revalidatePath(`/admin/events/${eventId}/sports/${sportId}/organizers`);
  revalidatePath(`/admin/events/${eventId}`);
  revalidatePath("/organizer");
}

export async function inviteOrganizerAction(input: z.input<typeof invitationSchema>): Promise<
  ActionState & { token?: string; expiresAt?: string }
> {
  await requirePeAdmin();
  const parsed = invitationSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: firstIssue(parsed.error) };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("phase4_create_organizer_invitation", {
    p_competition_id: parsed.data.competitionId,
    p_student_directory_id: parsed.data.studentDirectoryId,
    p_expires_hours: parsed.data.expiresHours,
  });
  if (error) return { status: "error", message: error.message };

  const { data: profile } = await supabase
    .from("profiles").select("id").eq("student_directory_id", parsed.data.studentDirectoryId).maybeSingle();
  if (profile?.id) {
    await notifyPhaseUsers(
      [profile.id],
      "Sports organiser invitation",
      "You have been invited to manage a competition. Open the organiser desk to accept.",
      "future_event",
      "/organizer/invitations",
    );
  }
  const result = data as { token?: string; expiresAt?: string } | null;
  return {
    status: "success",
    message: "Invitation created. Share the one-time link privately with the student.",
    token: result?.token,
    expiresAt: result?.expiresAt,
  };
}

export async function revokeOrganizerAssignmentAction(
  assignmentId: string,
  eventId: string,
  sportId: string,
  reason: string,
): Promise<ActionState> {
  await requirePeAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("phase4_revoke_organizer_assignment", {
    p_assignment_id: assignmentId,
    p_reason: reason || null,
  });
  if (error) return { status: "error", message: error.message };
  refresh(eventId, sportId);
  return { status: "success", message: "Organiser assignment revoked." };
}

export async function revokeOrganizerInvitationAction(
  invitationId: string,
  eventId: string,
  sportId: string,
  reason: string,
): Promise<ActionState> {
  await requirePeAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("phase4_revoke_organizer_invitation", {
    p_invitation_id: invitationId,
    p_reason: reason || null,
  });
  if (error) return { status: "error", message: error.message };
  refresh(eventId, sportId);
  return { status: "success", message: "Organiser invitation revoked." };
}
