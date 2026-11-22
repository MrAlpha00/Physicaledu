import { z } from "zod";

const optionalText = (max: number) =>
  z.string().trim().max(max).optional().or(z.literal(""));

const uuidOrEmpty = z.string().uuid().or(z.literal(""));

export const equipmentCategorySchema = z.object({
  id: uuidOrEmpty.optional(),
  name: z.string().trim().min(2, "Enter a category name").max(80),
  description: optionalText(500),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
  isActive: z.boolean().default(true),
});
export type EquipmentCategoryInput = z.infer<typeof equipmentCategorySchema>;

export const equipmentItemSchema = z.object({
  id: uuidOrEmpty.optional(),
  categoryId: z.string().uuid("Choose a category"),
  name: z.string().trim().min(2, "Enter an equipment name").max(120),
  description: optionalText(1000),
  identificationNumber: optionalText(80),
  trackingMode: z.enum(["individual", "bulk"]),
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1").max(10000),
  condition: z.enum(["excellent", "good", "fair", "poor", "unusable"]).default("good"),
  storageLocation: optionalText(120),
  purchasedOn: optionalText(10),
  usefulLifeMonths: z.coerce.number().int().min(1).max(600).optional().or(z.literal("")),
  notes: optionalText(1000),
  imageFileId: uuidOrEmpty.optional(),
  isActive: z.boolean().default(true),
});
export type EquipmentItemInput = z.infer<typeof equipmentItemSchema>;

export const equipmentAssetSchema = z.object({
  itemId: z.string().uuid(),
  assetTag: z.string().trim().min(2, "Enter an asset tag").max(80),
  serialNumber: optionalText(120),
  condition: z.enum(["excellent", "good", "fair", "poor", "unusable"]).default("good"),
  location: optionalText(120),
  notes: optionalText(500),
});
export type EquipmentAssetInput = z.infer<typeof equipmentAssetSchema>;

export const stockAdjustmentSchema = z.object({
  itemId: z.string().uuid(),
  quantityDelta: z.coerce.number().int().min(-10000).max(10000).refine((value) => value !== 0, "Enter a non-zero adjustment"),
  reason: z.string().trim().min(5, "Give a reason for the adjustment").max(300),
});
export type StockAdjustmentInput = z.infer<typeof stockAdjustmentSchema>;

export const borrowEquipmentSchema = z.object({
  itemId: z.string().uuid(),
  assetId: uuidOrEmpty.optional(),
  quantity: z.coerce.number().int().min(1).max(1000),
  expectedReturnAt: z.string().min(1, "Choose an expected return time"),
  notes: optionalText(500),
  studentDirectoryId: uuidOrEmpty.optional(),
});
export type BorrowEquipmentInput = z.infer<typeof borrowEquipmentSchema>;

export const returnEquipmentSchema = z.object({
  transactionId: z.string().uuid(),
  quantity: z.coerce.number().int().min(1).max(1000),
  condition: z.enum(["excellent", "good", "fair", "poor", "unusable"]),
  damageIndicator: z.boolean().default(false),
  notes: optionalText(500),
});
export type ReturnEquipmentInput = z.infer<typeof returnEquipmentSchema>;

export const maintenanceSchema = z.object({
  id: uuidOrEmpty.optional(),
  itemId: z.string().uuid(),
  assetId: uuidOrEmpty.optional(),
  issueDescription: z.string().trim().min(10, "Describe the issue").max(2000),
  maintenanceType: z.enum(["damage", "fault", "repair", "inspection", "other"]),
  quantityAffected: z.coerce.number().int().min(1).max(1000).default(1),
  assignedPerson: optionalText(120),
  scheduledFor: optionalText(30),
  expectedCompletionAt: optionalText(30),
  notes: optionalText(1000),
  sourceFeedbackId: uuidOrEmpty.optional(),
  status: z.enum(["reported", "under_review", "scheduled", "in_progress"]).default("reported"),
});
export type MaintenanceInput = z.infer<typeof maintenanceSchema>;

