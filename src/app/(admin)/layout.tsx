import { AdminShell } from "@/components/layout/admin-shell";
import { requirePeAdmin } from "@/lib/auth/session";
import { getStudentProfile } from "@/lib/data/student";

export const dynamic = "force-dynamic";

// Administrative screens are private and must never appear in search results.
export const metadata = { robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePeAdmin();
  const profile = await getStudentProfile(user);

  return <AdminShell userName={profile.fullName}>{children}</AdminShell>;
}
