import type { Metadata } from "next";
import Link from "next/link";
import { IdCard, LockKeyhole, LogOut } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProfileNameForm } from "@/components/forms/profile-name-form";
import { signOutAction } from "@/app/auth/actions";
import { requireUser } from "@/lib/auth/session";
import { getMyPeMembershipStatus, getStudentProfile } from "@/lib/data/student";
import { formatDate, initials } from "@/lib/utils";
import {
  AccountStatusBadge,
  MembershipBadge,
  VerificationBadge,
} from "@/components/shared/status-badge";

export const metadata: Metadata = { title: "My profile" };

export default async function ProfilePage() {
  const user = await requireUser();
  const [profile, membership] = await Promise.all([
    getStudentProfile(user),
    getMyPeMembershipStatus(user),
  ]);

  const details = [
    ["USN", profile.directory?.usn ?? "Not linked to a directory record"],
    ["Department", profile.directory ? `${profile.directory.departmentCode} — ${profile.directory.departmentName}` : "—"],
    ["Academic year", profile.directory ? String(profile.directory.academicYear) : "—"],
    ["Semester", profile.directory ? String(profile.directory.semester) : "—"],
    ["Official email", profile.directory?.officialEmail ?? "—"],
    ["Account email", profile.email],
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 border-b-2 border-navy pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow text-cobalt">Student / Profile settings</p>
          <h1 className="mt-3 text-5xl font-bold leading-none">My profile</h1>
        </div>
        <Button asChild variant="outline">
          <Link href="/dashboard">Back to dashboard</Link>
        </Button>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_0.75fr]">
        <section className="space-y-8">
          <div className="border border-navy/15 bg-card">
            <div className="flex items-center gap-5 border-b border-border p-6">
              <div className="flex size-16 items-center justify-center bg-navy font-heading text-3xl font-bold text-lime">
                {initials(profile.fullName)}
              </div>
              <div>
                <h2 className="text-2xl font-bold">{profile.fullName}</h2>
                <div className="mt-2 flex flex-wrap gap-2">
                  <VerificationBadge status={profile.verificationStatus} />
                  <AccountStatusBadge status={profile.accountStatus} />
                  <MembershipBadge status={membership.enrolled ? "active" : null} />
                </div>
              </div>
            </div>
            <dl className="grid gap-px bg-border sm:grid-cols-2">
              {details.map(([label, value]) => (
                <div key={label} className="bg-card p-5">
                  <dt className="eyebrow text-ink-muted">{label}</dt>
                  <dd className="mt-2 break-words text-sm font-bold text-navy">{value}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="border border-navy/15 bg-card p-6">
            <h2 className="text-2xl font-bold">Update display name</h2>
            <p className="mt-2 text-sm text-ink-muted">
              Change how your name appears across the platform.
            </p>
            <div className="mt-6">
              <ProfileNameForm initialName={profile.fullName} />
            </div>
          </div>
        </section>

        <aside className="space-y-6">
          <div className="border-l-4 border-l-cobalt bg-navy p-6 text-chalk">
            <IdCard className="size-6 text-lime" />
            <h2 className="mt-4 text-2xl font-bold">Account controls</h2>
            <p className="mt-2 text-sm leading-relaxed text-chalk/70">
              Member since {formatDate(profile.createdAt)}. Your account permissions
              are managed at the database level.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {profile.roles.map((role) => (
                <Badge key={role} variant={role === "pe_admin" ? "lime" : "default"}>
                  {role.replace("_", " ")}
                </Badge>
              ))}
            </div>
            <form action={signOutAction} className="mt-7">
              <Button
                type="submit"
                variant="outline"
                className="w-full border-chalk/30 bg-transparent text-chalk hover:bg-chalk/10"
              >
                <LogOut /> Sign out
              </Button>
            </form>
          </div>

          <div className="border border-border bg-card p-6">
            <LockKeyhole className="size-5 text-coral-dark" />
            <h2 className="mt-3 text-xl font-bold">Protected fields</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">
              Your verification status, roles, USN and PE membership cannot be changed
              from your account. Contact the PE office for corrections.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