export const maintenanceStatusSchema = z.object({
  recordId: z.string().uuid(),
  status: z.enum(["reported", "under_review", "scheduled", "in_progress", "completed", "unrepairable", "cancelled"]),
  resolutionNotes: optionalText(1000),
  cost: z.coerce.number().min(0).max(1000000).optional().or(z.literal("")),
});
export type MaintenanceStatusInput = z.infer<typeof maintenanceStatusSchema>;

export const audienceSchema = z.object({
  audienceType: z.enum(["all_students", "active_pe", "department", "semester", "selected_students", "group"]),
  departmentId: uuidOrEmpty.optional(),
  semester: z.coerce.number().int().min(1).max(12).optional().or(z.literal("")),
  studentDirectoryId: uuidOrEmpty.optional(),
  groupId: uuidOrEmpty.optional(),
});
export type AudienceInput = z.infer<typeof audienceSchema>;

export const recurrenceSchema = z.object({
  frequency: z.enum(["daily", "weekly", "monthly"]),
  intervalCount: z.coerce.number().int().min(1).max(12).default(1),
  byWeekday: z.array(z.coerce.number().int().min(0).max(6)).min(1).max(7).optional(),
  endsOn: optionalText(10),
  occurrenceLimit: z.coerce.number().int().min(1).max(260).optional().or(z.literal("")),
});
export type RecurrenceInput = z.infer<typeof recurrenceSchema>;

export const calendarEventSchema = z.object({
  id: uuidOrEmpty.optional(),
  title: z.string().trim().min(3, "Enter an event title").max(120),
  description: optionalText(3000),
  category: z.enum([
    "pe_class", "sports_practice", "competition", "fitness_activity",
    "department_activity", "announcement", "deadline", "other",
  ]),
  startsAt: z.string().min(1, "Choose a start time"),
  endsAt: z.string().min(1, "Choose an end time"),
  venue: optionalText(120),
  visibility: z.enum(["public", "authenticated", "pe_only"]).default("pe_only"),
  status: z.enum(["draft", "published", "archived"]).default("draft"),
  isRecurring: z.boolean().default(false),
  attachmentFileId: uuidOrEmpty.optional(),
  audiences: z.array(audienceSchema).min(1, "Select at least one audience"),
  recurrence: recurrenceSchema.optional().nullable(),
});
export type CalendarEventInput = z.infer<typeof calendarEventSchema>;

export const calendarOverrideSchema = z.object({
  ruleId: z.string().uuid(),
  occurrenceStartsAt: z.string().min(1),
  isCancelled: z.boolean().default(false),
  title: optionalText(120),
  startsAt: optionalText(30),
  endsAt: optionalText(30),
  venue: optionalText(120),
  description: optionalText(3000),
});
export type CalendarOverrideInput = z.infer<typeof calendarOverrideSchema>;

export const feedbackRequestSchema = z.object({
  subject: z.string().trim().min(5, "Enter a clear subject").max(120),
  category: z.enum([
    "suggestion", "complaint", "equipment_request", "equipment_damage",
    "facility_issue", "sports_activity_request", "attendance_correction", "other",
  ]),
  description: z.string().trim().min(15, "Give enough detail for the department to act").max(4000),
  preferredResponse: z.enum(["in_app", "email", "either"]).default("in_app"),
  attachmentFileId: uuidOrEmpty.optional(),
});
export type FeedbackRequestInput = z.infer<typeof feedbackRequestSchema>;

export const feedbackReplySchema = z.object({
  requestId: z.string().uuid(),
  body: z.string().trim().min(2, "Enter a reply").max(2000),
});
export type FeedbackReplyInput = z.infer<typeof feedbackReplySchema>;

export const feedbackUpdateSchema = z.object({
  requestId: z.string().uuid(),
  status: z.enum(["submitted", "under_review", "in_progress", "waiting_for_student", "resolved", "rejected", "closed"]),
  priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
  response: optionalText(2000),
  internalNote: optionalText(1000),
});
export type FeedbackUpdateInput = z.infer<typeof feedbackUpdateSchema>;

