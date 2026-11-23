import type { Metadata } from "next";
import Link from "next/link";
import { CalendarRange, LayoutDashboard, Plus } from "lucide-react";
import { Phase4Empty, Phase4Header, Phase4Section, Phase4StatusBadge } from "@/components/phase4/common";
import { Button } from "@/components/ui/button";
import { getAdminEvents } from "@/lib/data/phase4";

export const metadata: Metadata = { title: "Sports events" };
export const dynamic = "force-dynamic";

export default async function AdminEventsPage() {
  const events = await getAdminEvents();
  return (
    <div className="space-y-8">
      <Phase4Header
        kicker="Phase 4 / Events"
        title="Sports events"
        description="Create events, configure unlimited competitions, manage registrations and payments, and publish verified results."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline"><Link href="/admin/events/dashboard"><LayoutDashboard /> Dashboard</Link></Button>
            <Button asChild variant="lime"><Link href="/admin/events/new"><Plus /> New event</Link></Button>
          </div>
        }
      />
      <Phase4Section title="All events" description={`${events.length} event(s) in the current workspace.`}>
        {events.length === 0 ? (
          <Phase4Empty title="No events yet" description="Create the first sports event to begin configuring competitions." />
        ) : (
          <div className="overflow-x-auto border border-navy/10 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-navy text-xs uppercase tracking-[0.1em] text-chalk">
                <tr><th className="px-4 py-3">Event</th><th className="px-4 py-3">Dates</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Visibility</th><th className="px-4 py-3" /></tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr key={event.id} className="border-t border-navy/10">
                    <td className="px-4 py-3"><Link href={`/admin/events/${event.id}`} className="font-bold text-navy hover:text-cobalt">{event.name}</Link><p className="text-xs text-ink-muted">/{event.slug} · {event.academic_year}</p></td>
                    <td className="px-4 py-3 text-xs text-ink-muted">{event.starts_on ?? "—"} → {event.ends_on ?? "—"}</td>
                    <td className="px-4 py-3"><Phase4StatusBadge label={event.status} /></td>
                    <td className="px-4 py-3 text-xs">{event.is_public ? "Public" : "Private"}</td>
                    <td className="px-4 py-3"><Button asChild size="sm" variant="outline"><Link href={`/admin/events/${event.id}`}>Manage</Link></Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Phase4Section>
      <p className="flex items-center gap-2 text-xs text-ink-muted"><CalendarRange className="size-4" /> Event status changes are mirrored to the Phase 3 PE calendar where a calendar link exists.</p>
    </div>
  );
}
