import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MatchScheduleForm, ResultCorrectionForm } from "@/components/phase4/admin-controls";
import { Phase4Header, Phase4Section, Phase4StatusBadge } from "@/components/phase4/common";
import { Button } from "@/components/ui/button";
import { getEntries, getMatches, getSportAssignments, getSportContext } from "@/lib/data/phase4";

export const metadata: Metadata = { title: "Live match management" };
export const dynamic = "force-dynamic";

export default async function MatchesPage({
  params,
}: {
  params: Promise<{ eventId: string; sportId: string }>;
}) {
  const { eventId, sportId } = await params;
  const [context, matches, assignments, entries] = await Promise.all([
    getSportContext(eventId, sportId),
    getMatches(sportId),
    getSportAssignments(sportId),
    getEntries(sportId),
  ]);
  if (!context) notFound();
  const labels = new Map(entries.map((entry) => [entry.id, entry.team_name ?? `Competitor ${entry.id.slice(0, 8)}`]));
  const organizers = assignments.map((assignment) => ({
    id: assignment.user_id,
    label: `User ${assignment.user_id.slice(0, 8)}`,
  }));
  const base = `/admin/events/${eventId}/sports/${sportId}`;

  return (
    <div className="space-y-8">
      <Phase4Header
        kicker="Phase 4 / Live management"
        title={`${context.sport.name} — matches`}
        description="Schedule matches, assign sport-scoped organisers, correct results and trigger bracket advancement."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline"><Link href={`${base}/tournament`}>Draw canvas</Link></Button>
            <Button asChild variant="lime"><Link href={`${base}/results`}>Standings & results</Link></Button>
          </div>
        }
      />
      <Phase4Section title={`${matches.length} match(es)`}>
        {matches.length === 0 ? (
          <p className="border border-dashed border-navy/25 bg-white p-8 text-center text-sm text-ink-muted">Generate a draw to create matches.</p>
        ) : (
          <div className="space-y-4">
            {matches.map((match) => {
              const competitorLabels = match.slots.map((slot) =>
                slot.entry_id ? labels.get(slot.entry_id) ?? slot.entry_id.slice(0, 8) : slot.from_bye ? "BYE" : "TBD");
              return (
                <article key={match.id} className="border border-navy/10 bg-white">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-navy/10 p-4">
                    <div>
                      <p className="font-barlow text-xl uppercase">{match.round_name} · M{match.match_number}</p>
                      <p className="text-sm font-bold text-navy">{competitorLabels[0] ?? "TBD"} vs {competitorLabels[1] ?? "TBD"}</p>
                      <p className="mt-1 text-xs text-ink-muted">{match.venue ?? "Venue TBD"} · {match.starts_at ? new Date(match.starts_at).toLocaleString() : "Unscheduled"}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phase4StatusBadge label={match.status} />
                      {match.is_bye ? <Phase4StatusBadge label="bye" /> : null}
                    </div>
                  </div>
                  {match.result ? (
                    <div className="border-b border-navy/10 bg-lime/10 px-4 py-2 text-xs">
                      Recorded {match.result.score_a ?? "—"} – {match.result.score_b ?? "—"} · winner {match.result.winner_entry_id ? labels.get(match.result.winner_entry_id) ?? match.result.winner_entry_id.slice(0, 8) : "—"}
                      {match.result.result_note ? ` · ${match.result.result_note}` : ""}
                    </div>
                  ) : null}
                  <details className="group">
                    <summary className="cursor-pointer px-4 py-3 text-xs font-bold uppercase tracking-[0.1em] text-cobalt">Schedule & assign</summary>
                    <div className="border-t border-navy/10 p-4"><MatchScheduleForm match={match} organizers={organizers} /></div>
                  </details>
                  <details className="group">
                    <summary className="cursor-pointer border-t border-navy/10 px-4 py-3 text-xs font-bold uppercase tracking-[0.1em] text-coral-dark">Correct result & advance</summary>
                    <div className="border-t border-navy/10 p-4">
                      <ResultCorrectionForm
                        match={match}
                        entries={entries.map((entry) => ({ id: entry.id, label: labels.get(entry.id)! }))}
                        eventId={eventId}
                        sportId={sportId}
                      />
                    </div>
                  </details>
                </article>
              );
            })}
          </div>
        )}
      </Phase4Section>
    </div>
  );
}
