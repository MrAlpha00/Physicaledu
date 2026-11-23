import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardList, ShieldCheck } from "lucide-react";
import { OrganizerMatchStatusForm, OrganizerResultForm } from "@/components/phase4/organizer-controls";
import { Phase4Header, Phase4Section, Phase4StatusBadge } from "@/components/phase4/common";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/session";
import { getMyOrganizerInvitations, getOrganizerMatchViews } from "@/lib/data/phase4";

export const metadata: Metadata = { title: "Organiser desk" };
export const dynamic = "force-dynamic";

export default async function OrganizerPage() {
  const user = await requireUser();
  const [views, invitations] = await Promise.all([
    getOrganizerMatchViews(user.id),
    getMyOrganizerInvitations(user.id),
  ]);

  return (
    <div className="space-y-8">
      <Phase4Header
        kicker="Phase 4 / Organiser"
        title="Organiser desk"
        description="Match management is scoped to competitions you were invited to manage. No global admin permissions are granted."
        actions={<Button asChild variant="outline"><Link href="/organizer/invitations"><ClipboardList /> Invitations ({invitations.length})</Link></Button>}
      />

      <div className="border-l-4 border-l-lime bg-navy p-5 text-chalk">
        <ShieldCheck className="size-5 text-lime" />
        <p className="mt-2 font-barlow text-xl uppercase">Scoped access</p>
        <p className="mt-1 text-xs text-chalk/70">You can update live status and submit results only for your assigned sports. Results requiring approval are queued for PE Admin.</p>
      </div>

      {views.length === 0 ? (
        <p className="border border-dashed border-navy/25 bg-white p-10 text-center text-sm text-ink-muted">You are not assigned to any sport yet. Accept an invitation to begin.</p>
      ) : (
        views.map(({ assignment, sport, event, matches }) => (
          <Phase4Section
            key={assignment.id}
            title={`${event.name} — ${sport.name}`}
            description={`${matches.length} match(es) · ${sport.organizer_results_require_approval ? "results require PE Admin approval" : "results advance immediately"}`}
          >
            {matches.length === 0 ? <p className="text-sm text-ink-muted">No draw has been generated for this competition.</p> : (
              <div className="space-y-4">
                {matches.filter((match) => !match.is_bye).map((match) => {
                  const labels = match.entries.map((entry) => ({ id: entry.id, label: entry.team_name ?? `Competitor ${entry.id.slice(0, 8)}` }));
                  const competitors = match.slots.map((slot) => slot.entry_id ? labels.find((entry) => entry.id === slot.entry_id)?.label ?? "TBD" : slot.from_bye ? "BYE" : "TBD");
                  return (
                    <article key={match.id} className="border border-navy/10 bg-white p-5">
                      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-navy/10 pb-3">
                        <div>
                          <p className="font-barlow text-xl uppercase">{match.round_name} · M{match.match_number}</p>
                          <p className="text-sm font-bold">{competitors[0] ?? "TBD"} vs {competitors[1] ?? "TBD"}</p>
                          <p className="text-xs text-ink-muted">{match.venue ?? "Venue TBD"}</p>
                        </div>
                        <Phase4StatusBadge label={match.status} />
                      </div>
                      <div className="mt-4 grid gap-6 lg:grid-cols-2">
                        <div><p className="eyebrow mb-2">Live status</p><OrganizerMatchStatusForm match={match} /></div>
                        <div><p className="eyebrow mb-2">Submit result</p><OrganizerResultForm match={match} entries={labels} /></div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </Phase4Section>
        ))
      )}
    </div>
  );
}
