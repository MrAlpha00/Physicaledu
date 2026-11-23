import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RemoveEligibilityButton } from "@/components/phase4/admin-controls";
import { CompetitionRulesForm, PaymentSettingsForm } from "@/components/phase4/rules-and-payment-forms";
import { Phase4Header, Phase4Section, Phase4StatusBadge } from "@/components/phase4/common";
import { SportForm } from "@/components/phase4/sport-form";
import { Button } from "@/components/ui/button";
import { getSportContext } from "@/lib/data/phase4";

export const metadata: Metadata = { title: "Competition configuration" };
export const dynamic = "force-dynamic";

const SECTION_LINKS = [
  ["registrations", "Registrations"],
  ["payments", "Payments"],
  ["organizers", "Organisers"],
  ["tournament", "Draw canvas"],
  ["matches", "Matches"],
];

export default async function SportConfigPage({
  params,
}: {
  params: Promise<{ eventId: string; sportId: string }>;
}) {
  const { eventId, sportId } = await params;
  const context = await getSportContext(eventId, sportId);
  if (!context) notFound();
  const { event, sport, rules, eligibility, payment } = context;
  const base = `/admin/events/${eventId}/sports/${sportId}`;

  return (
    <div className="space-y-8">
      <Phase4Header
        kicker="Phase 4 / Competition"
        title={sport.name}
        description={`${event.name} · ${sport.mode} competition · /${sport.slug}`}
        actions={<Button asChild variant="outline"><Link href={`/admin/events/${eventId}/sports`}>All competitions</Link></Button>}
      />

      <div className="flex flex-wrap gap-2 border-b border-navy/10 pb-4">
        {SECTION_LINKS.map(([path, label]) => (
          <Button key={path} asChild size="sm" variant="outline"><Link href={`${base}/${path}`}>{label}</Link></Button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-8">
          <Phase4Section title="Competition setup" description="Format, schedule, scoring and publication settings.">
            <div className="border border-navy/10 bg-white p-6"><SportForm eventId={eventId} sport={sport} rules={rules} /></div>
          </Phase4Section>
          <Phase4Section title="Registration rules" description="Team size, duplicates, custom questions and published rules.">
            <div className="border border-navy/10 bg-white p-6">
              <CompetitionRulesForm competitionId={sportId} rules={rules} eligibility={eligibility} />
            </div>
          </Phase4Section>
          <Phase4Section title="Payment settings" description="Fees and QR code are published to participants; proofs remain private.">
            <div className="border border-navy/10 bg-white p-6">
              <PaymentSettingsForm competitionId={sportId} payment={payment} />
            </div>
          </Phase4Section>
        </div>
        <div className="space-y-4">
          <div className="border border-navy/10 bg-white p-5">
            <p className="eyebrow">Snapshot</p>
            <div className="mt-2"><Phase4StatusBadge label={sport.status} /></div>
            <ul className="mt-4 space-y-2 text-xs text-ink-muted">
              <li>Draw mode: <strong>{sport.draw_mode}</strong></li>
              <li>Draw locked: <strong>{sport.draw_locked ? "Yes" : "No"}</strong></li>
              <li>Organiser result approval: <strong>{sport.organizer_results_require_approval ? "Required" : "Not required"}</strong></li>
              <li>Third place: <strong>{sport.third_place ? "Yes" : "No"}</strong></li>
            </ul>
          </div>
          <div className="border border-navy/10 bg-white p-5">
            <p className="eyebrow mb-3">Active eligibility rules</p>
            {eligibility.length === 0 ? (
              <p className="text-xs text-ink-muted">No additional eligibility rules. Directory validation still applies.</p>
            ) : (
              <ul className="space-y-2">
                {eligibility.map((rule) => (
                  <li key={rule.id} className="border-l-4 border-l-cobalt bg-navy/[0.02] px-3 py-2 text-xs">
                    <p className="font-bold capitalize">{rule.rule_type.replaceAll("_", " ")}</p>
                    <p className="text-ink-muted">{rule.description || JSON.stringify(rule.rule_value)}</p>
                    <RemoveEligibilityButton ruleId={rule.id} competitionId={sportId} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
