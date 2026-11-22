import type { Metadata } from "next";
import Link from "next/link";
import { CalendarBoard } from "@/components/phase3/calendar/calendar-board";
import { Phase3Header, Phase3Notice } from "@/components/phase3/common";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/session";
import { getCalendarOccurrences } from "@/lib/data/phase3-calendar";
import { istDateString, istDayStart } from "@/lib/time/india";

export const metadata: Metadata = { title: "PE activity calendar" };
export const dynamic = "force-dynamic";

export default async function PublicCalendarPage() {
  const user = await getCurrentUser();
  const today = istDateString();
  const from = istDayStart(`${today.slice(0, 7)}-01`);
  const to = new Date(from.getTime() + 150 * 24 * 60 * 60 * 1000);
  const occurrences = await getCalendarOccurrences(from, to);

  // RLS is the security boundary; this extra pass keeps the response minimal
  // and guarantees guests and students never receive drafts or private fields.
  const visible = occurrences
    .filter((occurrence) => occurrence.status === "published" && !occurrence.isCancelled)
    .filter((occurrence) => (user ? true : occurrence.visibility === "public"))
    .map(({ occurrenceId, eventId, title, startsAt, endsAt, venue, category, isOverride }) => ({
      occurrenceId,
      eventId,
      title,
      startsAt,
      endsAt,
      venue,
      category,
      isOverride,
    }));

  return (
    <div className="space-y-8">
      <Phase3Header
        kicker={user ? "For students / Department schedule" : "Public / Department schedule"}
        title="PE calendar"
        description={
          user
            ? "Classes, practices and department activities available to your account. Times are shown in India Standard Time."
            : "Public PE activities open to everyone. Sign in to see events shared with registered students."
        }
        actions={
          user ? (
            <Button asChild variant="lime"><Link href="/dashboard">My dashboard</Link></Button>
          ) : (
            <>
              <Button asChild variant="lime"><Link href="/login?next=/calendar">Sign in</Link></Button>
              <Button asChild variant="outline" className="border-chalk/40 text-chalk hover:bg-chalk/10 hover:text-chalk">
                <Link href="/register">Register</Link>
              </Button>
            </>
          )
        }
      />

      <Phase3Notice>
        {user
          ? "Showing published events your account is eligible for. Ask the PE office if an expected event is missing."
          : "Guest view: only public, published events are listed here."}
      </Phase3Notice>

      <CalendarBoard occurrences={visible} />
    </div>
  );
}
