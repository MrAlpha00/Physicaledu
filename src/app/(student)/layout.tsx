import { StudentShell } from "@/components/layout/student-shell";
import { requireUser } from "@/lib/auth/session";
import { getMyPeMembershipStatus, getStudentProfile } from "@/lib/data/student";

export const dynamic = "force-dynamic";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [profile, membership] = await Promise.all([
    getStudentProfile(user),
    getMyPeMembershipStatus(user),
  ]);

  return (
    <StudentShell profile={profile} isPeStudent={membership.enrolled}>
      {children}
    </StudentShell>
  );
}
