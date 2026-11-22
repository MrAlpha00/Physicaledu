"use server";

import { revalidatePath } from "next/cache";
import { requirePeAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { normalizeUsn } from "@/lib/utils";
import {
  manualStudentSchema,
  type ImportRowInput,
  type ManualStudentInput,
} from "@/lib/validations/admin";
import type { ImportResult } from "@/types/domain";
import type { ActionState } from "@/types/domain";

export async function verifyStudentProfile(profileId: string): Promise<ActionState> {
  const adminUser = await requirePeAdmin();
  if (adminUser.id === profileId) {
    return { status: "error", message: "You cannot verify your own account." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ verification_status: "verified" })
    .eq("id", profileId)
    .eq("verification_status", "pending");

  if (error) {
    return { status: "error", message: "Verification could not be recorded." };
  }

  revalidatePath("/admin/students");
  revalidatePath("/admin/dashboard");
  revalidatePath("/dashboard");
  return { status: "success", message: "Student account verified." };
}

export async function createManualStudent(input: ManualStudentInput): Promise<ActionState> {
  await requirePeAdmin();

  const parsed = manualStudentSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", message: "Check the student details and try again." };
  }

  const usn = normalizeUsn(parsed.data.usn);
  const supabase = await createClient();

  const [{ data: department }, { data: duplicate }] = await Promise.all([
    supabase
      .from("departments")
      .select("id")
      .eq("id", parsed.data.departmentId)
      .eq("is_active", true)
      .maybeSingle(),
    supabase.from("student_directory").select("id").eq("usn", usn).maybeSingle(),
  ]);

  if (!department) {
    return { status: "error", message: "Select an active department." };
  }
  if (duplicate) {
    return { status: "error", message: "A directory record with this USN already exists." };
  }

  const { error } = await supabase.from("student_directory").insert({
    usn,
    full_name: parsed.data.fullName,
    department_id: department.id,
    academic_year: parsed.data.academicYear,
    semester: parsed.data.semester,
    official_email: parsed.data.officialEmail?.trim().toLowerCase() || null,
    source: "manual",
  });

  if (error) {
    return { status: "error", message: "Student record could not be created." };
  }

  revalidatePath("/admin/students");
  revalidatePath("/admin/pe-roster");
  revalidatePath("/admin/dashboard");
  return { status: "success", message: "Official student record added." };
}

export async function updateStudentDirectory(
  input: ManualStudentInput & { id: string },
): Promise<ActionState> {
  await requirePeAdmin();

  const parsed = manualStudentSchema.safeParse(input);
  if (!parsed.success || !input.id) {
    return { status: "error", message: "Check the student details and try again." };
  }

  const usn = normalizeUsn(parsed.data.usn);
  const supabase = await createClient();

  const [{ data: department }, { data: duplicate }] = await Promise.all([
    supabase
      .from("departments")
      .select("id")
      .eq("id", parsed.data.departmentId)
      .eq("is_active", true)
      .maybeSingle(),
    supabase.from("student_directory").select("id").eq("usn", usn).maybeSingle(),
  ]);

  if (!department) {
    return { status: "error", message: "Select an active department." };
  }
  if (duplicate && duplicate.id !== input.id) {
    return { status: "error", message: "Another directory record already uses this USN." };
  }

  // A linked account's USN cannot be silently changed: requested_usn on the
  // profile is immutable, so reject that correction explicitly.
  const { data: linkedProfile } = await supabase
    .from("profiles")
    .select("requested_usn")
    .eq("student_directory_id", input.id)
    .maybeSingle();

  if (linkedProfile && linkedProfile.requested_usn !== usn) {
    return {
      status: "error",
      message: "This student has an account. The USN cannot be changed without contacting support.",
    };
  }

  const { error } = await supabase
    .from("student_directory")
    .update({
      usn,
      full_name: parsed.data.fullName,
      department_id: department.id,
      academic_year: parsed.data.academicYear,
      semester: parsed.data.semester,
      official_email: parsed.data.officialEmail?.trim().toLowerCase() || null,
    })
    .eq("id", input.id);

  if (error) {
    return { status: "error", message: "Student record could not be corrected." };
  }

  revalidatePath("/admin/students");
  revalidatePath("/admin/pe-roster");
  revalidatePath("/dashboard");
  return { status: "success", message: "Official student record corrected." };
}

export async function importStudentDirectory(
  rows: ImportRowInput[],
  fileName: string,
): Promise<{ state: ActionState; result: ImportResult | null }> {
  await requirePeAdmin();

  if (!Array.isArray(rows) || rows.length === 0) {
    return {
      state: { status: "error", message: "No valid rows to import." },
      result: null,
    };
  }
  if (rows.length > 1000) {
    return {
      state: { status: "error", message: "Import is limited to 1,000 rows at a time." },
      result: null,
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_import_student_directory", {
    p_rows: rows,
    p_file_name: fileName,
  });

  if (error) {
    return {
      state: { status: "error", message: "Import could not be completed. No records were changed." },
      result: null,
    };
  }

  const result = data as unknown as ImportResult;
  revalidatePath("/admin/students");
  revalidatePath("/admin/pe-roster");
  revalidatePath("/admin/dashboard");

  return {
    state: {
      status: "success",
      message: `Import complete: ${result.inserted_rows} added, ${result.skipped_rows} skipped.`,
    },
    result,
  };
}
