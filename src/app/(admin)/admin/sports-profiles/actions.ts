"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePeAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { achievementReviewSchema, achievementSchema } from "@/lib/validations/phase3";
import type { AchievementInput, AchievementReviewInput } from "@/lib/validations/phase3";
import type { ActionState } from "@/types/domain";

function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Check the form and try again.";
}

function refreshSportsProfiles() {
  revalidatePath("/admin/sports-profiles");
  revalidatePath("/admin/reports");
  revalidatePath("/my-sports-profile");
  revalidatePath("/dashboard");
  revalidatePath("/sports-profile", "layout");
}

/** PE Admin only. The RPC marks new records as admin_record and stores the verifier. */
export async function adminRecordAchievement(
  input: AchievementInput,
): Promise<ActionState & { achievementId?: string }> {
  await requirePeAdmin();
  const parsed = achievementSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: firstIssue(parsed.error) };

  const { id, studentDirectoryId, evidenceFileId, verificationStatus, ...data } = parsed.data;
  if (!studentDirectoryId) {
    return { status: "error", message: "Choose the student this achievement belongs to." };
  }

  const supabase = await createClient();
  const { data: rows, error } = await supabase.rpc("admin_save_achievement", {
    p_achievement_id: id || null,
    p_data: {
      student_directory_id: studentDirectoryId,
      title: data.title,
      sport: data.sport,
      event_name: data.eventName ?? "",
      academic_year: data.academicYear ?? "",
      achievement_date: data.achievementDate ?? "",
      position_result: data.positionResult ?? "",
      award_description: data.awardDescription ?? "",
      evidence_file_id: evidenceFileId ?? "",
      verification_status: verificationStatus ?? "pending",
    },
  });
  if (error) return { status: "error", message: error.message || "The achievement could not be saved." };

  refreshSportsProfiles();
  return {
    status: "success",
    message: id
      ? evidenceFileId
        ? "Evidence attached and achievement updated."
        : "Achievement updated."
      : "Achievement recorded for the student.",
    achievementId: rows?.[0]?.id ?? (id || undefined),
  };
}

/** PE Admin only. Students have no equivalent action and cannot self-verify. */
export async function reviewAchievement(input: AchievementReviewInput): Promise<ActionState> {
  await requirePeAdmin();
  const parsed = achievementReviewSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: firstIssue(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_review_achievement", {
    p_achievement_id: parsed.data.achievementId,
    p_status: parsed.data.status,
    p_note: parsed.data.note ?? null,
  });
  if (error) return { status: "error", message: error.message || "The review could not be recorded." };

  refreshSportsProfiles();
  return { status: "success", message: `Achievement marked ${parsed.data.status}. The student has been notified.` };
}
