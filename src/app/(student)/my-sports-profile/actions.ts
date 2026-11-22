"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
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
  await requireUser();
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
  // Evidence is uploaded after the suggestion exists, then attached by id.
  void evidenceFileId;

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
 * A student may attach a confirmed file only to their own pending suggestion.
 * The SECURITY DEFINER RPC performs every ownership check against auth.uid().
 */
export async function attachStudentEvidence(achievementId: string, fileId: string): Promise<ActionState> {
  if (!z.string().uuid().safeParse(achievementId).success || !z.string().uuid().safeParse(fileId).success) {
    return { status: "error", message: "Choose a valid achievement and uploaded file." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("student_attach_phase3_file", {
    p_parent_type: "achievement_evidence",
    p_parent_id: achievementId,
    p_file_id: fileId,
  });
  if (error) {
    return { status: "error", message: error.message || "The evidence could not be attached." };
  }

  refreshStudentProfile();
  return { status: "success", message: "Evidence attached to your pending suggestion." };
}
