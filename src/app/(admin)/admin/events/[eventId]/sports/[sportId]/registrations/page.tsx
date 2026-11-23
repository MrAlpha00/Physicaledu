import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EntryCorrectionForm, MemberConfirmationForm, ReviewEntryForm } from "@/components/phase4/admin-controls";
import { Phase4Header, Phase4Section, Phase4StatusBadge } from "@/components/phase4/common";
import { Button } from "@/components/ui/button";
import { getEntries, getSportContext } from "@/lib/data/phase4";

export const metadata: Metadata = { title: "Registrations" };
export const dynamic = "force-dynamic";

export default async function RegistrationsPage({
  params,
}: {
  params: Promise<{ eventId: string; sportId: string }>;
}) {
  const { eventId, sportId } = await params;
  const [context, entries] = await Promise.all([getSportContext(eventId, sportId), getEntries(sportId)]);
  if (!context) notFound();
  const base = `/admin/events/${eventId}/sports/${sportId}`;

  return (
    <div className="space-y-8">
      <Phase4Header
        kicker="Phase 4 / Registrations"
        title={`${context.sport.name} — entries`}
        description="Every USN is validated against the official directory at submission. Approval and roster confirmation happen here."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline"><Link href={base}>Configuration</Link></Button>
            <Button asChild variant="lime"><Link href={`${base}/payments`}>Payments</Link></Button>
          </div>
        }
      />
      <Phase4Section title={`${entries.length} registration(s)`}>
        {entries.length === 0 ? (
          <p className="border border-dashed border-navy/25 bg-white p-8 text-center text-sm text-ink-muted">No registrations have been submitted yet.</p>
        ) : (
          <div className="space-y-4">
            {entries.map((entry) => (
              <article key={entry.id} className="border border-navy/10 bg-white p-5">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-navy/10 pb-3">
                  <div>
                    <p className="font-barlow text-2xl uppercase">{entry.team_name ?? "Individual entry"}</p>
                    <p className="text-xs text-ink-muted">Submitted {entry.submitted_at ? new Date(entry.submitted_at).toLocaleString() : "—"} · seed {entry.seed ?? "unseeded"}</p>
                  </div>
                  <div className="flex gap-2"><Phase4StatusBadge label={entry.status} /><Phase4StatusBadge label={entry.payment_status} /></div>
                </div>
                <div className="mt-4 grid gap-5 lg:grid-cols-2">
                  <div className="space-y-4">
                    <div>
                      <p className="eyebrow mb-2">Roster</p>
                      <div className="space-y-2">
                        {entry.members.map((member) => (
                          <div key={member.id} className="border border-navy/10 p-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="text-sm font-bold">{member.full_name} <span className="font-normal text-ink-muted">· {member.usn}</span></p>
                              <Phase4StatusBadge label={member.confirmation_status} />
                            </div>
                            <p className="mt-1 text-xs text-ink-muted">
                              {member.is_captain ? "Captain · " : ""}{member.is_substitute ? "Substitute · " : ""}{member.weight_kg ? `${member.weight_kg} kg` : "Weight private"}
                            </p>
                            <div className="mt-2"><MemberConfirmationForm member={member} /></div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="eyebrow mb-2">Administrative correction</p>
                      <EntryCorrectionForm entry={entry} />
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <p className="eyebrow mb-2">Review decision</p>
                      <ReviewEntryForm entry={entry} />
                    </div>
                    <div className="border border-navy/10 bg-navy/[0.02] p-3 text-xs">
                      <p>Contact: {entry.contact_email ?? "—"} / {entry.contact_phone ?? "—"}</p>
                      <p className="mt-1">Payment record: {entry.payment?.proof_file_id ? <a className="font-bold text-cobalt underline" href={`/api/phase4/files/${entry.payment.proof_file_id}/download`}>view private proof</a> : entry.payment ? "recorded (no file)" : "none"}</p>
                      {entry.rejection_reason ? <p className="mt-1 text-coral-dark">Reason: {entry.rejection_reason}</p> : null}
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </Phase4Section>
    </div>
  );
}
