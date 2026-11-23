import type { Metadata } from "next";
import Link from "next/link";
import { Award, ClipboardCheck, CreditCard, Swords, Trophy, UsersRound } from "lucide-react";
import { Phase4Header, Phase4Metric } from "@/components/phase4/common";
import { Button } from "@/components/ui/button";
import { getEventDashboardMetrics } from "@/lib/data/phase4";

export const metadata: Metadata = { title: "Events dashboard" };
export const dynamic = "force-dynamic";

export default async function EventsDashboardPage() {
  const metrics = await getEventDashboardMetrics();
  return (
    <div className="space-y-8">
      <Phase4Header
        kicker="Phase 4 / Analytics"
        title="Events dashboard"
        description="Live operational totals from events, registrations, payments and tournament matches."
        actions={<Button asChild variant="outline"><Link href="/admin/events">Back to events</Link></Button>}
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Phase4Metric label="Events" value={metrics.totalEvents} detail={`${metrics.publishedEvents} published`} icon={Trophy} tone="navy" />
        <Phase4Metric label="Active events" value={metrics.activeEvents} detail="Registration open or ongoing" icon={Award} tone="lime" />
        <Phase4Metric label="Competitions" value={metrics.totalSports} detail={`${metrics.completedCompetitions} completed`} icon={Swords} tone="cobalt" />
        <Phase4Metric label="Team entries" value={metrics.teamEntries} detail={`${metrics.individualEntries} individual entries`} icon={UsersRound} tone="coral" />
        <Phase4Metric label="Pending approvals" value={metrics.pendingApprovals} detail="Submitted or under review" icon={ClipboardCheck} tone="coral" />
        <Phase4Metric label="Approved entries" value={metrics.approvedEntries} detail="Cleared for draws" icon={ClipboardCheck} tone="lime" />
        <Phase4Metric label="Pending payments" value={metrics.pendingPayments} detail="Proofs awaiting verification" icon={CreditCard} tone="coral" />
        <Phase4Metric label="Matches" value={metrics.upcomingMatches + metrics.ongoingMatches + metrics.completedMatches} detail={`${metrics.ongoingMatches} live · ${metrics.pendingResults} results pending`} icon={Swords} tone="cobalt" />
      </div>
    </div>
  );
}
