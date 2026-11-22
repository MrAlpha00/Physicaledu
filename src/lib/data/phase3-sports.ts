import { cache } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { AchievementView, PublicSportsProfileView, SportsProfileView } from "@/types/domain";

async function mapAchievements(
  rows: Array<Record<string, unknown>>,
): Promise<AchievementView[]> {
  if (rows.length === 0) return [];
  const supabase = await createClient();
  const ids = [...new Set(rows.map((row) => String(row.student_directory_id)))];
  const { data } = await supabase.from("student_directory").select("id, full_name").in("id", ids);
  const names = new Map((data ?? []).map((row) => [row.id, row.full_name]));
  return rows.map((row) => ({
    id: String(row.id),
    studentDirectoryId: String(row.student_directory_id),
    studentName: names.get(String(row.student_directory_id)) ?? "Student",
    title: String(row.title),
    sport: String(row.sport),
    eventName: (row.event_name as string | null) ?? null,
    academicYear: (row.academic_year as string | null) ?? null,
    achievementDate: (row.achievement_date as string | null) ?? null,
    positionResult: (row.position_result as string | null) ?? null,
    awardDescription: (row.award_description as string | null) ?? null,
    verificationStatus: row.verification_status as AchievementView["verificationStatus"],
    sourceType: row.source_type as AchievementView["sourceType"],
    verificationNote: (row.verification_note as string | null) ?? null,
    createdAt: String(row.created_at),
  }));
}

export const getAdminAchievements = cache(async (): Promise<AchievementView[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("sports_achievements")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);
  return mapAchievements((data ?? []) as Array<Record<string, unknown>>);
});

export const getMyAchievements = cache(async (): Promise<AchievementView[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("sports_achievements")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  return mapAchievements((data ?? []) as Array<Record<string, unknown>>);
});

export const getMySportsProfile = cache(async (user: User): Promise<SportsProfileView> => {
  const supabase = await createClient();
  const [profileResult, identityResult, achievements, participation] = await Promise.all([
    supabase.from("sports_profile_details").select("*").eq("user_id", user.id).maybeSingle(),
    supabase
      .from("profiles")
      .select("full_name, student_directory_id")
      .eq("id", user.id)
      .maybeSingle(),
    getMyAchievements(),
    supabase
      .from("sports_participation_records")
      .select("id", { count: "exact", head: true }),
  ]);

  // The embedded relation is not part of the generated types; fetch the stable
  // directory fields directly when needed.
  let directoryInfo: { departmentName: string | null; academicYear: number | null; semester: number | null } = {
    departmentName: null,
    academicYear: null,
    semester: null,
  };
  const directoryId = (identityResult.data as { student_directory_id?: string | null } | null)?.student_directory_id ?? null;
  if (directoryId) {
    const { data: directory } = await supabase
      .from("student_directory")
      .select("academic_year, semester, department_id")
      .eq("id", directoryId)
      .maybeSingle();
    if (directory) {
      const { data: department } = await supabase
        .from("departments")
        .select("department_name")
        .eq("id", directory.department_id)
        .maybeSingle();
      directoryInfo = {
        departmentName: department?.department_name ?? null,
        academicYear: directory.academic_year,
        semester: directory.semester,
      };
    }
  }

  const profile = profileResult.data;
  return {
    userId: user.id,
    fullName: (identityResult.data as { full_name?: string | null } | null)?.full_name
      ?? user.user_metadata?.full_name
      ?? user.email?.split("@")[0]
      ?? "Student",
    departmentName: directoryInfo.departmentName,
    academicYear: directoryInfo.academicYear,
    semester: directoryInfo.semester,
    biography: profile?.biography ?? null,
    sportsInterests: profile?.sports_interests ?? [],
    preferredSports: profile?.preferred_sports ?? [],
    isPublic: profile?.is_public ?? false,
    achievements,
    participationCount: participation.count ?? 0,
  };
});

export async function getPublicSportsProfile(studentDirectoryId: string): Promise<PublicSportsProfileView | null> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_public_sports_profile", {
    p_student_directory_id: studentDirectoryId,
  });
  const row = data?.[0];
  if (!row) return null;
  const achievements = Array.isArray(row.achievements) ? row.achievements : [];
  return {
    fullName: row.full_name,
    departmentName: row.department_name,
    academicYear: row.academic_year,
    semester: row.semester,
    biography: row.biography,
    preferredSports: row.preferred_sports ?? [],
    sportsInterests: row.sports_interests ?? [],
    achievements: achievements.map((item) => {
      const value = item as Record<string, unknown>;
      return {
        title: String(value.title ?? ""),
        sport: String(value.sport ?? ""),
        eventName: (value.event_name as string | null) ?? null,
        academicYear: (value.academic_year as string | null) ?? null,
        achievementDate: (value.achievement_date as string | null) ?? null,
        positionResult: (value.position_result as string | null) ?? null,
        awardDescription: (value.award_description as string | null) ?? null,
      };
    }),
  };
}

export const getDirectoryStudents = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("student_directory")
    .select("id, full_name, department_id, academic_year, semester, is_active")
    .eq("is_active", true)
    .order("full_name")
    .limit(2000);
  return data ?? [];
});
