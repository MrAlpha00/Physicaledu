import { StudentShell } from "@/components/layout/student-shell";
import { requireUser } from "@/lib/auth/session";
import { getMyPeMembershipStatus, getStudentProfile } from "@/lib/data/student";
import { getUnreadNotificationCount } from "@/lib/data/phase3-notifications";

export const dynamic = "force-dynamic";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [profile, membership, unreadResult] = await Promise.all([
    getStudentProfile(user),
    getMyPeMembershipStatus(user),
    getUnreadNotificationCount().then(
      (count) => ({ count }),
      () => ({ count: 0 }),
    ),
  ]);

  return (
    <StudentShell
      profile={profile}
      isPeStudent={membership.enrolled}
      unreadNotifications={unreadResult.count}
    >
      {children}
    </StudentShell>
  );
}
