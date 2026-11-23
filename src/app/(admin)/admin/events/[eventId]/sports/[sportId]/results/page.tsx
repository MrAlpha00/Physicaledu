import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Phase4ExportLinks } from "@/components/phase4/export-links";
import { Phase4Header, Phase4Section, Phase4StatusBadge } from "@/components/phase4/common";
import { Button } from "@/components/ui/button";
import { getEntries, getMatches, getSportContext, getStandings } from "@/lib/data/phase4";

export const metadata: Metadata = { title: "Standings & results" };
export const dynamic = "force-dynamic";

export default async function ResultsPage({
  params,
}: {
  params: Promise<{ eventId: string; sportId: string }>;
}) {
  const { eventId, sportId } = await params;
  const [context, standings, matches, entries] = await Promise.all([
    getSportContext(eventId, sportId),
    getStandings(sportId),
    getMatches(sportId),
    getEntries(sportId),
  ]);
  if (!context) notFound();
  const labels = new Map(entries.map((entry) => [entry.id, entry.team_name ?? `Competitor ${entry.id.slice(0, 8)}`]));
  const base = `/admin/events/${eventId}/sports/${sportId}`;

  return (
    <div className="space-y-8">
      <Phase4Header
        kicker="Phase 4 / Results"
        title={`${context.sport.name} — standings`}
        description="Standings and completed results are mirrored to the public results page. Only verified outcomes advance the bracket."
        actions={<Button asChild variant="outline"><Link href={`${base}/matches`}>Back to matches</Link></Button>}
      />
      <Phase4Section title="Standings">
        {standings.length === 0 ? <p className="border border-dashed border-navy/25 bg-white p-8 text-center text-sm text-ink-muted">Standings appear after match results are recorded.</p> : (
          <div className="overflow-x-auto border border-navy/10 bg-white">
            <table className="w-full text-left text-xs">
              <thead className="bg-navy uppercase tracking-[0.08em] text-chalk">
                <tr>{["Group", "#", "Competitor", "P", "W", "D", "L", "PF", "PA", "Diff", "Pts", "Status"].map((heading) => <th key={heading} className="px-3 py-2">{heading}</th>)}</tr>
              </thead>
              <tbody>
                {standings.map((row) => (
                  <tr key={row.id} className="border-t border-navy/10">
                    <td className="px-3 py-2">{row.group_key}</td>
                    <td className="px-3 py-2 font-bold">{row.position}</td>
                    <td className="px-3 py-2">{labels.get(row.entry_id) ?? row.entry_id.slice(0, 8)}</td>
                    <td className="px-3 py-2">{row.played}</td><td className="px-3 py-2">{row.wins}</td>
                    <td className="px-3 py-2">{row.draws}</td><td className="px-3 py-2">{row.losses}</td>
                    <td className="px-3 py-2">{row.points_for}</td><td className="px-3 py-2">{row.points_against}</td>
                    <td className="px-3 py-2">{row.point_difference}</td><td className="px-3 py-2 font-bold">{row.competition_points}</td>
                    <td className="px-3 py-2">{row.qualified ? <Phase4StatusBadge label="qualified" /> : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Phase4Section>
      <Phase4Section title="Completed matches">
        {matches.filter((match) => match.result).length === 0 ? <p className="text-sm text-ink-muted">No results recorded yet.</p> : (
          <div className="grid gap-2 md:grid-cols-2">
            {matches.filter((match) => match.result).map((match) => (
              <div key={match.id} className="border border-navy/10 bg-white p-3 text-sm">
                <p className="text-xs font-bold uppercase text-ink-muted">{match.round_name} · M{match.match_number}</p>
                <p className="mt-1 font-semibold">{match.result!.score_a ?? "—"} – {match.result!.score_b ?? "—"} · {match.result!.winner_entry_id ? labels.get(match.result!.winner_entry_id) ?? "Winner" : "No winner"}</p>
              </div>
            ))}
          </div>
        )}
      </Phase4Section>
      <Phase4ExportLinks eventId={eventId} sportId={sportId} />
    </div>
  );
}
