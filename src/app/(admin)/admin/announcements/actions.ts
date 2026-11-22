"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePeAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  announcementSchema,
  studentGroupSchema,
  type AnnouncementInput,
  type AudienceInput,
  type StudentGroupInput,
} from "@/lib/validations/phase3";
import type { Json } from "@/types/database";
import type { ActionState } from "@/types/domain";

function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Check the form and try again.";
}

function toJson(value: unknown): Json {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.map(toJson);
  if (typeof value === "object") {
    const result: { [key: string]: Json } = {};
    Object.entries(value as Record<string, unknown>).forEach(([key, entry]) => {
      const converted = toJson(entry);
      if (converted !== null) result[key] = converted;
    });
    return result;
  }
  return null;
}

function audiencePayload(audience: AudienceInput): Record<string, string | number> {
  const payload: Record<string, string | number> = { audience_type: audience.audienceType };
  if (audience.departmentId) payload.department_id = audience.departmentId;
  if (audience.semester !== "" && audience.semester !== undefined) payload.semester = Number(audience.semester);
  if (audience.studentDirectoryId) payload.student_directory_id = audience.studentDirectoryId;
  if (audience.groupId) payload.group_id = audience.groupId;
  return payload;
}

function refreshAnnouncementPaths() {
  revalidatePath("/admin/announcements");
  revalidatePath("/admin/notifications");
  revalidatePath("/notifications");
  revalidatePath("/dashboard");
}

export async function saveAnnouncement(
  input: AnnouncementInput,
): Promise<ActionState & { announcementId?: string; notifiedCount?: number; recipientCount?: number }> {
  await requirePeAdmin();
  const parsed = announcementSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: firstIssue(parsed.error) };

  const data = parsed.data;
  for (const audience of data.audiences) {
    if (audience.audienceType === "department" && !audience.departmentId) {
      return { status: "error", message: "Choose a department for every department audience." };
    }
    if (audience.audienceType === "semester" && (audience.semester === "" || !audience.semester)) {
      return { status: "error", message: "Choose a semester for every semester audience." };
    }
    if (audience.audienceType === "selected_students" && !audience.studentDirectoryId) {
      return { status: "error", message: "Choose a student for every selected-student audience." };
    }
    if (audience.audienceType === "group" && !audience.groupId) {
      return { status: "error", message: "Choose a group for every group audience." };
    }
  }

  const supabase = await createClient();
  const { data: saved, error } = await supabase.rpc("admin_create_announcement", {
    p_data: toJson({
      title: data.title,
      message: data.message,
      link: data.link ?? "",
      priority: data.priority,
      attachment_file_id: data.attachmentFileId ?? "",
    }),
    p_audiences: toJson(data.audiences.map(audiencePayload)),
    p_send_email: data.sendEmail,
    p_daily_limit: Number(data.dailyLimit),
  });
  if (error) return { status: "error", message: error.message || "The announcement could not be published." };

  const result = (saved ?? {}) as Record<string, unknown>;
  const notifiedCount = typeof result.notified_count === "number" ? result.notified_count : 0;
  const recipientCount = typeof result.recipient_count === "number" ? result.recipient_count : 0;
  refreshAnnouncementPaths();
  return {
    status: "success",
    message: data.sendEmail
      ? `Announcement published. ${notifiedCount} in-app notification${notifiedCount === 1 ? "" : "s"} created; ${recipientCount} email recipient${recipientCount === 1 ? "" : "s"} queued.`
      : `Announcement published. ${notifiedCount} in-app notification${notifiedCount === 1 ? "" : "s"} created.`,
    announcementId: typeof result.announcement_id === "string" ? result.announcement_id : undefined,
    notifiedCount,
    recipientCount,
  };
}

export async function saveStudentGroup(input: StudentGroupInput): Promise<ActionState & { groupId?: string }> {
  await requirePeAdmin();
  const parsed = studentGroupSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: firstIssue(parsed.error) };

  const data = parsed.data;
  const supabase = await createClient();
  const { data: saved, error } = await supabase.rpc("admin_create_student_group", {
    p_group_id: data.id || null,
    p_data: toJson({
      name: data.name,
      description: data.description ?? "",
      is_active: data.isActive,
    }),
  });
  if (error) return { status: "error", message: error.message || "The group could not be saved." };

  refreshAnnouncementPaths();
  return {
    status: "success",
    message: data.id ? "Group updated." : "Group created.",
    groupId: saved?.[0]?.id ?? data.id,
  };
}

const groupMemberSchema = z.object({
  groupId: z.string().uuid(),
  studentDirectoryId: z.string().uuid(),
  member: z.boolean(),
});

export async function setGroupMember(input: z.infer<typeof groupMemberSchema>): Promise<ActionState> {
  await requirePeAdmin();
  const parsed = groupMemberSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: firstIssue(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_group_member", {
    p_group_id: parsed.data.groupId,
    p_student_directory_id: parsed.data.studentDirectoryId,
    p_member: parsed.data.member,
  });
  if (error) return { status: "error", message: error.message || "Group membership could not be updated." };

  refreshAnnouncementPaths();
  return {
    status: "success",
    message: parsed.data.member ? "Student added to the group." : "Student removed from the group.",
  };
}
