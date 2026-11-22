import type {
  AccountStatus,
  AppRole,
  AttendanceSessionStatus,
  AttendanceStatus,
  AttendanceSubmissionType,
  AudienceType,
  MembershipStatus,
  QrType,
  TaskStatus,
  TaskSubmissionStatus,
  VerificationStatus,
} from "@/types/database";

export interface DepartmentOption {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  studentCount: number;
}

export interface ActiveDepartment {
  id: string;
  code: string;
  name: string;
}

export interface DirectoryRow {
  id: string;
  usn: string;
  fullName: string;
  departmentId: string;
  departmentCode: string;
  departmentName: string;
  academicYear: number;
  semester: number;
  officialEmail: string | null;
  isActive: boolean;
  source: "manual" | "import" | "registration";
  createdAt: string;
  profile: {
    id: string;
    verificationStatus: VerificationStatus;
    accountStatus: AccountStatus;
  } | null;
  membership: {
    id: string;
    status: MembershipStatus;
    enrolledAt: string;
    endedAt: string | null;
  } | null;
}

export interface ProfileRow {
  id: string;
  fullName: string;
  email: string;
  verificationStatus: VerificationStatus;
  accountStatus: AccountStatus;
  createdAt: string;
  directory: {
    usn: string;
    departmentCode: string;
    departmentName: string;
    academicYear: number;
    semester: number;
    officialEmail: string | null;
  } | null;
  roles: AppRole[];
}

export interface StudentAccountRow {
  id: string;
  fullName: string;
  email: string;
  verificationStatus: VerificationStatus;
  accountStatus: AccountStatus;
  createdAt: string;
  usn: string | null;
  departmentCode: string | null;
  departmentName: string | null;
  academicYear: number | null;
  semester: number | null;
  isPeStudent: boolean;
  roles: AppRole[];
}

export interface ImportRow {
  usn: string;
  full_name: string;
  department_code: string;
  academic_year: string;
  semester: string;
  official_email: string;
}

export interface ImportIssue {
  row: number;
  usn: string | null;
  message: string;
}

export interface ImportResult {
  batch_id: string;
  total_rows: number;
  inserted_rows: number;
  skipped_rows: number;
  errors: ImportIssue[];
}

export interface ImportBatchSummary {
  id: string;
  fileName: string;
  totalRows: number;
  insertedRows: number;
  skippedRows: number;
  createdAt: string;
}

export interface AdminMetrics {
  registeredAccounts: number;
  directoryRecords: number;
  peStudents: number;
  pendingVerifications: number;
  activeDepartments: number;
}

export interface RecentRegistration {
  id: string;
  fullName: string;
  usn: string | null;
  email: string;
  verificationStatus: VerificationStatus;
  createdAt: string;
}

export interface ActionState {
  status: "idle" | "success" | "error";
  message: string;
  fieldErrors?: Record<string, string[]>;
}

/* ------------------------------- Phase 2 -------------------------------- */

export interface StudentRosterEntry {
  studentDirectoryId: string;
  fullName: string;
  usn: string;
  departmentId: string;
  departmentCode: string;
  departmentName: string;
  semester: number;
  membershipId: string | null;
}

export interface AttendanceSessionSummary {
  id: string;
  title: string;
  classDate: string;
  startsAt: string;
  expectedEndsAt: string;
  status: AttendanceSessionStatus;
  instructions: string | null;
  openedAt: string | null;
  closedAt: string | null;
  finalisedAt: string | null;
  eligibleCount: number;
}

export interface AttendanceRecordView extends StudentRosterEntry {
  recordId: string;
  status: AttendanceStatus;
  submittedType: AttendanceSubmissionType | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  administrativeNote: string | null;
  isOverdue: boolean;
}

export interface AttendanceOverview {
  confirmedPresent: number;
  pending: number;
  represented: number;
  notSubmitted: number;
  absent: number;
  excused: number;
  total: number;
}

export interface MyAttendanceSummary {
  session: AttendanceSessionSummary | null;
  status: AttendanceStatus | null;
  submittedType: AttendanceSubmissionType | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  history: Array<{
    id: string;
    title: string;
    classDate: string;
    status: AttendanceStatus;
    submittedType: AttendanceSubmissionType | null;
    reviewedAt: string | null;
  }>;
  present: number;
  represented: number;
  absent: number;
  excused: number;
  percentage: number;
}

export interface TaskAudienceInput {
  audience_type: AudienceType;
  department_id?: string | null;
  semester?: number | null;
  student_directory_id?: string | null;
}

export interface ClassTaskView {
  id: string;
  title: string;
  description: string;
  category: string;
  startsAt: string;
  dueAt: string;
  priority: "low" | "normal" | "high";
  instructions: string | null;
  submissionRequirements: string | null;
  allowText: boolean;
  allowFiles: boolean;
  allowLinks: boolean;
  maxFileSizeBytes: number;
  allowedFileTypes: string[];
  maxFiles: number;
  status: TaskStatus;
  publishedAt: string | null;
  audiences: TaskAudienceInput[];
  referenceCount: number;
}

export interface TaskSubmissionView {
  id: string;
  taskId: string;
  taskTitle: string;
  dueAt: string;
  studentDirectoryId: string;
  fullName: string;
  usn: string;
  departmentCode: string;
  status: TaskSubmissionStatus;
  displayStatus: TaskSubmissionStatus | "overdue";
  textContent: string | null;
  linkUrl: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  feedback: string | null;
  fileCount: number;
}

export interface MyTaskView extends ClassTaskView {
  submission: {
    id: string;
    status: TaskSubmissionStatus;
    displayStatus: TaskSubmissionStatus | "overdue";
    textContent: string | null;
    linkUrl: string | null;
    submittedAt: string | null;
    reviewedAt: string | null;
    feedback: string | null;
  } | null;
}

export interface StoredFileView {
  id: string;
  objectKey: string;
  originalFilename: string;
  contentType: string;
  byteSize: number;
  parentType: "task_reference" | "task_submission";
  parentId: string;
  uploadStatus: "pending" | "confirmed" | "failed";
  createdAt: string;
}

export interface VisitorPurpose {
  id: string;
  label: string;
  isActive: boolean;
  sortOrder: number;
}

export interface VisitorRecordView {
  id: string;
  fullName: string;
  usn: string | null;
  departmentCode: string | null;
  departmentName: string | null;
  academicYear: number | null;
  semester: number | null;
  purposeLabel: string;
  purposeDetail: string | null;
  description: string | null;
  identitySource: "authenticated_profile" | "guest_input";
  visitedAt: string;
}

export interface PublicVisitor {
  visitorLabel: string;
  purposeLabel: string;
  visitedAt: string;
}

export interface RoomView {
  id: string;
  code: string;
  name: string;
  description: string | null;
  instructions: string | null;
  requiresActivity: boolean;
  maxSessionMinutes: number;
  isActive: boolean;
  activities: Array<{ id: string; name: string; isActive: boolean }>;
}

export interface RoomOccupancyEntry {
  sessionId: string;
  roomId: string;
  fullName: string;
  usn: string;
  departmentCode: string;
  activityName: string | null;
  startedAt: string;
  elapsedMinutes: number;
  isStale: boolean;
}

export interface RoomHistoryEntry extends RoomOccupancyEntry {
  endedAt: string | null;
  forceClosedReason: string | null;
}

export interface QrCodeView {
  id: string;
  name: string;
  qrType: QrType;
  destinationPath: string;
  roomId: string | null;
  theme: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
