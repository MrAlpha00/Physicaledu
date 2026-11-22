import { z } from "zod";

export const attendanceSessionSchema = z.object({
  title: z.string().trim().min(3, "Enter a session title").max(120),
  classDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a class date"),
  startsAt: z.string().min(1, "Choose a start time"),
  expectedEndsAt: z.string().min(1, "Choose an expected end time"),
  instructions: z.string().trim().max(1000).optional().or(z.literal("")),
  allowConcurrent: z.boolean().optional().default(false),
  concurrentReason: z.string().trim().max(300).optional().or(z.literal("")),
});
export type AttendanceSessionInput = z.infer<typeof attendanceSessionSchema>;

export const attendanceDecisionSchema = z.object({
  recordId: z.string().uuid(),
  decision: z.enum(["approve", "deny", "present", "absent", "excused"]),
  note: z.string().trim().max(500).optional().or(z.literal("")),
});

export const classTaskSchema = z.object({
  id: z.string().uuid().optional().or(z.literal("")),
  title: z.string().trim().min(3, "Enter a task title").max(120),
  description: z.string().trim().max(4000).optional().or(z.literal("")),
  category: z.string().trim().max(60).optional().or(z.literal("")),
  startsAt: z.string().min(1, "Choose a start date"),
  dueAt: z.string().min(1, "Choose a deadline"),
  priority: z.enum(["low", "normal", "high"]),
  instructions: z.string().trim().max(4000).optional().or(z.literal("")),
  submissionRequirements: z.string().trim().max(2000).optional().or(z.literal("")),
  allowText: z.boolean(),
  allowFiles: z.boolean(),
  allowLinks: z.boolean(),
  maxFileSizeBytes: z.number().int().min(1024).max(104857600),
  allowedFileTypes: z.array(z.string()).min(1, "Allow at least one file type"),
  maxFiles: z.number().int().min(0).max(10),
  status: z.enum(["draft", "published", "closed", "archived"]),
  audiences: z
    .array(
      z.object({
        audience_type: z.enum([
          "all_students",
          "active_pe",
          "department",
          "semester",
          "selected_students",
        ]),
        department_id: z.string().uuid().nullable().optional().or(z.literal("")),
        semester: z.number().int().min(1).max(12).optional().nullable(),
        student_directory_id: z.string().uuid().nullable().optional().or(z.literal("")),
      }),
    )
    .min(1, "Select at least one audience"),
});
export type ClassTaskInput = z.infer<typeof classTaskSchema>;

export const taskSubmissionSchema = z.object({
  taskId: z.string().uuid(),
  textContent: z.string().trim().max(10000).optional().or(z.literal("")),
  linkUrl: z
    .string()
    .trim()
    .regex(/^$|^https?:\/\/[^\s]+$/, "Enter a valid http(s) link")
    .optional()
    .or(z.literal("")),
  submit: z.boolean(),
});

export const visitorFormSchema = z.object({
  token: z.string().min(16, "Invalid QR token"),
  fullName: z.string().trim().min(2, "Enter your full name").max(120).optional().or(z.literal("")),
  usn: z.string().trim().max(24).optional().or(z.literal("")),
  departmentId: z.string().uuid().nullable().optional().or(z.literal("")),
  academicYear: z.number().int().min(1).max(6).optional().nullable(),
  semester: z.number().int().min(1).max(12).optional().nullable(),
  purposeId: z.string().uuid("Choose a purpose of visit"),
  purposeDetail: z.string().trim().max(500).optional().or(z.literal("")),
  description: z.string().trim().max(1000).optional().or(z.literal("")),
  honeypot: z.string().max(200).optional().or(z.literal("")),
  turnstileToken: z.string().max(2000).optional().or(z.literal("")),
});
export type VisitorFormInput = z.infer<typeof visitorFormSchema>;

export const roomActivitySchema = z.object({
  roomId: z.string().uuid(),
  name: z.string().trim().min(2, "Enter an activity name").max(80),
});

export const roomConfigSchema = z.object({
  roomId: z.string().uuid(),
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(500).optional().or(z.literal("")),
  instructions: z.string().trim().max(500).optional().or(z.literal("")),
  requiresActivity: z.boolean(),
  maxSessionMinutes: z.number().int().min(15).max(720),
  isActive: z.boolean(),
});
