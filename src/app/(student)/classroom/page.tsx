import type { Metadata } from "next";
import Link from "next/link";
import { CircleSlash2 } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getMyAttendance } from "@/lib/data/attendance";
import { getMyPeMembershipStatus } from "@/lib/data/student";
import { StudentAttendancePanel } from "@/components/classroom/student-attendance-panel";

export const metadata: Metadata = { title: "PE Classroom" };

export default async function ClassroomPage() {
  const user = await requireUser();
  const [membership, attendance] = await Promise.all([
    getMyPeMembershipStatus(user),
    getMyAttendance(user),
  ]);

  if (!membership.enrolled) {
    return (
      <div className="mx-auto max-w-3xl border-l-4 border-l-coral bg-card p-8">
        <CircleSlash2 className="size-8 text-coral-dark" />
        <h1 className="mt-5 text-4xl font-bold">PE classroom is roster-only</h1>
        <p className="mt-4 text-sm leading-relaxed text-ink-muted">
          Attendance is available only to students on the active PE roster. Your account is
          active, but no active PE membership is linked to your official record. Contact the
          PE office if this is incorrect.
        </p>
        <Link href="/dashboard" className="mt-6 inline-block text-sm font-bold text-cobalt underline">
          Back to dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="border-b-2 border-navy pb-5">
        <p className="eyebrow text-cobalt">Physical education / Classroom</p>
        <h1 className="mt-3 text-5xl font-bold leading-none sm:text-6xl">Today&apos;s class</h1>
        <p className="mt-3 max-w-2xl text-sm text-ink-muted">
          Submit your attendance only while the session is open. Every claim is reviewed by
          the PE department.
        </p>
      </section>
      <StudentAttendancePanel attendance={attendance} />
    </div>
  );
}
