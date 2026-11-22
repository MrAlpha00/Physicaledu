"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { achievementSchema, sportsProfileSchema } from "@/lib/validations/phase3";
import type { AchievementInput, SportsProfileInput } from "@/lib/validations/phase3";
import type { ActionState } from "@/types/domain";

function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Check the form and try again.";
}

function refreshStudentProfile() {
  revalidatePath("/my-sports-profile");
  revalidatePath("/sports-profile", "layout");
  revalidatePath("/admin/sports-profiles");
  revalidatePath("/admin/reports");
}

export async function saveSportsProfile(input: SportsProfileInput): Promise<ActionState> {
  const user = await requireUser();
  const parsed = sportsProfileSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: firstIssue(parsed.error) };

  const data = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("student_save_sports_profile", {
    p_data: {
      biography: data.biography ?? "",
      sports_interests: data.sportsInterests,
      preferred_sports: data.preferredSports,
      profile_photo_file_id: data.profilePhotoFileId ?? "",
      // Explicit boolean: a missing or false value leaves the profile private.
      is_public: data.isPublic === true,
    },
  });
  if (error) return { status: "error", message: error.message || "Your profile could not be saved." };

  refreshStudentProfile();
  return {
    status: "success",
    message: data.isPublic
      ? "Profile saved. Your public sports profile is now visible in the student directory."
      : "Profile saved. Your sports profile remains private.",
  };
}

/** Suggestions never carry a verification status; PE Admin decides later. */
export async function suggestAchievement(
  input: AchievementInput,
): Promise<ActionState & { achievementId?: string }> {
  await requireUser();
  const parsed = achievementSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: firstIssue(parsed.error) };

  const { id, studentDirectoryId, evidenceFileId, verificationStatus, ...data } = parsed.data;
  void id;
  void studentDirectoryId;
  void verificationStatus;

  const supabase = await createClient();
  const { data: rows, error } = await supabase.rpc("student_suggest_achievement", {
    p_data: {
      title: data.title,
      sport: data.sport,
      event_name: data.eventName ?? "",
      academic_year: data.academicYear ?? "",
      achievement_date: data.achievementDate ?? "",
      position_result: data.positionResult ?? "",
      award_description: data.awardDescription ?? "",
      evidence_file_id: "",
    },
  });
  if (error) {
    return {
      status: "error",
      message: error.message.includes("student directory")
        ? "No active student directory record is linked to your account. Contact the PE office."
        : error.message || "Your suggestion could not be submitted.",
    };
  }

  refreshStudentProfile();
  return {
    status: "success",
    message: "Suggestion submitted. It stays pending until PE Admin verifies it.",
    achievementId: rows?.[0]?.id,
  };
}

/**
 * A student may attach evidence only to their own pending suggestion. The
 * file and achievement ownership checks use the user-scoped client; the final
 * column update is privileged because no student RPC exposes that column.
 */
export async function attachStudentEvidence(achievementId: string, fileId: string): Promise<ActionState> {
  const user = await requireUser();
  if (!z.string().uuid().safeParse(achievementId).success || !z.string().uuid().safeParse(fileId).success) {
    return { status: "error", message: "Choose a valid achievement and uploaded file." };
  }

  const supabase = await createClient();
  const { data: identity } = await supabase
    .from("profiles")
    .select("student_directory_id")
    .eq("id", user.id)
    .maybeSingle();
  const directoryId = (identity as { student_directory_id?: string | null } | null)?.student_directory_id ?? null;
  if (!directoryId) return { status: "error", message: "No active student directory record is linked to your account." };

  const [achievementResult, fileResult] = await Promise.all([
    supabase
      .from("sports_achievements")
      .select("id, verification_status")
      .eq("id", achievementId)
      .eq("student_directory_id", directoryId)
      .maybeSingle(),
    supabase
      .from("phase3_files")
      .select("id, uploader_id, parent_type, parent_id, upload_status")
      .eq("id", fileId)
      .maybeSingle(),
  ]);

  if (!achievementResult.data) return { status: "error", message: "That suggestion does not belong to you." };
  if (achievementResult.data.verification_status !== "pending") {
    return { status: "error", message: "Evidence can only be attached while the suggestion is pending." };
  }
  const file = fileResult.data as
    | { id: string; uploader_id: string; parent_type: string; parent_id: string; upload_status: string }
    | null;
  if (
    !file ||
    file.uploader_id !== user.id ||
    file.parent_type !== "achievement_evidence" ||
    file.parent_id !== achievementId ||
    file.upload_status !== "confirmed"
  ) {
    return { status: "error", message: "Upload evidence for this suggestion first, then attach it." };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("sports_achievements")
    .update({ evidence_file_id: fileId })
    .eq("id", achievementId)
    .eq("student_directory_id", directoryId)
    .eq("verification_status", "pending");
  if (error) return { status: "error", message: error.message || "The evidence could not be attached." };

  refreshStudentProfile();
  return { status: "success", message: "Evidence attached to your pending suggestion." };
}
