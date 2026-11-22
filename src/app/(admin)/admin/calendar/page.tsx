import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, CalendarRange, FileEdit, Send, Sun } from "lucide-react";
import { Phase3Header, Phase3Metric, Phase3Notice, Phase3StatusBadge } from "@/components/phase3/common";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import {
  getAdminCalendarEvents,
  getTodayCalendarOccurrences,
  getUpcomingCalendarOccurrences,
} from "@/lib/data/phase3-calendar";
import { getDepartmentOptions } from "@/lib/data/admin";
import { getStudentGroups } from "@/lib/data/phase3-notifications";
import { getDirectoryStudents } from "@/lib/data/phase3-sports";
import { audienceLabel } from "@/lib/operations/phase3";
import { formatIstDateTime } from "@/lib/time/india";
import type { CalendarStatus } from "@/types/database";

export const metadata: Metadata = { title: "PE calendar administration" };

const STATUS_FILTERS: Array<{ value: CalendarStatus | "all"; label: string }> = [
  { value: "all", label: "All" },
  { value: "published", label: "Published" },
  { value: "draft", label: "Drafts" },
  { value: "archived", label: "Archived" },
];

function toneFor(status: CalendarStatus) {
  if (status === "published") return "good" as const;
  if (status === "archived") return "neutral" as const;
  return "warn" as const;
}

export default async function AdminCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const [{ status }, events, upcoming, today, departments, groups, students] = await Promise.all([
    searchParams,
    getAdminCalendarEvents(),
    getUpcomingCalendarOccurrences(8),
    getTodayCalendarOccurrences(),
    getDepartmentOptions(),
    getStudentGroups(),
    getDirectoryStudents(),
  ]);
  const activeFilter = STATUS_FILTERS.some((filter) => filter.value === status) ? status : "all";
  const visibleEvents = activeFilter === "all" ? events : events.filter((event) => event.status === activeFilter);
  const published = events.filter((event) => event.status === "published").length;

  const departmentNames = new Map(departments.map((department) => [department.id, department.name]));
  const groupNames = new Map(groups.map((group) => [group.id, group.name]));
  const studentNames = new Map(students.map((student) => [student.id, student.full_name]));

  return (
    <div className="space-y-8">
      <Phase3Header
        kicker="Phase 3 / Department management"
        title="Calendar desk"
        description="Plan PE classes, competitions and announcements. Occurrences are expanded in memory from recurrence rules — only overrides are stored."
        actions={
          <>
            <Button asChild variant="lime"><Link href="/admin/calendar/new">New event</Link></Button>
            <Button asChild variant="outline" className="border-chalk/40 text-chalk hover:bg-chalk/10 hover:text-chalk">
              <Link href="/calendar">Public calendar</Link>
            </Button>
          </>
        }
      />

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Calendar summary">
        <Phase3Metric label="Total events" value={events.length} detail="All statuses" icon={CalendarDays} />
        <Phase3Metric label="Published" value={published} detail="Visible under their audience rules" icon={Send} tone="lime" />
        <Phase3Metric label="Drafts" value={events.filter((event) => event.status === "draft").length} detail="Not shown to students" icon={FileEdit} tone="cobalt" />
        <Phase3Metric label="Today" value={today.length} detail="Occurrences starting today (IST)" icon={Sun} tone="coral" />
      </section>

      <Phase3Notice>
        {upcoming.length} upcoming occurrence{upcoming.length === 1 ? "" : "s"} in the next 120 days. Audience targeting and
        visibility are enforced by row-level security on the public calendar.
      </Phase3Notice>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b-2 border-navy pb-3">
          <div>
            <p className="eyebrow text-cobalt">Event register</p>
            <h2 className="mt-1 text-2xl font-bold">Department events</h2>
          </div>
          <nav className="flex flex-wrap gap-2" aria-label="Filter by status">
            {STATUS_FILTERS.map((filter) => (
              <Link
                key={filter.value}
                href={filter.value === "all" ? "/admin/calendar" : `/admin/calendar?status=${filter.value}`}
                className={`border px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.1em] transition-colors ${
                  activeFilter === filter.value
                    ? "border-navy bg-navy text-chalk"
                    : "border-navy/20 bg-white text-navy hover:border-navy"
                }`}
              >
                {filter.label}
              </Link>
            ))}
          </nav>
        </div>

        {visibleEvents.length === 0 ? (
          <EmptyState
            icon={CalendarRange}
            title="No events in this view"
            description="Create a published event with an audience to make it appear on the student and public calendars."
            action={<Button asChild variant="lime"><Link href="/admin/calendar/new">Create the first event</Link></Button>}
          />
        ) : (
          <div className="overflow-x-auto border border-navy/10 bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event</TableHead>
                  <TableHead>Starts (IST)</TableHead>
                  <TableHead>Venue</TableHead>
                  <TableHead>Audience</TableHead>
                  <TableHead>Visibility</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead aria-label="Edit" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleEvents.map((event) => (
                  <TableRow key={event.eventId}>
                    <TableCell>
                      <p className="text-sm font-bold">{event.title}</p>
                      <p className="mt-1 text-[11px] uppercase tracking-wide text-ink-muted">
                        {event.category.replaceAll("_", " ")}
                        {event.recurrence ? " · repeating" : ""}
                      </p>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs">{formatIstDateTime(event.startsAt)}</TableCell>
                    <TableCell className="text-xs">{event.venue ?? "—"}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {event.audiences.length === 0 ? (
                          <span className="text-xs text-ink-muted">No audience</span>
                        ) : (
                          event.audiences.map((audience, index) => (
                            <span key={index} className="border border-navy/10 bg-chalk/50 px-2 py-1 text-[11px]">
                              {audienceLabel(
                                audience,
                                audience.departmentId ? departmentNames.get(audience.departmentId) : null,
                                audience.studentDirectoryId ? studentNames.get(audience.studentDirectoryId) : null,
                                audience.groupId ? groupNames.get(audience.groupId) : null,
                              )}
                            </span>
                          ))
                        )}
                      </div>
                    </TableCell>
                    <TableCell><Phase3StatusBadge label={event.visibility} tone={event.visibility === "public" ? "good" : "info"} /></TableCell>
                    <TableCell><Phase3StatusBadge label={event.status} tone={toneFor(event.status)} /></TableCell>
                    <TableCell className="text-right">
                      <Button asChild size="sm" variant="outline"><Link href={`/admin/calendar/${event.eventId}`}>Edit</Link></Button>
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
