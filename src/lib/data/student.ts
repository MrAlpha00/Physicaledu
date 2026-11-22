import { cache } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { ProfileRow } from "@/types/domain";

export const getStudentProfile = cache(async (user: User): Promise<ProfileRow> => {
  const supabase = await createClient();

  const [{ data: profile }, { data: roleRows }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", user.id),
  ]);

  let directory: ProfileRow["directory"] = null;

  if (profile?.student_directory_id) {
    const { data: record } = await supabase
      .from("student_directory")
      .select("usn, department_id, academic_year, semester, official_email")
      .eq("id", profile.student_directory_id)
      .maybeSingle();

    if (record) {
      const { data: department } = await supabase
        .from("departments")
        .select("department_code, department_name")
        .eq("id", record.department_id)
        .maybeSingle();

      directory = {
        usn: record.usn,
        departmentCode: department?.department_code ?? "—",
        departmentName: department?.department_name ?? "Department not available",
        academicYear: record.academic_year,
        semester: record.semester,
        officialEmail: record.official_email,
      };
    }
  }

  return {
    id: profile?.id ?? user.id,
    fullName: profile?.full_name ?? user.user_metadata?.full_name ?? "Student",
    email: profile?.email ?? user.email ?? "",
    verificationStatus: profile?.verification_status ?? "pending",
    accountStatus: profile?.account_status ?? "active",
    createdAt: profile?.created_at ?? user.created_at,
    directory,
    roles: (roleRows ?? []).map((row) => row.role),
  };
});

export async function getMyPeMembershipStatus(
  user: User,
): Promise<{ enrolled: boolean; enrolledAt: string | null }> {
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("student_directory_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.student_directory_id) {
    return { enrolled: false, enrolledAt: null };
  }

  const { data: membership } = await supabase
    .from("pe_memberships")
    .select("enrolled_at")
    .eq("student_directory_id", profile.student_directory_id)
    .eq("status", "active")
    .maybeSingle();

  return {
    enrolled: Boolean(membership),
    enrolledAt: membership?.enrolled_at ?? null,
  };
}
