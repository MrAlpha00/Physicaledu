import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PaymentReviewForm } from "@/components/phase4/admin-controls";
import { Phase4Header, Phase4Section, Phase4StatusBadge } from "@/components/phase4/common";
import { Button } from "@/components/ui/button";
import { getEntries, getSportContext } from "@/lib/data/phase4";

export const metadata: Metadata = { title: "Payment verification" };
export const dynamic = "force-dynamic";

export default async function PaymentsPage({
  params,
}: {
  params: Promise<{ eventId: string; sportId: string }>;
}) {
  const { eventId, sportId } = await params;
  const [context, entries] = await Promise.all([getSportContext(eventId, sportId), getEntries(sportId)]);
  if (!context) notFound();
  const payments = entries.flatMap((entry) => entry.payment ? [{ entry, payment: entry.payment }] : []);
  const base = `/admin/events/${eventId}/sports/${sportId}`;

  return (
    <div className="space-y-8">
      <Phase4Header
        kicker="Phase 4 / Payments"
        title={`${context.sport.name} — payment proofs`}
        description="Proofs are private files served through RLS-aware signed URLs. Verification status feeds entry approval and draw eligibility."
        actions={<Button asChild variant="outline"><Link href={`${base}/registrations`}>Back to registrations</Link></Button>}
      />
      <Phase4Section title={`${payments.length} payment record(s)`}>
        {payments.length === 0 ? (
          <p className="border border-dashed border-navy/25 bg-white p-8 text-center text-sm text-ink-muted">No payment proofs have been submitted.</p>
        ) : (
          <div className="space-y-4">
            {payments.map(({ entry, payment }) => (
              <article key={payment.id} className="border border-navy/10 bg-white p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-bold text-navy">{entry.team_name ?? "Individual entry"}</p>
                    <p className="text-xs text-ink-muted">Reference: {payment.transaction_reference ?? "—"} · claimed: {payment.claimed_amount ?? "—"}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phase4StatusBadge label={payment.status} />
                    {payment.proof_file_id ? (
                      <a href={`/api/phase4/files/${payment.proof_file_id}/download`} className="text-xs font-bold text-cobalt underline">Open proof</a>
                    ) : null}
                  </div>
                </div>
                <div className="mt-4"><PaymentReviewForm payment={payment} /></div>
              </article>
            ))}
          </div>
        )}
      </Phase4Section>
    </div>
  );
}
