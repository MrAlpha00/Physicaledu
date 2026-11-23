import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Phase4Header, Phase4Section, Phase4StatusBadge } from "@/components/phase4/common";
import { SportForm } from "@/components/phase4/sport-form";
import { Button } from "@/components/ui/button";
import { getAdminEvent, getAdminSports } from "@/lib/data/phase4";

export const metadata: Metadata = { title: "Competitions" };
export const dynamic = "force-dynamic";

export default async function SportsPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const [event, sports] = await Promise.all([getAdminEvent(eventId), getAdminSports(eventId)]);
  if (!event) notFound();

  return (
    <div className="space-y-8">
      <Phase4Header
        kicker="Phase 4 / Competitions"
        title={`${event.name} — competitions`}
        description="An event can contain any number of team or individual competitions. Each competition owns its rules, eligibility, payment, draw and results."
        actions={<Button asChild variant="outline"><Link href={`/admin/events/${eventId}`}>Back to event</Link></Button>}
      />
      <div className="border border-navy/10 bg-white p-6"><SportForm eventId={eventId} sport={null} rules={null} /></div>
      <Phase4Section title="Configured competitions" description={`${sports.length} competition(s).`}>
        {sports.length === 0 ? (
          <p className="border border-dashed border-navy/25 bg-white p-8 text-center text-sm text-ink-muted">No competitions yet.</p>
        ) : (
          <div className="overflow-x-auto border border-navy/10 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-navy text-xs uppercase tracking-[0.1em] text-chalk">
                <tr><th className="px-4 py-3">Competition</th><th className="px-4 py-3">Mode</th><th className="px-4 py-3">Format</th><th className="px-4 py-3">Status</th><th className="px-4 py-3" /></tr>
              </thead>
              <tbody>
                {sports.map((sport) => (
                  <tr key={sport.id} className="border-t border-navy/10">
                    <td className="px-4 py-3"><Link href={`/admin/events/${eventId}/sports/${sport.id}`} className="font-bold hover:text-cobalt">{sport.name}</Link><p className="text-xs text-ink-muted">/{sport.slug}</p></td>
                    <td className="px-4 py-3 capitalize">{sport.mode}</td>
                    <td className="px-4 py-3">{sport.tournament_format.replaceAll("_", " ")}</td>
                    <td className="px-4 py-3"><Phase4StatusBadge label={sport.status} /></td>
                    <td className="px-4 py-3"><Button asChild size="sm" variant="outline"><Link href={`/admin/events/${eventId}/sports/${sport.id}`}>Configure</Link></Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Phase4Section>
    </div>
  );
}
