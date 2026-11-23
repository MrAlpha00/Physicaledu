import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, Mail, MapPin } from "lucide-react";
import { Phase4Header, Phase4Section, Phase4StatusBadge } from "@/components/phase4/common";
import { getPublicEvent, getPublicFiles, getPublicSports } from "@/lib/data/phase4";

export const metadata: Metadata = { title: "Sports event" };
export const dynamic = "force-dynamic";

export default async function PublicEventPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const event = await getPublicEvent(slug);
  if (!event) notFound();
  const [sports, files] = await Promise.all([getPublicSports(event.id), getPublicFiles([event.banner_file_id, event.logo_file_id])]);
  const banner = files.find((file) => file.id === event.banner_file_id);

  return (
    <div className="mx-auto max-w-7xl space-y-10 px-5 py-10 sm:px-8">
      <Link href="/events" className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.1em] text-ink-muted hover:text-navy"><ArrowLeft className="size-4" /> All events</Link>
      {banner ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/api/phase4/files/${banner.id}/download`} alt={`${event.name} banner`} className="h-64 w-full object-cover" />
      ) : null}
      <Phase4Header
        kicker={`${event.academic_year} / Sports event`}
        title={event.name}
        description={event.description ?? "Event details are being prepared."}
        actions={<Phase4StatusBadge label={event.status} />}
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="border border-navy/10 bg-white p-4"><CalendarDays className="size-5 text-cobalt" /><p className="mt-2 text-xs font-bold uppercase text-ink-muted">Dates</p><p className="text-sm">{event.starts_on ?? "TBA"} → {event.ends_on ?? "TBA"}</p></div>
        <div className="border border-navy/10 bg-white p-4"><MapPin className="size-5 text-cobalt" /><p className="mt-2 text-xs font-bold uppercase text-ink-muted">Venue</p><p className="text-sm">{event.venue ?? "TBA"}</p></div>
        <div className="border border-navy/10 bg-white p-4"><Mail className="size-5 text-cobalt" /><p className="mt-2 text-xs font-bold uppercase text-ink-muted">Contact</p><p className="text-sm break-words">{event.contact_information ?? "PE Department"}</p></div>
      </div>
      {event.instructions ? (
        <div className="border-l-4 border-l-lime bg-white p-5"><p className="eyebrow">Participant instructions</p><p className="mt-2 whitespace-pre-wrap text-sm">{event.instructions}</p></div>
      ) : null}
      <Phase4Section title="Competitions" description="Choose a sport to read its rules and registration requirements.">
        {sports.length === 0 ? <p className="border border-dashed border-navy/25 bg-white p-8 text-center text-sm text-ink-muted">No competitions are published yet.</p> : (
          <div className="grid gap-4 md:grid-cols-2">
            {sports.map((sport) => (
              <Link key={sport.id} href={`/events/${event.slug}/${sport.slug}`} className="border border-navy/10 bg-white p-5 transition hover:border-cobalt">
                <div className="flex items-center justify-between gap-2"><p className="font-barlow text-2xl uppercase">{sport.name}</p><Phase4StatusBadge label={sport.status} /></div>
                <p className="mt-2 text-xs capitalize text-ink-muted">{sport.mode} · {sport.tournament_format.replaceAll("_", " ")}</p>
                <p className="mt-3 line-clamp-2 text-sm text-ink-muted">{sport.description ?? "Rules and schedules will be published here."}</p>
                <p className="mt-4 text-xs font-bold uppercase tracking-[0.1em] text-cobalt">View competition →</p>
              </Link>
            ))}
          </div>
        )}
      </Phase4Section>
    </div>
  );
}
