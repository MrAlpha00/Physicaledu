import type { Metadata } from "next";
import Link from "next/link";
import { Trophy } from "lucide-react";
import { PaymentProofForm } from "@/components/phase4/payment-proof-form";
import { Phase4Empty, Phase4Header, Phase4Section, Phase4StatusBadge } from "@/components/phase4/common";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/session";
import { getEntryContexts, getMyEntries } from "@/lib/data/phase4";

export const metadata: Metadata = { title: "My events" };
export const dynamic = "force-dynamic";

export default async function MyEventsPage() {
  const user = await requireUser();
  const entries = await getMyEntries(user.id);
  const contexts = await getEntryContexts(entries);

  return (
    <div className="space-y-8">
      <Phase4Header
        kicker="Phase 4 / Student"
        title="My events"
        description="Track your registrations, approvals, payment verification and participation confirmations."
        actions={<Button asChild variant="outline"><Link href="/events"><Trophy /> Browse events</Link></Button>}
      />
      {entries.length === 0 ? (
        <Phase4Empty title="No registrations yet" description="Browse published events and submit an entry for a competition." />
      ) : (
        <div className="space-y-5">
          {entries.map((entry) => {
            const context = contexts.get(entry.id);
            const payment = context?.payment;
            const needsProof = payment?.is_required && entry.payment_status === "pending_verification";
            return (
              <article key={entry.id} className="border border-navy/10 bg-white">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-navy/10 p-5">
                  <div>
                    <p className="eyebrow">{context?.event.name ?? "Sports event"} · {context?.sport.name ?? "Competition"}</p>
                    <p className="mt-1 font-barlow text-2xl uppercase">{entry.team_name ?? "Individual entry"}</p>
                    <p className="text-xs text-ink-muted">
                      {context ? <Link className="text-cobalt underline" href={`/events/${context.event.slug}/${context.sport.slug}`}>View competition</Link> : "Competition details unavailable"}
                      {" · "}Seed {entry.seed ?? "unseeded"}
                    </p>
                  </div>
                  <div className="flex gap-2"><Phase4StatusBadge label={entry.status} /><Phase4StatusBadge label={entry.payment_status} /></div>
                </div>
                <div className="grid gap-5 p-5 lg:grid-cols-2">
                  <div>
                    <p className="eyebrow mb-2">Registered participants</p>
                    <ul className="space-y-2 text-sm">
                      {entry.members.map((member) => (
                        <li key={member.id} className="flex items-center justify-between gap-2 border border-navy/10 px-3 py-2">
                          <span>{member.full_name} <span className="text-xs text-ink-muted">· {member.usn}</span></span>
                          <Phase4StatusBadge label={member.confirmation_status} />
                        </li>
                      ))}
                    </ul>
                    {entry.rejection_reason ? <p className="mt-3 text-sm text-coral-dark">Review note: {entry.rejection_reason}</p> : null}
                  </div>
                  <div>
                    {needsProof ? (
                      <>
                        <p className="eyebrow mb-2">Payment verification</p>
                        <PaymentProofForm
                          entryId={entry.id}
                          feeAmount={payment?.fee_amount ?? null}
                          instructions={payment?.instructions ?? ""}
                          qrUrl={payment?.qr_file_id ? `/api/phase4/files/${payment.qr_file_id}/download` : ""}
                        />
                      </>
                    ) : (
                      <div className="border border-navy/10 bg-navy/[0.02] p-4 text-sm">
                        <p className="font-bold">{payment?.is_required ? "Payment status" : "No payment required"}</p>
                        <p className="mt-1 text-ink-muted">
                          {payment?.is_required
                            ? "Your proof has been submitted or your fee has been resolved by PE Admin."
                            : "This competition does not require a payment."}
                        </p>
                      </div>
                    )}
                    {entry.payment?.transaction_reference ? (
                      <p className="mt-3 text-xs text-ink-muted">Reference: {entry.payment.transaction_reference}</p>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
      <Phase4Section title="Participation confirmation">
        <p className="text-sm text-ink-muted">If you received a private participation link, open it from the competition page to confirm or decline your place.</p>
      </Phase4Section>
    </div>
  );
}
