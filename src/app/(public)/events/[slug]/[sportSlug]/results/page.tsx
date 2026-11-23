import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Trophy } from "lucide-react";
import { Phase4Header, Phase4Section, Phase4StatusBadge } from "@/components/phase4/common";
import { TournamentCanvas } from "@/components/phase4/tournament-canvas";
import {
  getActiveDraw,
  getCanvasPositions,
  getEntries,
  getMatches,
  getPublicEvent,
  getPublicSport,
  getStandings,
} from "@/lib/data/phase4";
import { buildFlowGraphFromDatabase, readTournamentPlan } from "@/lib/tournament/graph";

export const metadata: Metadata = { title: "Competition results" };
export const dynamic = "force-dynamic";

export default async function PublicResultsPage({
  params,
}: {
  params: Promise<{ slug: string; sportSlug: string }>;
}) {
  const { slug, sportSlug } = await params;
  const event = await getPublicEvent(slug);
  if (!event) notFound();
  const sport = await getPublicSport(event.id, sportSlug);
  if (!sport) notFound();
  const [draw, entries, matches, standings] = await Promise.all([
    getActiveDraw(sport.id),
    getEntries(sport.id),
    getMatches(sport.id),
    getStandings(sport.id),
  ]);
  const positions = draw ? await getCanvasPositions(draw.id) : {};
  const plan = draw ? readTournamentPlan(draw.payload) : null;
  const graph = plan
    ? buildFlowGraphFromDatabase(plan, {
        positions,
        compact: true,
        matches: matches.map((match) => ({
          matchNumber: match.match_number,
          status: match.status,
          winnerEntryId: match.winner_entry_id,
          isBye: match.is_bye,
          venue: match.venue,
        })),
        entries: entries.map((entry) => ({ id: entry.id, label: entry.team_name ?? `Competitor ${entry.id.slice(0, 8)}` })),
      })
    : { nodes: [], edges: [] };
  const labels = new Map(entries.map((entry) => [entry.id, entry.team_name ?? `Competitor ${entry.id.slice(0, 8)}`]));

  return (
    <div className="mx-auto max-w-7xl space-y-10 px-5 py-10 sm:px-8">
      <Link href={`/events/${event.slug}/${sport.slug}`} className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.1em] text-ink-muted hover:text-navy"><ArrowLeft className="size-4" /> Competition details</Link>
      <Phase4Header
        kicker={`${event.name} / Results`}
        title={`${sport.name} — live results`}
        description="Results and standings are published only from authoritative database records."
        actions={<Phase4StatusBadge label={sport.status} />}
      />
      {plan && draw ? (
        <Phase4Section title="Bracket" description="Live progression — winner feeds advance automatically after verified results.">
          <TournamentCanvas
            eventId={event.id}
            sportId={sport.id}
            drawId={draw.id}
            locked
            canEdit={false}
            nodes={graph.nodes}
            edges={graph.edges}
          />
        </Phase4Section>
      ) : null}
      <Phase4Section title="Standings">
        {standings.length === 0 ? <p className="border border-dashed border-navy/25 bg-white p-8 text-center text-sm text-ink-muted">Standings are not available yet.</p> : (
          <div className="overflow-x-auto border border-navy/10 bg-white">
            <table className="w-full text-left text-xs">
              <thead className="bg-navy uppercase tracking-[0.08em] text-chalk">
                <tr>{["Group", "#", "Competitor", "P", "W", "D", "L", "Pts", "Status"].map((heading) => <th key={heading} className="px-3 py-2">{heading}</th>)}</tr>
              </thead>
              <tbody>
                {standings.map((row) => (
                  <tr key={row.id} className="border-t border-navy/10">
                    <td className="px-3 py-2">{row.group_key}</td><td className="px-3 py-2 font-bold">{row.position}</td>
                    <td className="px-3 py-2">{labels.get(row.entry_id) ?? row.entry_id.slice(0, 8)}</td>
                    <td className="px-3 py-2">{row.played}</td><td className="px-3 py-2">{row.wins}</td>
                    <td className="px-3 py-2">{row.draws}</td><td className="px-3 py-2">{row.losses}</td>
                    <td className="px-3 py-2 font-bold">{row.competition_points}</td>
                    <td className="px-3 py-2">{row.qualified ? <Phase4StatusBadge label="qualified" /> : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Phase4Section>
      <Phase4Section title="Match results" description="Verified results only.">
        {matches.filter((match) => match.result).length === 0 ? <p className="text-sm text-ink-muted">No results have been published yet.</p> : (
          <div className="grid gap-2 md:grid-cols-2">
            {matches.filter((match) => match.result).map((match) => (
              <div key={match.id} className="flex items-center gap-3 border border-navy/10 bg-white p-4">
                <Trophy className="size-5 text-cobalt" />
                <div>
                  <p className="text-xs font-bold uppercase text-ink-muted">{match.round_name} · M{match.match_number}</p>
                  <p className="text-sm font-semibold">{match.result!.score_a ?? "—"} – {match.result!.score_b ?? "—"} · {match.result!.winner_entry_id ? labels.get(match.result!.winner_entry_id) ?? "Winner" : "No winner"}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Phase4Section>
    </div>
  );
}
