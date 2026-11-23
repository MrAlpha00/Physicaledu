import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { OrganizerMatchStatusForm, OrganizerResultForm } from "@/components/phase4/organizer-controls";
import { Phase4Header, Phase4StatusBadge } from "@/components/phase4/common";
import { isCurrentUserPeAdmin, requireUser } from "@/lib/auth/session";
import { getMatchDetail, getOrganizerAssignments } from "@/lib/data/phase4";

export const metadata: Metadata = { title: "Organise match" };
export const dynamic = "force-dynamic";

export default async function OrganizerMatchPage({
  params,
}: {
  params: Promise<{ matchId: string }>;
}) {
  const { matchId } = await params;
  const user = await requireUser();
  const detail = await getMatchDetail(matchId);
  if (!detail || !detail.competitionId) notFound();
  const [isAdmin, assignments] = await Promise.all([
    isCurrentUserPeAdmin(),
    getOrganizerAssignments(user.id),
  ]);
  if (!isAdmin && !assignments.some((item) => item.sport.id === detail.competitionId)) notFound();
  const labels = detail.entries.map((entry) => ({
    id: entry.id,
    label: entry.team_name ?? `Competitor ${entry.id.slice(0, 8)}`,
  }));
  const competitors = detail.slots.map((slot) => slot.entry_id
    ? labels.find((entry) => entry.id === slot.entry_id)?.label ?? "TBD"
    : slot.from_bye ? "BYE" : "TBD");

  return (
    <div className="space-y-8">
      <Link href="/organizer" className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.1em] text-ink-muted hover:text-navy"><ArrowLeft className="size-4" /> Organiser desk</Link>
      <Phase4Header
        kicker="Phase 4 / Live match"
        title={`${detail.match.round_name} · M${detail.match.match_number}`}
        description={`${competitors[0] ?? "TBD"} vs ${competitors[1] ?? "TBD"}`}
        actions={<Phase4StatusBadge label={detail.match.status} />}
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="border border-navy/10 bg-white p-6"><p className="eyebrow mb-4">Live status</p><OrganizerMatchStatusForm match={detail.match} /></div>
        <div className="border border-navy/10 bg-white p-6"><p className="eyebrow mb-4">Result</p><OrganizerResultForm match={detail.match} entries={labels} /></div>
      </div>
      {detail.result ? (
        <div className="border-l-4 border-l-lime bg-white p-5 text-sm">
          <p className="font-bold">Recorded result</p>
          <p className="mt-1">{detail.result.score_a ?? "—"} – {detail.result.score_b ?? "—"} · winner {detail.result.winner_entry_id ? labels.find((entry) => entry.id === detail.result!.winner_entry_id)?.label ?? "Winner" : "—"}</p>
        </div>
      ) : null}
    </div>
  );
}
