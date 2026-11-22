"use server";

import { revalidatePath } from "next/cache";
import { requirePeAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { istLocalInputToIso } from "@/lib/time/india";
import {
  attendanceDecisionSchema,
  attendanceSessionSchema,
  type AttendanceSessionInput,
} from "@/lib/validations/phase2";
import type { ActionState } from "@/types/domain";
import type { AttendanceSessionStatus } from "@/types/database";

function refreshAttendance() {
  revalidatePath("/admin/classroom/attendance");
  revalidatePath("/admin/dashboard");
  revalidatePath("/dashboard");
  revalidatePath("/classroom");
}

export async function createAttendanceSession(
  input: AttendanceSessionInput,
): Promise<ActionState> {
  await requirePeAdmin();
  const parsed = attendanceSessionSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", message: "Check the session details and try again." };
  }
  const values = parsed.data;
  const startsAt = istLocalInputToIso(values.startsAt);
  const expectedEndsAt = istLocalInputToIso(values.expectedEndsAt);
  if (new Date(expectedEndsAt) <= new Date(startsAt)) {
    return { status: "error", message: "Expected end time must be after the start time." };
  }
  if (values.allowConcurrent && !values.concurrentReason) {
    return { status: "error", message: "Give a reason for an overlapping session." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_create_attendance_session", {
    p_title: values.title,
    p_class_date: values.classDate,
    p_starts_at: startsAt,
    p_expected_ends_at: expectedEndsAt,
    p_instructions: values.instructions || null,
    p_allow_concurrent: values.allowConcurrent,
    p_concurrent_reason: values.concurrentReason || null,
  });

  if (error) {
    return { status: "error", message: error.message || "Session could not be created." };
  }
  refreshAttendance();
  return { status: "success", message: "Attendance session created with the active PE roster." };
}

export async function setAttendanceSessionStatus(
  sessionId: string,
  status: AttendanceSessionStatus,
): Promise<ActionState> {
  await requirePeAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_attendance_session_status", {
    p_session_id: sessionId,
    p_status: status,
  });
  if (error) {
    return {
      status: "error",
      message: error.message.toLowerCase().includes("already open")
        ? "Another attendance session is already open."
        : "Session status could not be changed.",
    };
  }
  refreshAttendance();
  return { status: "success", message: `Session ${status}.` };
}

export async function reviewAttendance(input: {
  recordId: string;
  decision: "approve" | "deny" | "present" | "absent" | "excused";
  note?: string;
}): Promise<ActionState> {
  await requirePeAdmin();
  const parsed = attendanceDecisionSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", message: "Check the attendance decision and try again." };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_review_attendance", {
    p_record_id: parsed.data.recordId,
    p_decision: parsed.data.decision,
    p_note: parsed.data.note || null,
  });
  if (error) {
    return { status: "error", message: error.message || "Attendance could not be updated." };
  }
  refreshAttendance();
  return {
    status: "success",
    message:
      parsed.data.decision === "approve"
        ? "Submission agreed and recorded."
        : parsed.data.decision === "deny"
          ? "Submission denied and marked absent."
          : "Attendance updated and audited.",
  };
}

export async function finaliseAttendance(
  sessionId: string,
  remainingStatus: "absent" | "excused",
): Promise<ActionState> {
  await requirePeAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_finalise_attendance", {
    p_session_id: sessionId,
    p_remaining_status: remainingStatus,
  });
  if (error) {
    return {
      status: "error",
      message: error.message.toLowerCase().includes("closed")
        ? "Close the session before finalising it."
        : "Attendance could not be finalised.",
    };
  }
  refreshAttendance();
  return { status: "success", message: "Attendance finalised." };
}
