import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EventForm } from "@/components/phase4/event-form";
import { EventStatusControl } from "@/components/phase4/admin-controls";
import { Phase4Header, Phase4Section, Phase4StatusBadge } from "@/components/phase4/common";
import { Button } from "@/components/ui/button";
import { getAdminEvent, getAdminSports, getPublicFiles } from "@/lib/data/phase4";

export const metadata: Metadata = { title: "Manage event" };
export const dynamic = "force-dynamic";

export default async function AdminEventDetailPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const event = await getAdminEvent(eventId);
  if (!event) notFound();
  const [sports, files] = await Promise.all([
    getAdminSports(eventId),
    getPublicFiles([event.banner_file_id, event.logo_file_id]),
  ]);
  const banner = files.find((file) => file.id === event.banner_file_id);
  const logo = files.find((file) => file.id === event.logo_file_id);

  return (
    <div className="space-y-8">
      <Phase4Header
        kicker="Phase 4 / Events"
        title={event.name}
        description={`/${event.slug} · ${event.academic_year} · ${event.venue ?? "Venue to be confirmed"}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline"><Link href="/admin/events">All events</Link></Button>
            <Button asChild variant="lime"><Link href={`/admin/events/${eventId}/sports`}>Manage competitions</Link></Button>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="border border-navy/10 bg-white p-6"><EventForm event={event} /></div>
        <div className="space-y-6">
          <div className="border border-navy/10 bg-white p-5">
            <p className="eyebrow">Current status</p>
            <div className="mt-2"><Phase4StatusBadge label={event.status} /></div>
            <p className="mt-4 whitespace-pre-wrap text-sm text-ink-muted">{event.description ?? "No description provided."}</p>
            <div className="mt-4 space-y-1 text-xs text-ink-muted">
              <p>Registration closes: {event.registration_closes_at ? new Date(event.registration_closes_at).toLocaleString() : "—"}</p>
              <p>Contact: {event.contact_information ?? "—"}</p>
            </div>
          </div>
          <div className="border border-navy/10 bg-white p-5">
            <p className="eyebrow mb-4">Workflow control</p>
            <EventStatusControl eventId={event.id} status={event.status} />
          </div>
          <div className="border border-navy/10 bg-white p-5">
            <p className="eyebrow mb-3">Public assets</p>
            {banner ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/api/phase4/files/${banner.id}/download`} alt="Event banner" className="h-28 w-full object-cover" />
            ) : <p className="text-xs text-ink-muted">No banner attached.</p>}
            {logo ? <p className="mt-2 text-xs text-cobalt">Logo attached · <a href={`/api/phase4/files/${logo.id}/download`}>download</a></p> : null}
          </div>
        </div>
      </div>

      <Phase4Section
        title="Competitions"
        description={`${sports.length} competition(s) in this event.`}
        action={<Button asChild size="sm" variant="outline"><Link href={`/admin/events/${eventId}/sports`}>Add competition</Link></Button>}
      >
        {sports.length === 0 ? (
          <p className="border border-dashed border-navy/25 bg-white p-8 text-center text-sm text-ink-muted">No competitions have been added yet.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {sports.map((sport) => (
              <div key={sport.id} className="border border-navy/10 bg-white p-4 transition hover:border-cobalt">
                <div className="flex items-center justify-between gap-2"><Link href={`/admin/events/${eventId}/sports/${sport.id}`} className="font-barlow text-xl uppercase hover:text-cobalt">{sport.name}</Link><Phase4StatusBadge label={sport.status} /></div>
                <p className="mt-1 text-xs capitalize text-ink-muted">{sport.mode} · {sport.tournament_format.replaceAll("_", " ")}</p>
                <div className="mt-4 flex gap-2 text-[0.65rem] font-bold uppercase text-cobalt">
                  <Link href={`/admin/events/${eventId}/sports/${sport.id}/registrations`}>Entries</Link>
                  <span>·</span>
                  <Link href={`/admin/events/${eventId}/sports/${sport.id}/tournament`}>Draw</Link>
                  <span>·</span>
                  <Link href={`/admin/events/${eventId}/sports/${sport.id}/matches`}>Matches</Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </Phase4Section>
    </div>
  );
}
