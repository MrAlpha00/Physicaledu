import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Phase3Header, Phase3StatusBadge } from "@/components/phase3/common";
import { CalendarEventForm, type CalendarEventInitialValue } from "@/components/phase3/calendar/calendar-event-form";
import { Button } from "@/components/ui/button";
import { getDepartmentOptions } from "@/lib/data/admin";
import { getStudentGroups } from "@/lib/data/phase3-notifications";
import { getDirectoryStudents } from "@/lib/data/phase3-sports";
import { getAdminCalendarEvents } from "@/lib/data/phase3-calendar";
import { createClient } from "@/lib/supabase/server";
import { toIstLocalInput } from "@/lib/time/india";
import type { Phase3CalendarOverrideRow } from "@/types/database";

export const metadata: Metadata = { title: "Edit calendar event" };

export default async function EditCalendarEventPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const [events, departments, groups, students, supabase] = await Promise.all([
    getAdminCalendarEvents(),
    getDepartmentOptions(),
    getStudentGroups(),
    getDirectoryStudents(),
    createClient(),
  ]);
  const event = events.find((item) => item.eventId === eventId);
  if (!event) notFound();

  const [rawResult, overridesResult] = await Promise.all([
    supabase
      .from("pe_calendar_events")
      .select("is_recurring, attachment_file_id")
      .eq("id", eventId)
      .maybeSingle(),
    event.ruleId
      ? supabase
          .from("calendar_event_overrides")
          .select("*")
          .eq("rule_id", event.ruleId)
          .order("occurrence_starts_at", { ascending: true })
      : Promise.resolve({ data: [] as Phase3CalendarOverrideRow[] }),
  ]);

  const initial: CalendarEventInitialValue = {
    id: event.eventId,
    ruleId: event.ruleId,
    title: event.title,
    description: event.description ?? "",
    category: event.category,
    startsAt: toIstLocalInput(event.startsAt),
    endsAt: toIstLocalInput(event.endsAt),
    venue: event.venue ?? "",
    visibility: event.visibility,
    status: event.status,
    isRecurring: rawResult.data?.is_recurring ?? Boolean(event.recurrence),
    attachmentFileId: rawResult.data?.attachment_file_id ?? "",
    audiences: event.audiences,
    recurrence: event.recurrence,
  };

  return (
    <div className="space-y-8">
      <Phase3Header
        kicker="Phase 3 / Calendar"
        title="Edit event"
        description="Changes replace the event audiences and rebuild the recurrence rule. Saved occurrence overrides are cleared when the rule is rebuilt."
        actions={
          <>
            <Phase3StatusBadge label={event.status} tone={event.status === "published" ? "good" : "warn"} />
            <Button asChild variant="outline" className="border-chalk/40 text-chalk hover:bg-chalk/10 hover:text-chalk">
              <Link href="/admin/calendar">Back to calendar</Link>
            </Button>
          </>
        }
      />
      <CalendarEventForm
        initial={initial}
        departments={departments}
        groups={groups.map((group) => ({ id: group.id, name: group.name, isActive: group.isActive }))}
        students={students.map((student) => ({
          id: student.id,
          full_name: student.full_name,
          department_id: student.department_id,
          semester: student.semester ?? null,
        }))}
        overrides={overridesResult.data ?? []}
      />
    </div>
  );
}
