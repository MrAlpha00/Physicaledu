"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { NotificationCategory, NotificationChannel } from "@/types/database";
import type { ActionState } from "@/types/domain";

const markOneSchema = z.object({
  notificationId: z.string().uuid(),
  read: z.boolean().default(true),
});

const preferenceSchema = z.object({
  category: z.enum([
    "general", "attendance", "task", "calendar", "feedback",
    "equipment", "announcement", "achievement", "future_event",
  ]),
  channel: z.enum(["in_app", "email"]),
  enabled: z.boolean(),
});

function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Check the request and try again.";
}

function refreshNotifications() {
  revalidatePath("/notifications");
  revalidatePath("/dashboard");
}

export async function markNotificationRead(
  input: z.infer<typeof markOneSchema>,
): Promise<ActionState> {
  await requireUser();
  const parsed = markOneSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: firstIssue(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.rpc("student_mark_notification_read", {
    p_notification_id: parsed.data.notificationId,
    p_read: parsed.data.read,
  });
  if (error) return { status: "error", message: error.message || "The notification could not be updated." };

  refreshNotifications();
  return { status: "success", message: parsed.data.read ? "Marked as read." : "Marked as unread." };
}

export async function markAllNotificationsRead(): Promise<ActionState> {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("student_mark_all_notifications_read", {});
  if (error) return { status: "error", message: error.message || "Notifications could not be updated." };

  refreshNotifications();
  const count = typeof data === "number" ? data : 0;
  return {
    status: "success",
    message: count > 0 ? `${count} notification${count === 1 ? "" : "s"} marked as read.` : "All notifications were already read.",
  };
}

export async function setNotificationPreference(
  input: { category: NotificationCategory; channel: NotificationChannel; enabled: boolean },
): Promise<ActionState> {
  await requireUser();
  const parsed = preferenceSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: firstIssue(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.rpc("student_set_notification_preference", {
    p_category: parsed.data.category,
    p_channel: parsed.data.channel,
    p_enabled: parsed.data.enabled,
  });
  if (error) return { status: "error", message: error.message || "The preference could not be saved." };

  refreshNotifications();
  return { status: "success", message: "Preference saved." };
}
