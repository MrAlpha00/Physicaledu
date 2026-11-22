import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type {
  AdminMetrics,
  DepartmentOption,
  DirectoryRow,
  ImportBatchSummary,
  RecentRegistration,
  StudentAccountRow,
} from "@/types/domain";

export const getAdminMetrics = cache(async (): Promise<AdminMetrics> => {
  const supabase = await createClient();
  const [accounts, directory, memberships, pending, departments] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("student_directory").select("id", { count: "exact", head: true }),
    supabase
      .from("pe_memberships")
      .select("id", { count: "exact", head: true })
      .eq("status", "active"),
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("verification_status", "pending"),
    supabase
      .from("departments")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true),
  ]);

  return {
    registeredAccounts: accounts.count ?? 0,
    directoryRecords: directory.count ?? 0,
    peStudents: memberships.count ?? 0,
    pendingVerifications: pending.count ?? 0,
    activeDepartments: departments.count ?? 0,
  };
});

export const getRecentRegistrations = cache(
  async (limit = 6): Promise<RecentRegistration[]> => {
    const supabase = await createClient();
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, email, requested_usn, verification_status, created_at")
      .order("created_at", { ascending: false })
      .limit(limit);

    return (data ?? []).map((row) => ({
      id: row.id,
      fullName: row.full_name,
      usn: row.requested_usn,
      email: row.email,
      verificationStatus: row.verification_status,
      createdAt: row.created_at,
    }));
  },
);

export const getDepartmentOptions = cache(
  async (): Promise<DepartmentOption[]> => {
    const supabase = await createClient();
    const [{ data: departments }, { data: directory }] = await Promise.all([
      supabase
        .from("departments")
        .select("id, department_code, department_name, is_active")
        .order("department_code"),
      supabase.from("student_directory").select("department_id"),
    ]);

    const counts = new Map<string, number>();
    directory?.forEach((row) => {
      counts.set(row.department_id, (counts.get(row.department_id) ?? 0) + 1);
    });

    return (departments ?? []).map((department) => ({
      id: department.id,
      code: department.department_code,
      name: department.department_name,
      isActive: department.is_active,
      studentCount: counts.get(department.id) ?? 0,
    }));
  },
);

export const getDirectoryRows = cache(async (): Promise<DirectoryRow[]> => {
  const supabase = await createClient();
  const [{ data: directory }, { data: departments }, { data: profiles }, { data: memberships }] =
    await Promise.all([
      supabase
        .from("student_directory")
        .select(
          "id, usn, full_name, department_id, academic_year, semester, official_email, is_active, source, created_at",
        )
        .order("full_name"),
      supabase.from("departments").select("id, department_code, department_name"),
      supabase
        .from("profiles")
        .select("id, student_directory_id, verification_status, account_status")
        .not("student_directory_id", "is", null),
      supabase
        .from("pe_memberships")
        .select("id, student_directory_id, enrolled_at")
        .eq("status", "active"),
    ]);

  const departmentMap = new Map(
    (departments ?? []).map((department) => [
      department.id,
      { code: department.department_code, name: department.department_name },
    ]),
  );
  const profileMap = new Map(
    (profiles ?? []).map((profile) => [profile.student_directory_id, profile]),
  );
  const membershipMap = new Map(
    (memberships ?? []).map((membership) => [membership.student_directory_id, membership]),
  );

  return (directory ?? []).map((row) => {
    const profile = profileMap.get(row.id);
    const membership = membershipMap.get(row.id);
    const department = departmentMap.get(row.department_id);

    return {
      id: row.id,
      usn: row.usn,
      fullName: row.full_name,
      departmentId: row.department_id,
      departmentCode: department?.code ?? "—",
      departmentName: department?.name ?? "Unknown department",
      academicYear: row.academic_year,
      semester: row.semester,
      officialEmail: row.official_email,
      isActive: row.is_active,
      source: row.source,
      createdAt: row.created_at,
      profile: profile
        ? {
            id: profile.id,
            verificationStatus: profile.verification_status,
            accountStatus: profile.account_status,
          }
        : null,
      membership: membership
        ? {
            id: membership.id,
            status: "active",
            enrolledAt: membership.enrolled_at,
          }
        : null,
    };
  });
});

export const getStudentAccounts = cache(async (): Promise<StudentAccountRow[]> => {
  const supabase = await createClient();
  const [{ data: profiles }, { data: roles }, { data: directory }, { data: departments }, { data: memberships }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, email, requested_usn, student_directory_id, verification_status, account_status, created_at")
        .order("created_at", { ascending: false }),
      supabase.from("user_roles").select("user_id, role"),
      supabase
        .from("student_directory")
        .select("id, usn, department_id, academic_year, semester"),
      supabase.from("departments").select("id, department_code, department_name"),
      supabase
        .from("pe_memberships")
        .select("student_directory_id")
        .eq("status", "active"),
    ]);

  const roleMap = new Map<string, string[]>();
  roles?.forEach((role) => {
    roleMap.set(role.user_id, [...(roleMap.get(role.user_id) ?? []), role.role]);
  });
  const directoryMap = new Map((directory ?? []).map((row) => [row.id, row]));
  const departmentMap = new Map(
    (departments ?? []).map((department) => [department.id, department]),
  );
  const peIds = new Set((memberships ?? []).map((membership) => membership.student_directory_id));

  return (profiles ?? []).map((profile) => {
    const record = profile.student_directory_id
      ? directoryMap.get(profile.student_directory_id)
      : undefined;
    const department = record ? departmentMap.get(record.department_id) : undefined;

    return {
      id: profile.id,
      fullName: profile.full_name,
      email: profile.email,
      verificationStatus: profile.verification_status,
      accountStatus: profile.account_status,
      createdAt: profile.created_at,
      usn: record?.usn ?? profile.requested_usn,
      departmentCode: department?.department_code ?? null,
      departmentName: department?.department_name ?? null,
      academicYear: record?.academic_year ?? null,
      semester: record?.semester ?? null,
      isPeStudent: record ? peIds.has(record.id) : false,
      roles: (roleMap.get(profile.id) ?? []) as StudentAccountRow["roles"],
    };
  });
});

export const getImportHistory = cache(async (): Promise<ImportBatchSummary[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("import_batches")
    .select("id, file_name, total_rows, inserted_rows, skipped_rows, created_at")
    .order("created_at", { ascending: false })
    .limit(8);

  return (data ?? []).map((batch) => ({
    id: batch.id,
    fileName: batch.file_name,
    totalRows: batch.total_rows,
    insertedRows: batch.inserted_rows,
    skippedRows: batch.skipped_rows,
    createdAt: batch.created_at,
  }));
});