export const gameRuleCategorySchema = z.object({
  id: uuidOrEmpty.optional(),
  name: z.string().trim().min(2).max(80),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use a URL-friendly slug"),
  description: optionalText(500),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
  isActive: z.boolean().default(true),
});
export type GameRuleCategoryInput = z.infer<typeof gameRuleCategorySchema>;

export const gameRuleBlockSchema = z.object({
  blockType: z.enum([
    "heading", "paragraph", "image", "image_gallery", "bullet_list",
    "numbered_instructions", "rules_section", "quote", "video_embed", "resource",
  ]),
  content: z.record(z.unknown()).default({}),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
});
export type GameRuleBlockInput = z.infer<typeof gameRuleBlockSchema>;

export const gameRulePostSchema = z.object({
  id: uuidOrEmpty.optional(),
  categoryId: uuidOrEmpty.optional(),
  title: z.string().trim().min(3, "Enter a title").max(140),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use a URL-friendly slug"),
  introduction: optionalText(1500),
  history: optionalText(4000),
  aboutGame: optionalText(4000),
  howToPlay: optionalText(6000),
  rulesText: optionalText(6000),
  equipmentRequired: optionalText(2000),
  playersCount: optionalText(80),
  playingArea: optionalText(500),
  instructions: optionalText(6000),
  safetyInstructions: optionalText(3000),
  videoUrls: z.array(z.string().trim().url()).max(8).default([]),
  status: z.enum(["draft", "published", "archived"]).default("draft"),
  isFeatured: z.boolean().default(false),
  isPinned: z.boolean().default(false),
  blocks: z.array(gameRuleBlockSchema).max(60).default([]),
});
export type GameRulePostInput = z.infer<typeof gameRulePostSchema>;

export const studentGroupSchema = z.object({
  id: uuidOrEmpty.optional(),
  name: z.string().trim().min(2, "Enter a group name").max(80),
  description: optionalText(500),
  isActive: z.boolean().default(true),
});
export type StudentGroupInput = z.infer<typeof studentGroupSchema>;

export const announcementSchema = z.object({
  title: z.string().trim().min(5, "Enter a title").max(140),
  message: z.string().trim().min(10, "Enter the announcement").max(4000),
  link: z.string().trim().max(500).optional().or(z.literal("")),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
  attachmentFileId: uuidOrEmpty.optional(),
  sendEmail: z.boolean().default(false),
  dailyLimit: z.coerce.number().int().min(1).max(100).default(100),
  audiences: z.array(audienceSchema).min(1, "Select at least one audience"),
});
export type AnnouncementInput = z.infer<typeof announcementSchema>;

export const sportsProfileSchema = z.object({
  biography: optionalText(1500),
  sportsInterests: z.array(z.string().trim().min(1).max(60)).max(20).default([]),
  preferredSports: z.array(z.string().trim().min(1).max(60)).max(20).default([]),
  isPublic: z.boolean().default(false),
  profilePhotoFileId: uuidOrEmpty.optional(),
});
export type SportsProfileInput = z.infer<typeof sportsProfileSchema>;

export const achievementSchema = z.object({
  id: uuidOrEmpty.optional(),
  studentDirectoryId: uuidOrEmpty.optional(),
  title: z.string().trim().min(3, "Enter an achievement title").max(140),
  sport: z.string().trim().min(2, "Enter the sport").max(80),
  eventName: optionalText(140),
  academicYear: optionalText(30),
  achievementDate: optionalText(10),
  positionResult: optionalText(120),
  awardDescription: optionalText(2000),
  evidenceFileId: uuidOrEmpty.optional(),
  verificationStatus: z.enum(["pending", "verified", "rejected"]).default("pending"),
});
export type AchievementInput = z.infer<typeof achievementSchema>;

export const achievementReviewSchema = z.object({
  achievementId: z.string().uuid(),
  status: z.enum(["pending", "verified", "rejected"]),
  note: optionalText(500),
});
export type AchievementReviewInput = z.infer<typeof achievementReviewSchema>;

export const exportDatasetSchema = z.enum([
  "attendance", "tasks", "visitors", "rooms", "equipment", "maintenance",
  "feedback", "achievements", "calendar",
]);
export type ExportDataset = z.infer<typeof exportDatasetSchema>;
