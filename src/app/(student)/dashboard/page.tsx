import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, CalendarDays, CircleCheck, CircleSlash2, GraduationCap, IdCard, LogOut, Settings2, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { signOutAction } from "@/app/auth/actions";
import { requireUser } from "@/lib/auth/session";
import { getMyPeMembershipStatus, getStudentProfile } from "@/lib/data/student";
import { getMyAttendance } from "@/lib/data/attendance";
import { getMyTasks } from "@/lib/data/tasks";
import { formatDate, initials } from "@/lib/utils";
import { VerificationBadge } from "@/components/shared/status-badge";

export const metadata: Metadata = { title: "Dashboard" };

export default async function StudentDashboardPage() {
  const user = await requireUser();
  const [profile, membership] = await Promise.all([
    getStudentProfile(user),
    getMyPeMembershipStatus(user),
  ]);
  const [attendance, tasks] = membership.enrolled
    ? await Promise.all([getMyAttendance(user), getMyTasks(user)])
    : [null, []];

  const metrics = [
    {
      label: "USN",
      value: profile.directory?.usn ?? "Not linked",
      detail: profile.directory ? "Official record" : "Awaiting directory match",
      icon: IdCard,
    },
    {
      label: "Department",
      value: profile.directory?.departmentCode ?? "—",
      detail: profile.directory?.departmentName ?? "No linked record",
      icon: GraduationCap,
    },
    {
      label: "Academic year",
      value: profile.directory ? String(profile.directory.academicYear) : "—",
      detail: profile.directory ? `Semester ${profile.directory.semester}` : "No linked record",
      icon: CalendarDays,
    },
  ];

  return (
    <div className="space-y-10">
      {/* WELCOME */}
      <section className="relative overflow-hidden bg-navy px-6 py-10 text-chalk sm:px-9 sm:py-12">
        <div className="track-lines absolute inset-0 opacity-40" aria-hidden="true" />
        <div className="relative flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="eyebrow text-lime">Student dashboard / Account overview</p>
            <h1 className="mt-4 text-5xl font-bold leading-[0.9] sm:text-7xl">
              Welcome back,
              <br />
              <span className="text-lime">{profile.fullName.split(" ")[0]}.</span>
            </h1>
            <p className="mt-5 max-w-xl text-sm leading-relaxed text-chalk/70">
              Your college account, official record and PE membership status — pulled
              live from the department system.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="lime">
              <Link href="/profile">
                Profile settings <Settings2 />
              </Link>
            </Button>
            <form action={signOutAction}>
              <Button
                type="submit"
                variant="outline"
                className="border-chalk/30 bg-transparent text-chalk hover:bg-chalk/10"
              >
                <LogOut /> Sign out
              </Button>
            </form>
          </div>
        </div>
      </section>

      {/* SCOREBOARD METRICS */}
      <section aria-label="Student record summary">
        <div className="grid gap-px border border-border bg-border sm:grid-cols-3">
          {metrics.map(({ label, value, detail, icon: Icon }) => (
            <div key={label} className="bg-card p-6">
              <div className="flex items-center justify-between">
                <span className="eyebrow text-ink-muted">{label}</span>
                <Icon className="size-4 text-cobalt" />
              </div>
              <p className="stat-number mt-4 text-4xl">{value}</p>
              <p className="mt-2 truncate text-xs text-ink-muted">{detail}</p>
            </div>
          ))}
        </div>
      </section>

      {membership.enrolled && attendance ? (
        <section aria-label="PE classroom summary">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b-2 border-navy pb-3">
            <div>
              <p className="eyebrow text-cobalt">PE classroom</p>
              <h2 className="mt-2 text-2xl font-bold">Your PE activity</h2>
            </div>
            <p className="text-xs text-ink-muted">
              {attendance.session ? `Current session: ${attendance.session.title}` : "No open PE session"}
            </p>
          </div>
          <div className="grid gap-px border border-border bg-border sm:grid-cols-2 xl:grid-cols-4">
            <div className="bg-card p-5">
              <span className="eyebrow text-ink-muted">Attendance</span>
              <p className="stat-number mt-3 text-4xl">{attendance.percentage}%</p>
              <p className="mt-2 text-xs text-ink-muted">
                {attendance.present} present · {attendance.absent} absent
              </p>
            </div>
            <div className="bg-card p-5">
              <span className="eyebrow text-ink-muted">Current status</span>
              <p className="mt-3 font-heading text-3xl font-bold uppercase">
                {attendance.status?.replace(/_/g, " ") ?? "No record"}
              </p>
              <p className="mt-2 text-xs text-ink-muted">Asia/Kolkata class day</p>
            </div>
            <div className="bg-card p-5">
              <span className="eyebrow text-ink-muted">Tasks assigned</span>
              <p className="stat-number mt-3 text-4xl">{tasks.length}</p>
              <p className="mt-2 text-xs text-ink-muted">
                {tasks.filter((task) => task.submission === null).length} awaiting a response
              </p>
            </div>
            <div className="bg-card p-5">
              <span className="eyebrow text-ink-muted">QR tools</span>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link href="/scan" className="text-xs font-bold text-cobalt hover:underline">Scan a PE QR →</Link>
                <Link href="/classroom/attendance" className="text-xs font-bold text-cobalt hover:underline">Attendance →</Link>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-[1.25fr_0.75fr]">
        {/* PE MEMBERSHIP */}
        <section>
          <div className="mb-4 flex items-center justify-between border-b-2 border-navy pb-3">
            <h2 className="text-2xl font-bold">PE membership</h2>
            <span className="eyebrow text-ink-muted">Roster status</span>
          </div>

          {membership.enrolled ? (
            <div className="border-l-4 border-l-[#8fb63c] bg-lime/50 p-6 sm:p-8">
              <div className="flex items-start gap-4">
                <div className="flex size-12 shrink-0 items-center justify-center bg-navy text-lime">
                  <CircleCheck className="size-6" />
                </div>
                <div>
                  <Badge variant="lime">Enrolled</Badge>
                  <h3 className="mt-3 text-3xl font-bold">You are a PE student</h3>
                  <p className="mt-3 max-w-lg text-sm leading-relaxed text-navy/75">
                    Your official record is on the active PE roster. You are eligible for
                    PE classroom activities managed by the department.
                  </p>
                  <p className="mt-4 text-xs font-bold uppercase tracking-[0.1em] text-navy/60">
                    Added on {formatDate(membership.enrolledAt)}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="border-l-4 border-l-cobalt bg-navy p-6 text-chalk sm:p-8">
              <div className="flex items-start gap-4">
                <div className="flex size-12 shrink-0 items-center justify-center bg-chalk/10 text-lime">
                  <CircleSlash2 className="size-6" />
                </div>
                <div>
                  <Badge variant="muted">Not enrolled</Badge>
                  <h3 className="mt-3 text-3xl font-bold">Normal student account</h3>
                  <p className="mt-3 max-w-lg text-sm leading-relaxed text-chalk/70">
                    You have a college student account, but you are not on the PE class
                    roster. PE classroom functionality is available only to students
                    enrolled by the Physical Education department.
                  </p>
                  <p className="mt-4 text-xs font-bold uppercase tracking-[0.1em] text-chalk/50">
                    Contact the PE office if you believe this is incorrect
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="mt-5 border border-dashed border-border bg-card/60 p-5">
            <p className="eyebrow text-ink-muted">How membership works</p>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">
              Registration gives you a student account. The PE department separately
              adds eligible students to the official PE roster. Your status above
              reflects the real roster record, not an assumption based on registration.
            </p>
          </div>
        </section>

        {/* PROFILE SUMMARY */}
        <section>
          <div className="mb-4 flex items-center justify-between border-b-2 border-navy pb-3">
            <h2 className="text-2xl font-bold">My profile</h2>
            <ShieldCheck className="size-5 text-cobalt" />
          </div>
          <div className="border border-navy/15 bg-card">
            <div className="flex items-center gap-4 border-b border-border p-6">
              <div className="flex size-14 items-center justify-center bg-navy font-heading text-2xl font-bold text-lime">
                {initials(profile.fullName)}
              </div>
              <div className="min-w-0">
                <p className="truncate font-heading text-2xl font-semibold uppercase leading-none">
                  {profile.fullName}
                </p>
                <p className="mt-2 truncate text-xs text-ink-muted">{profile.email}</p>
              </div>
            </div>
            <dl className="divide-y divide-border/70 px-6 text-sm">
              <div className="flex items-center justify-between gap-4 py-4">
                <dt className="text-ink-muted">Verification</dt>
                <dd><VerificationBadge status={profile.verificationStatus} /></dd>
              </div>
              <div className="flex items-center justify-between gap-4 py-4">
                <dt className="text-ink-muted">Account</dt>
                <dd className="font-bold capitalize">{profile.accountStatus}</dd>
              </div>
              <div className="flex items-center justify-between gap-4 py-4">
                <dt className="text-ink-muted">Member since</dt>
                <dd className="font-bold">{formatDate(profile.createdAt)}</dd>
              </div>
            </dl>
            <div className="border-t border-border p-5">
              <Button asChild variant="outline" className="w-full">
                <Link href="/profile">
                  Open profile settings <ArrowUpRight />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
