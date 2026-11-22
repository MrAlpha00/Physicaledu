import type { Metadata } from "next";
import { NotificationCentre } from "@/components/phase3/notifications/notification-centre";
import { Phase3Header } from "@/components/phase3/common";
import {
  getMyNotifications,
  getNotificationPreferences,
  getUnreadNotificationCount,
} from "@/lib/data/phase3-notifications";

export const metadata: Metadata = { title: "Notifications" };
export const dynamic = "force-dynamic";

export default async function StudentNotificationsPage() {
  const [notifications, unreadCount, preferences] = await Promise.all([
    getMyNotifications(),
    getUnreadNotificationCount(),
    getNotificationPreferences(),
  ]);

  return (
    <div className="space-y-8">
      <Phase3Header
        kicker="For students / PE department"
        title="Notifications"
        description="Read department updates, filter unread messages and choose which channels you use for each kind of notice."
      />
      <NotificationCentre
        notifications={notifications}
        unreadCount={unreadCount}
        preferences={preferences.map((row) => ({
          category: row.category,
          channel: row.channel,
          enabled: row.enabled,
        }))}
      />
    </div>
  );
}
