import type { TaskSubmissionStatus } from "@/types/database";
import type { TaskAudienceInput } from "@/types/domain";

/** Submission status shown to users; overdue is derived, never stored blindly. */
export function displaySubmissionStatus(
  status: TaskSubmissionStatus,
  dueAt: string,
  now: Date = new Date(),
): TaskSubmissionStatus | "overdue" {
  if (status === "pending" && now.getTime() > new Date(dueAt).getTime()) return "overdue";
  return status;
}

export function isTaskAcceptingSubmissions(
  status: string,
  deadline: string,
  now: Date = new Date(),
): boolean {
  return status === "published" && now.getTime() <= new Date(deadline).getTime();
}

export function audienceSummary(audiences: TaskAudienceInput[]): string[] {
  return audiences.map((audience) => {
    switch (audience.audience_type) {
      case "all_students":
        return "All registered students";
      case "active_pe":
        return "Active PE students";
      case "department":
        return "Selected department";
      case "semester":
        return `Semester ${audience.semester ?? "—"}`;
      case "selected_students":
        return "Selected PE students";
      default:
        return "Unknown audience";
    }
  });
}

export function validateAudiences(audiences: TaskAudienceInput[]): string | null {
  if (!audiences.length) return "Select at least one target audience.";
  for (const audience of audiences) {
    if (
      (audience.audience_type === "department" && !audience.department_id) ||
      (audience.audience_type === "semester" && !audience.semester) ||
      (audience.audience_type === "selected_students" && !audience.student_directory_id)
    ) {
      return "Complete every audience target before saving.";
    }
  }
  return null;
}

export function describeTaskError(message: string): string {
  const text = message.toLowerCase();
  if (text.includes("not assigned")) return "This task is not assigned to you.";
  if (text.includes("deadline")) return "The submission deadline has passed.";
  if (text.includes("reviewed submissions")) return "Reviewed submissions cannot be edited.";
  if (text.includes("file exceeds")) return "One or more files exceed the task size limit.";
  if (text.includes("file type") || text.includes("file types")) {
    return "That file type is not permitted for this task.";
  }
  if (text.includes("attachment limit")) return "The attachment limit for this task has been reached.";
  return "The task could not be updated. Please try again.";
}
