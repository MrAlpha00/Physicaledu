import type {
  AccountStatus,
  AchievementVerificationStatus,
  AppRole,
  AttendanceSessionStatus,
  AttendanceStatus,
  AttendanceSubmissionType,
  AudienceType,
  CalendarCategory,
  CalendarStatus,
  CalendarVisibility,
  EmailAnnouncementStatus,
  EmailRecipientStatus,
  EquipmentCondition,
  EquipmentInventoryStatus,
  EquipmentMaintenanceStatus,
  EquipmentTrackingMode,
  EquipmentTransactionStatus,
  FeedbackCategory,
  FeedbackPriority,
  FeedbackStatus,
  GameRuleBlockType,
  GameRuleStatus,
  MembershipStatus,
  NotificationCategory,
  NotificationChannel,
  NotificationPriority,
  Phase3AudienceType,
  QrType,
  RecurrenceFrequency,
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

/* ------------------------------- Phase 3 -------------------------------- */

export interface Phase3AudienceInput {
  audienceType: Phase3AudienceType;
  departmentId?: string | null;
  semester?: number | null;
  studentDirectoryId?: string | null;
  groupId?: string | null;
}

export interface Phase3RecurrenceInput {
  frequency: RecurrenceFrequency;
  intervalCount: number;
  byWeekday?: number[];
  endsOn?: string | null;
  occurrenceLimit?: number | null;
}

export interface EquipmentCategoryView {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
}

export interface EquipmentItemView {
  id: string;
  categoryId: string;
  categoryName: string;
  name: string;
  description: string | null;
  identificationNumber: string | null;
  trackingMode: EquipmentTrackingMode;
  quantity: number;
  availableQuantity: number;
  borrowedQuantity: number;
  maintenanceQuantity: number;
  damagedQuantity: number;
  retiredQuantity: number;
  inventoryStatus: EquipmentInventoryStatus;
  condition: EquipmentCondition;
  storageLocation: string | null;
  purchasedOn: string | null;
  usefulLifeMonths: number | null;
  isActive: boolean;
  assetCount: number;
  createdAt: string;
}

export interface EquipmentAssetView {
  id: string;
  itemId: string;
  assetTag: string;
  serialNumber: string | null;
  condition: EquipmentCondition;
  status: "available" | "borrowed" | "under_maintenance" | "damaged" | "retired" | "unavailable";
  location: string | null;
  notes: string | null;
}

export interface EquipmentTransactionView {
  id: string;
  itemId: string;
  itemName: string;
  assetId: string | null;
  assetTag: string | null;
  studentDirectoryId: string;
  studentName: string;
  quantityIssued: number;
  quantityReturned: number;
  issuedAt: string;
  expectedReturnAt: string;
  displayStatus: EquipmentTransactionStatus;
  damageIndicator: boolean;
  notes: string | null;
  returnNotes: string | null;
  correctionReason: string | null;
}

export interface EquipmentMaintenanceView {
  id: string;
  itemId: string;
  itemName: string;
  assetId: string | null;
  issueDescription: string;
  maintenanceType: "damage" | "fault" | "repair" | "inspection" | "other";
  quantityAffected: number;
  reportedAt: string;
  assignedPerson: string | null;
  scheduledFor: string | null;
  expectedCompletionAt: string | null;
  completedAt: string | null;
  status: EquipmentMaintenanceStatus;
  resolutionNotes: string | null;
  cost: number | null;
}

export interface EquipmentQrResult {
  qrId: string;
  itemId: string;
  assetId: string | null;
  itemName: string;
  trackingMode: EquipmentTrackingMode;
  availableQuantity: number;
  assetTag: string | null;
  condition: EquipmentCondition;
  theme: string;
}

export interface CalendarOccurrenceView {
  occurrenceId: string;
  eventId: string;
  ruleId: string | null;
  title: string;
  description: string | null;
  category: CalendarCategory;
  startsAt: string;
  endsAt: string;
  venue: string | null;
  visibility: CalendarVisibility;
  status: CalendarStatus;
  isOverride: boolean;
  isCancelled: boolean;
}

export interface CalendarEventView extends CalendarOccurrenceView {
  audiences: Phase3AudienceInput[];
  recurrence: Phase3RecurrenceInput | null;
  canManage: boolean;
}

export interface FeedbackRequestView {
  id: string;
  subject: string;
  category: FeedbackCategory;
  description: string;
  status: FeedbackStatus;
  priority: FeedbackPriority;
  preferredResponse: "in_app" | "email" | "either" | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  studentName: string;
  departmentName: string | null;
  replyCount: number;
  unreadForAdmin: boolean;
}

export interface FeedbackReplyView {
  id: string;
  body: string;
  isInternal: boolean;
  createdAt: string;
  authorName: string;
  isMine: boolean;
}

export interface GameRuleBlockView {
  id: string;
  blockType: GameRuleBlockType;
  content: Record<string, unknown>;
  sortOrder: number;
}

export interface GameRulePostView {
  id: string;
  categoryId: string | null;
  categoryName: string | null;
  title: string;
  slug: string;
  introduction: string | null;
  history: string | null;
  aboutGame: string | null;
  howToPlay: string | null;
  rulesText: string | null;
  equipmentRequired: string | null;
  playersCount: string | null;
  playingArea: string | null;
  instructions: string | null;
  safetyInstructions: string | null;
  videoUrls: string[];
  status: GameRuleStatus;
  publishedAt: string | null;
  isFeatured: boolean;
  isPinned: boolean;
  updatedAt: string;
  blocks: GameRuleBlockView[];
}

export interface NotificationView {
  id: string;
  title: string;
  body: string;
  category: NotificationCategory;
  link: string | null;
  priority: NotificationPriority;
  announcementId: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface AnnouncementView {
  id: string;
  title: string;
  message: string;
  link: string | null;
  priority: NotificationPriority;
  audienceSummary: string | null;
  publishedAt: string;
  notifiedCount: number;
  emailAnnouncementId: string | null;
  emailStatus: EmailAnnouncementStatus | null;
  emailRecipientCount: number;
  emailAcceptedCount: number;
  emailDeliveredCount: number;
}

export interface EmailRecipientView {
  id: string;
  email: string;
  status: EmailRecipientStatus;
  attempts: number;
  lastError: string | null;
  acceptedAt: string | null;
  deliveredAt: string | null;
  failedAt: string | null;
}

export interface AchievementView {
  id: string;
  studentDirectoryId: string;
  studentName: string;
  title: string;
  sport: string;
  eventName: string | null;
  academicYear: string | null;
  achievementDate: string | null;
  positionResult: string | null;
  awardDescription: string | null;
  verificationStatus: AchievementVerificationStatus;
  sourceType: "student_entry" | "admin_record" | "future_event" | "future_game";
  verificationNote: string | null;
  createdAt: string;
}

export interface SportsProfileView {
  userId: string;
  fullName: string;
  departmentName: string | null;
  academicYear: number | null;
  semester: number | null;
  biography: string | null;
  sportsInterests: string[];
  preferredSports: string[];
  isPublic: boolean;
  achievements: AchievementView[];
  participationCount: number;
}

export interface PublicSportsProfileView {
  fullName: string;
  departmentName: string;
  academicYear: number;
  semester: number;
  biography: string | null;
  preferredSports: string[];
  sportsInterests: string[];
  achievements: Array<{
    title: string;
    sport: string;
    eventName: string | null;
    academicYear: string | null;
    achievementDate: string | null;
    positionResult: string | null;
    awardDescription: string | null;
  }>;
}

export interface Phase3ReportRow {
  label: string;
  value: number;
  detail?: string | null;
}

export interface Phase3DashboardMetrics {
  equipmentItems: number;
  equipmentIssued: number;
  equipmentOverdue: number;
  maintenanceOpen: number;
  upcomingEvents: number;
  pendingFeedback: number;
  draftGameRules: number;
  unreadNotifications: number;
  pendingAchievements: number;
  emailAcceptedToday: number;
  emailDeliveredCount: number;
  emailFailedCount: number;
}
