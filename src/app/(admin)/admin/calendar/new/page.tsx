import type { Metadata } from "next";
import Link from "next/link";
import { Phase3Header } from "@/components/phase3/common";
import { CalendarEventForm } from "@/components/phase3/calendar/calendar-event-form";
import { Button } from "@/components/ui/button";
import { getDepartmentOptions } from "@/lib/data/admin";
import { getStudentGroups } from "@/lib/data/phase3-notifications";
import { getDirectoryStudents } from "@/lib/data/phase3-sports";

export const metadata: Metadata = { title: "New calendar event" };

export default async function NewCalendarEventPage() {
  const [departments, groups, students] = await Promise.all([
    getDepartmentOptions(),
    getStudentGroups(),
    getDirectoryStudents(),
  ]);

  return (
    <div className="space-y-8">
      <Phase3Header
        kicker="Phase 3 / Calendar"
        title="New event"
        description="Set the schedule, audience and visibility. A bounded preview shows generated dates before anything is saved."
        actions={<Button asChild variant="outline" className="border-chalk/40 text-chalk hover:bg-chalk/10 hover:text-chalk"><Link href="/admin/calendar">Back to calendar</Link></Button>}
      />
      <CalendarEventForm
        initial={null}
        departments={departments}
        groups={groups.map((group) => ({ id: group.id, name: group.name, isActive: group.isActive }))}
        students={students.map((student) => ({
          id: student.id,
          full_name: student.full_name,
          department_id: student.department_id,
          semester: student.semester ?? null,
        }))}
        overrides={[]}
      />
    </div>
  );
}
