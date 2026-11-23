import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DrawControl, ManualDrawForm } from "@/components/phase4/admin-controls";
import { Phase4Header, Phase4Notice, Phase4Section, Phase4StatusBadge } from "@/components/phase4/common";
import { TournamentCanvas } from "@/components/phase4/tournament-canvas";
import { Button } from "@/components/ui/button";
import {
  getActiveDraw,
  getCanvasPositions,
  getDrawHistory,
  getEntries,
  getMatches,
  getSportContext,
} from "@/lib/data/phase4";
import { buildFlowGraphFromDatabase, readTournamentPlan, validateTournamentGraph } from "@/lib/tournament/graph";

export const metadata: Metadata = { title: "Tournament draw canvas" };
export const dynamic = "force-dynamic";

export default async function TournamentPage({
  params,
}: {
  params: Promise<{ eventId: string; sportId: string }>;
}) {
  const { eventId, sportId } = await params;
  const context = await getSportContext(eventId, sportId);
  if (!context) notFound();
  const [draw, history, entries, matches] = await Promise.all([
    getActiveDraw(sportId),
    getDrawHistory(sportId),
    getEntries(sportId),
    getMatches(sportId),
  ]);
  const positions = draw ? await getCanvasPositions(draw.id) : {};
  const plan = draw ? readTournamentPlan(draw.payload) : null;
  const validation = plan ? validateTournamentGraph(plan) : null;
  const graph = plan
    ? buildFlowGraphFromDatabase(plan, {
        positions,
        matches: matches.map((match) => ({
          matchNumber: match.match_number,
          status: match.status,
          winnerEntryId: match.winner_entry_id,
          isBye: match.is_bye,
          venue: match.venue,
          startsAt: match.starts_at,
        })),
        entries: entries.map((entry) => ({
          id: entry.id,
          label: entry.team_name ?? `Competitor ${entry.id.slice(0, 8)}`,
        })),
      })
    : { nodes: [], edges: [] };
  const locked = draw?.status === "locked" || context.sport.draw_locked;
  const base = `/admin/events/${eventId}/sports/${sportId}`;

  return (
    <div className="space-y-8">
      <Phase4Header
        kicker="Phase 4 / Tournament"
        title={`${context.sport.name} — draw canvas`}
        description="The authoritative plan is generated and stored in the database. This canvas renders that plan with live match status and saves only node positions."
        actions={<Button asChild variant="outline"><Link href={base}>Back to configuration</Link></Button>}
      />
      <Phase4Notice>
        Knockout, round-robin and group-stage plans are validated before persistence. Byes, third-place matches and progression edges are checked for cycles and duplicate slots.
      </Phase4Notice>

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          {plan ? (
            <TournamentCanvas
              eventId={eventId}
              sportId={sportId}
              drawId={draw!.id}
              locked={locked}
              canEdit
              nodes={graph.nodes}
              edges={graph.edges}
            />
          ) : (
            <div className="border border-dashed border-navy/25 bg-white p-12 text-center">
              <p className="font-barlow text-2xl uppercase text-navy">No draw generated</p>
              <p className="mx-auto mt-2 max-w-md text-sm text-ink-muted">Approve entries, configure the format, then generate a validated draw to unlock the interactive bracket.</p>
            </div>
          )}
          {validation && !validation.valid ? (
            <div className="border border-coral bg-coral/10 p-4 text-sm text-coral-dark">
              <p className="font-bold">Stored plan failed validation:</p>
              <ul className="mt-2 list-disc pl-5">{validation.errors.map((error) => <li key={error}>{error}</li>)}</ul>
            </div>
          ) : null}
          {draw ? (
            <div className="flex flex-wrap gap-3 border border-navy/10 bg-white p-4 text-xs">
              <span>Version <strong>{draw.version}</strong></span>
              <span>Mode <strong>{draw.draw_mode}</strong></span>
              <span>Status <Phase4StatusBadge label={draw.status} /></span>
              <span>Generated {new Date(draw.generated_at).toLocaleString()}</span>
            </div>
          ) : null}
        </div>

        <div className="space-y-6">
          <DrawControl
            eventId={eventId}
            sportId={sportId}
            drawId={draw?.id ?? null}
            drawMode={context.sport.draw_mode}
            thirdPlace={context.sport.third_place}
            locked={locked}
          />
          {context.sport.draw_mode === "manual" ? (
            <ManualDrawForm
              eventId={eventId}
              sportId={sportId}
              entries={entries.map((entry) => ({
                id: entry.id,
                label: entry.team_name ?? `Competitor ${entry.id.slice(0, 8)}`,
              }))}
            />
          ) : null}
          <Phase4Section title="Draw history" description="Every regeneration, lock and unlock remains auditable.">
            {history.length === 0 ? <p className="text-xs text-ink-muted">No draw history.</p> : (
              <div className="space-y-2">
                {history.map((item) => (
                  <div key={item.id} className="border border-navy/10 bg-white p-3 text-xs">
                    <div className="flex items-center justify-between gap-2"><strong>v{item.version}</strong><Phase4StatusBadge label={item.status} /></div>
                    <p className="mt-1 text-ink-muted">{new Date(item.generated_at).toLocaleString()}</p>
                    {item.lock_reason ? <p className="mt-1">Lock: {item.lock_reason}</p> : null}
                  </div>
                ))}
              </div>
            )}
          </Phase4Section>
        </div>
      </div>
    </div>
  );
}
