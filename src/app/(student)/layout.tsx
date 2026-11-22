import { StudentShell } from "@/components/layout/student-shell";
import { requireUser } from "@/lib/auth/session";
import { getStudentProfile } from "@/lib/data/student";

export const dynamic = "force-dynamic";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const profile = await getStudentProfile(user);

  return <StudentShell profile={profile}>{children}</StudentShell>;
}
