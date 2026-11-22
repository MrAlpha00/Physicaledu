import { Badge } from "@/components/ui/badge";
import type {
  AccountStatus,
  AttendanceStatus,
  MembershipStatus,
  TaskStatus,
  TaskSubmissionStatus,
  VerificationStatus,
} from "@/types/database";

export function VerificationBadge({ status }: { status: VerificationStatus }) {
  const map = {
    verified: { label: "Verified", variant: "lime" as const },
    pending: { label: "Pending verification", variant: "coral" as const },
    suspended: { label: "Suspended", variant: "muted" as const },
  };
  const entry = map[status];
  return <Badge variant={entry.variant}>{entry.label}</Badge>;
}

export function AccountStatusBadge({ status }: { status: AccountStatus }) {
  return (
    <Badge variant={status === "active" ? "default" : "muted"}>
      {status === "active" ? "Active account" : "Suspended account"}
    </Badge>
  );
}

export function MembershipBadge({ status }: { status: MembershipStatus | null }) {
  if (!status || status === "inactive") {
    return <Badge variant="muted">Not enrolled</Badge>;
  }
  return <Badge variant="cobalt">PE student</Badge>;
}

const ATTENDANCE_BADGES: Record<AttendanceStatus, { label: string; variant: "lime" | "coral" | "cobalt" | "muted" | "default" }> = {
  not_submitted: { label: "Not submitted", variant: "muted" },
  pending: { label: "Pending verification", variant: "coral" },
  present: { label: "Present", variant: "lime" },
  represented: { label: "Represented", variant: "cobalt" },
  absent: { label: "Absent", variant: "default" },
  excused: { label: "Excused", variant: "muted" },
};

export function AttendanceBadge({ status }: { status: AttendanceStatus }) {
  const entry = ATTENDANCE_BADGES[status];
  return <Badge variant={entry.variant}>{entry.label}</Badge>;
}

const TASK_BADGES: Record<TaskStatus | TaskSubmissionStatus | "overdue", { label: string; variant: "lime" | "coral" | "cobalt" | "muted" | "default" }> = {
  draft: { label: "Draft", variant: "muted" },
  published: { label: "Published", variant: "lime" },
  closed: { label: "Closed", variant: "default" },
  archived: { label: "Archived", variant: "muted" },
  pending: { label: "Draft / not submitted", variant: "muted" },
  submitted: { label: "Submitted", variant: "cobalt" },
  reviewed: { label: "Reviewed", variant: "default" },
  needs_correction: { label: "Needs correction", variant: "coral" },
  completed: { label: "Completed", variant: "lime" },
  overdue: { label: "Overdue", variant: "coral" },
};

export function TaskBadge({
  status,
}: {
  status: TaskStatus | TaskSubmissionStatus | "overdue";
}) {
  const entry = TASK_BADGES[status];
  return <Badge variant={entry.variant}>{entry.label}</Badge>;
}
