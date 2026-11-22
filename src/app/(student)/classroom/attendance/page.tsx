import type { Metadata } from "next";
import { CalendarCheck } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getMyAttendance } from "@/lib/data/attendance";
import { getMyPeMembershipStatus } from "@/lib/data/student";
import { AttendanceBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatIstDate } from "@/lib/time/india";
import { submissionLabel } from "@/lib/operations/attendance";

export const metadata: Metadata = { title: "My attendance" };

export default async function AttendanceHistoryPage() {
  const user = await requireUser();
  const [membership, attendance] = await Promise.all([
    getMyPeMembershipStatus(user),
    getMyAttendance(user),
  ]);

  if (!membership.enrolled) {
    return (
      <EmptyState
        icon={CalendarCheck}
        title="PE attendance is not available"
        description="Only active PE roster students have classroom attendance records."
      />
    );
  }

  const counters = [
    { label: "Present", value: attendance.present },
    { label: "Represented", value: attendance.represented },
    { label: "Absent", value: attendance.absent },
    { label: "Excused", value: attendance.excused },
    { label: "Attendance %", value: `${attendance.percentage}%` },
  ];

  return (
    <div className="space-y-8">
      <section className="border-b-2 border-navy pb-5">
        <p className="eyebrow text-cobalt">Physical education / Attendance</p>
        <h1 className="mt-3 text-5xl font-bold leading-none sm:text-6xl">My record</h1>
      </section>

      <div className="grid gap-px border border-border bg-border sm:grid-cols-3 lg:grid-cols-5">
        {counters.map((counter) => (
          <div key={counter.label} className="bg-card p-5">
            <p className="eyebrow text-ink-muted">{counter.label}</p>
            <p className="stat-number mt-3 text-4xl">{counter.value}</p>
          </div>
        ))}
      </div>

      <section>
        <h2 className="mb-4 border-b-2 border-navy pb-3 text-2xl font-bold">Session history</h2>
        {attendance.history.length === 0 ? (
          <EmptyState
            icon={CalendarCheck}
            title="No attendance history yet"
            description="Completed attendance sessions will appear here with final verification status."
          />
        ) : (
          <div className="overflow-x-auto border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Session</TableHead>
                  <TableHead>Class date</TableHead>
                  <TableHead>Claim</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Verified</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attendance.history.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-bold">{entry.title}</TableCell>
                    <TableCell>{formatIstDate(entry.classDate)}</TableCell>
                    <TableCell>{submissionLabel(entry.submittedType)}</TableCell>
                    <TableCell><AttendanceBadge status={entry.status} /></TableCell>
                    <TableCell className="text-xs text-ink-muted">
                      {entry.reviewedAt ? formatIstDate(entry.reviewedAt) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  );
}
