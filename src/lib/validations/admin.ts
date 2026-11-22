import { z } from "zod";

export const departmentSchema = z.object({
  departmentCode: z
    .string()
    .trim()
    .min(2, "Department code is required")
    .max(12, "Department code is too long")
    .regex(/^[A-Za-z0-9]+$/, "Use letters and numbers only"),
  departmentName: z
    .string()
    .trim()
    .min(2, "Department name is required")
    .max(120, "Department name is too long"),
});

export type DepartmentInput = z.infer<typeof departmentSchema>;

export const manualStudentSchema = z.object({
  usn: z
    .string()
    .trim()
    .min(6, "USN must be at least 6 characters")
    .max(24, "USN is too long")
    .regex(/^[A-Za-z0-9][A-Za-z0-9\-/._\s]*$/, "Enter a valid USN"),
  fullName: z.string().trim().min(2, "Full name is required").max(120),
  departmentId: z.string().uuid("Select a department"),
  academicYear: z.number().int().min(1).max(6),
  semester: z.number().int().min(1).max(12),
  officialEmail: z
    .string()
    .trim()
    .max(254)
    .regex(/^$|^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Enter a valid email address")
    .optional()
    .or(z.literal("")),
});

export type ManualStudentInput = z.infer<typeof manualStudentSchema>;

export const importRowSchema = z.object({
  usn: z.string().trim().min(6).max(24),
  full_name: z.string().trim().min(2).max(120),
  department_code: z.string().trim().min(2).max(12),
  academic_year: z.string().trim().regex(/^[1-6]$/, "Academic year must be 1-6"),
  semester: z.string().trim().regex(/^(1[0-2]|[1-9])$/, "Semester must be 1-12"),
  official_email: z
    .string()
    .trim()
    .regex(/^$|^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Invalid email"),
});

export type ImportRowInput = z.infer<typeof importRowSchema>;

export const profileNameSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name").max(120),
});
