import type {
  AttendanceSessionStatus,
  AttendanceStatus,
  AttendanceSubmissionType,
} from "@/types/database";
import type { AttendanceOverview, AttendanceRecordView } from "@/types/domain";

export const ATTENDANCE_DECISIONS = {
  approve: "approve",
  deny: "deny",
  present: "present",
  absent: "absent",
  excused: "excused",
} as const;

export type AttendanceDecision = keyof typeof ATTENDANCE_DECISIONS;

export function computeAttendanceOverview(
  records: Array<{ status: AttendanceStatus }>,
): AttendanceOverview {
  const overview: AttendanceOverview = {
    confirmedPresent: 0,
    pending: 0,
    represented: 0,
    notSubmitted: 0,
    absent: 0,
    excused: 0,
    total: records.length,
  };
  for (const record of records) {
    switch (record.status) {
      case "present":
        overview.confirmedPresent += 1;
        break;
      case "pending":
        overview.pending += 1;
        break;
      case "represented":
        overview.represented += 1;
        break;
      case "not_submitted":
        overview.notSubmitted += 1;
        break;
      case "absent":
        overview.absent += 1;
        break;
      case "excused":
        overview.excused += 1;
        break;
    }
  }
  return overview;
}

export function canStudentSubmit(
  sessionStatus: AttendanceSessionStatus,
  recordStatus: AttendanceStatus,
): boolean {
  return sessionStatus === "open" && ["not_submitted", "pending"].includes(recordStatus);
}

export function submissionLabel(type: AttendanceSubmissionType | null): string {
  if (type === "attended") return "Attended PE Class";
  if (type === "represented") return "Represented College / Department";
  return "No submission";
}

export function splitAttendanceRows(records: AttendanceRecordView[]) {
  return {
    submitted: records.filter((record) => record.status !== "not_submitted"),
    notSubmitted: records.filter((record) => record.status === "not_submitted"),
  };
}

export function attendancePercentage(counts: {
  present: number;
  represented: number;
  absent: number;
  excused: number;
}): number {
  const counted = counts.present + counts.represented + counts.absent + counts.excused;
  if (counted === 0) return 0;
  return Math.round(((counts.present + counts.represented) / counted) * 100);
}

export function describeAttendanceError(message: string): string {
  const text = message.toLowerCase();
  if (text.includes("not open")) return "This attendance session is no longer open.";
  if (text.includes("active pe membership")) {
    return "Only students on the active PE roster can submit attendance.";
  }
  if (text.includes("reviewed attendance")) {
    return "Reviewed attendance cannot be changed.";
  }
  if (text.includes("deadline")) return "The submission deadline has passed.";
  if (text.includes("already open")) return "Another attendance session is already open.";
  return "The attendance change could not be completed. Please try again.";
}
