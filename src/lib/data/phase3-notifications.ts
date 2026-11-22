import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type {
  AnnouncementView,
  EmailRecipientView,
  NotificationView,
} from "@/types/domain";

export const getMyNotifications = cache(async (): Promise<NotificationView[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  return (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    body: row.body,
    category: row.category,
    link: row.link,
    priority: row.priority,
    announcementId: row.announcement_id,
    readAt: row.read_at,
    createdAt: row.created_at,
  }));
});

export const getUnreadNotificationCount = cache(async (): Promise<number> => {
  const supabase = await createClient();
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .is("read_at", null);
  return count ?? 0;
});

export const getNotificationPreferences = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.from("notification_preferences").select("*");
  return data ?? [];
});

export const getStudentGroups = cache(async () => {
  const supabase = await createClient();
  const [groupsResult, membersResult, studentsResult] = await Promise.all([
    supabase.from("student_groups").select("*").order("name"),
    supabase.from("student_group_members").select("id, group_id, student_directory_id"),
    supabase.from("student_directory").select("id, full_name"),
  ]);
  const studentNames = new Map((studentsResult.data ?? []).map((row) => [row.id, row.full_name]));
  return (groupsResult.data ?? []).map((group) => ({
    id: group.id,
    name: group.name,
    description: group.description,
    isActive: group.is_active,
    members: (membersResult.data ?? [])
      .filter((member) => member.group_id === group.id)
      .map((member) => ({
        id: member.id,
        studentDirectoryId: member.student_directory_id,
        fullName: studentNames.get(member.student_directory_id) ?? "Student",
      })),
  }));
});

export const getAdminAnnouncements = cache(async (): Promise<AnnouncementView[]> => {
  const supabase = await createClient();
  const [announcementsResult, emailsResult, recipientsResult] = await Promise.all([
    supabase.from("announcements").select("*").order("published_at", { ascending: false }).limit(200),
    supabase.from("email_announcements").select("*"),
    supabase.from("email_recipients").select("id, email_announcement_id, status"),
  ]);

  return (announcementsResult.data ?? []).map((row) => {
    const email = (emailsResult.data ?? []).find((item) => item.announcement_id === row.id) ?? null;
    const emailRows = email
      ? (recipientsResult.data ?? []).filter((item) => item.email_announcement_id === email.id)
      : [];
    return {
      id: row.id,
      title: row.title,
      message: row.message,
      link: row.link,
      priority: row.priority,
      audienceSummary: row.audience_summary,
      publishedAt: row.published_at,
      notifiedCount: 0,
      emailAnnouncementId: email?.id ?? null,
      emailStatus: email?.status ?? null,
      emailRecipientCount: emailRows.length,
      emailAcceptedCount: emailRows.filter((item) => ["accepted", "delivered", "bounced"].includes(item.status)).length,
      emailDeliveredCount: emailRows.filter((item) => item.status === "delivered").length,
    };
  });
});

export const getEmailAnnouncements = cache(async () => {
  const supabase = await createClient();
  const [emailsResult, recipientsResult] = await Promise.all([
    supabase.from("email_announcements").select("*").order("created_at", { ascending: false }).limit(100),
    supabase.from("email_recipients").select("email_announcement_id, status"),
  ]);
  return (emailsResult.data ?? []).map((email) => {
    const rows = (recipientsResult.data ?? []).filter((item) => item.email_announcement_id === email.id);
    return {
      id: email.id,
      title: email.title,
      status: email.status,
      dailyLimit: email.daily_limit,
      createdAt: email.created_at,
      audienceSummary: email.audience_summary,
      queued: rows.filter((item) => item.status === "queued").length,
      sending: rows.filter((item) => item.status === "sending").length,
      accepted: rows.filter((item) => ["accepted", "delivered", "bounced"].includes(item.status)).length,
      delivered: rows.filter((item) => item.status === "delivered").length,
      failed: rows.filter((item) => item.status === "failed").length,
    };
  });
});

export async function getEmailRecipients(emailAnnouncementId: string): Promise<EmailRecipientView[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("email_recipients")
    .select("id, email, status, attempts, last_error, accepted_at, delivered_at, failed_at")
    .eq("email_announcement_id", emailAnnouncementId)
    .order("queued_at", { ascending: false })
    .limit(500);
  return (data ?? []).map((row) => ({
    id: row.id,
    email: row.email,
    status: row.status,
    attempts: row.attempts,
    lastError: row.last_error,
    acceptedAt: row.accepted_at,
    deliveredAt: row.delivered_at,
    failedAt: row.failed_at,
  }));
}

export const getEmailDailyUsage = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("email_daily_usage")
    .select("usage_date, accepted_count")
    .order("usage_date", { ascending: false })
    .limit(7);
  return data ?? [];
});
