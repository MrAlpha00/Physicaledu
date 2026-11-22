import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AttendanceBoard } from "@/components/attendance/attendance-board";
import { getAttendanceSessionDetail } from "@/lib/data/attendance";
import { getDepartmentOptions } from "@/lib/data/admin";

export const metadata: Metadata = { title: "Attendance board" };

export default async function AttendanceSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const [detail, departments] = await Promise.all([
    getAttendanceSessionDetail(sessionId),
    getDepartmentOptions(),
  ]);
  if (!detail || !detail.session) notFound();

  return (
    <div className="space-y-8">
      <Link
        href="/admin/classroom/attendance"
        className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.1em] text-ink-muted hover:text-cobalt"
      >
        <ArrowLeft className="size-3" /> All sessions
      </Link>
      <AttendanceBoard
        session={detail.session}
        records={detail.records}
        overview={detail.overview}
        departments={departments.map((department) => ({
          id: department.id,
          code: department.code,
          name: department.name,
        }))}
      />
    </div>
  );
}
