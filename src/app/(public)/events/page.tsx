import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, CalendarDays, MapPin } from "lucide-react";
import { Phase4Header, Phase4Section, Phase4StatusBadge } from "@/components/phase4/common";
import { getPublicEvents, getPublicFiles, getPublicSports } from "@/lib/data/phase4";

export const metadata: Metadata = { title: "Sports events" };
export const dynamic = "force-dynamic";

export default async function PublicEventsPage() {
  const events = await getPublicEvents();
  const sportsByEvent = await Promise.all(events.map((event) => getPublicSports(event.id)));
  const files = await getPublicFiles(events.map((event) => event.banner_file_id));
  const bannerFor = (eventId: string) => {
    const event = events.find((item) => item.id === eventId);
    return files.find((file) => file.id === event?.banner_file_id);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-10 px-5 py-12 sm:px-8">
      <Phase4Header
        kicker="VARSITY / Sports"
        title="Events & competitions"
        description="Browse published sports events, read the rules, register your team and follow verified results."
      />
      {events.length === 0 ? (
        <p className="border border-dashed border-navy/25 bg-white p-12 text-center text-sm text-ink-muted">No public events are published yet.</p>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {events.map((event, index) => {
            const banner = bannerFor(event.id);
            return (
              <article key={event.id} className="group overflow-hidden border border-navy/10 bg-white">
                <Link href={`/events/${event.slug}`} className="block">
                  {banner ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`/api/phase4/files/${banner.id}/download`} alt="" className="h-40 w-full object-cover transition group-hover:scale-[1.02]" />
                  ) : (
                    <div className="flex h-40 items-center justify-center bg-navy font-barlow text-4xl uppercase tracking-tight text-lime">{event.name.slice(0, 2)}</div>
                  )}
                </Link>
                <div className="space-y-3 p-5">
                  <div className="flex items-center justify-between gap-2"><Phase4StatusBadge label={event.status} /><span className="text-[0.65rem] uppercase tracking-[0.1em] text-ink-muted">{event.academic_year}</span></div>
                  <Link href={`/events/${event.slug}`} className="font-barlow text-2xl uppercase leading-none text-navy hover:text-cobalt">{event.name}</Link>
                  <p className="line-clamp-2 text-xs text-ink-muted">{event.description ?? "Details will be published shortly."}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
                    <span className="flex items-center gap-1"><CalendarDays className="size-3.5" /> {event.starts_on ?? "TBA"}</span>
                    <span className="flex items-center gap-1"><MapPin className="size-3.5" /> {event.venue ?? "TBA"}</span>
                  </div>
                  <p className="border-t border-navy/10 pt-3 text-xs font-semibold text-cobalt">{sportsByEvent[index].length} competition(s) <ArrowUpRight className="inline size-3.5" /></p>
                </div>
              </article>
            );
          })}
        </div>
      )}
      <Phase4Section title="Need help?">Contact the PE Department using the details on each event page. Registration requires a verified student account.</Phase4Section>
    </div>
  );
}
