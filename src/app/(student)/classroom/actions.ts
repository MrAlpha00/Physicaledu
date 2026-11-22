"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { describeAttendanceError } from "@/lib/operations/attendance";
import type { AttendanceSubmissionType } from "@/types/database";
import type { ActionState } from "@/types/domain";

export async function submitMyAttendance(
  sessionId: string,
  type: AttendanceSubmissionType,
): Promise<ActionState> {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.rpc("student_submit_attendance", {
    p_session_id: sessionId,
    p_type: type,
  });

  if (error) {
    return { status: "error", message: describeAttendanceError(error.message) };
  }
  revalidatePath("/classroom");
  revalidatePath("/dashboard");
  revalidatePath("/admin/classroom/attendance");
  return {
    status: "success",
    message:
      type === "represented"
        ? "College representation submitted for review."
        : "PE class attendance submitted for review.",
  };
}
