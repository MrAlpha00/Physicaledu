import { AdminShell } from "@/components/layout/admin-shell";
import { requirePeAdmin } from "@/lib/auth/session";
import { getStudentProfile } from "@/lib/data/student";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePeAdmin();
  const profile = await getStudentProfile(user);

  return <AdminShell userName={profile.fullName}>{children}</AdminShell>;
}
