import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, CalendarDays } from "lucide-react";
import { CreateAttendanceSession } from "@/components/attendance/create-attendance-session";
import { EmptyState } from "@/components/shared/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { getAttendanceSessions } from "@/lib/data/attendance";
import { formatIstDate, formatIstTime } from "@/lib/time/india";

export const metadata: Metadata = { title: "Attendance sessions" };

export default async function AttendanceSessionsPage() {
  const sessions = await getAttendanceSessions();

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-4 border-b-2 border-navy pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow text-cobalt">Classroom / Attendance</p>
          <h1 className="mt-3 text-5xl font-bold leading-none sm:text-6xl">Sessions</h1>
          <p className="mt-3 text-sm text-ink-muted">
            Create, open and finalise PE attendance sessions. All decisions are audited.
          </p>
        </div>
        <CreateAttendanceSession />
      </section>

      {sessions.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="No attendance sessions yet"
          description="Create a session to capture the current active PE roster and begin attendance."
        />
      ) : (
        <div className="overflow-x-auto border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Session</TableHead>
                <TableHead>Class date</TableHead>
                <TableHead>Time (IST)</TableHead>
                <TableHead>Eligible</TableHead>
                <TableHead>Status</TableHead>
                <TableHead aria-label="Open" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.map((session) => (
                <TableRow key={session.id}>
                  <TableCell className="font-bold">{session.title}</TableCell>
                  <TableCell>{formatIstDate(session.classDate)}</TableCell>
                  <TableCell className="text-xs text-ink-muted">
                    {formatIstTime(session.startsAt)} – {formatIstTime(session.expectedEndsAt)}
                  </TableCell>
                  <TableCell className="tabular-nums">{session.eligibleCount}</TableCell>
                  <TableCell>
                    <Badge variant={session.status === "open" ? "lime" : session.status === "finalised" ? "cobalt" : "muted"}>
                      {session.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/admin/classroom/attendance/${session.id}`}
                      className="inline-flex items-center gap-1 text-xs font-bold text-cobalt hover:underline"
                    >
                      Open board <ArrowUpRight className="size-3" />
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
