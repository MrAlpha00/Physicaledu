import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ClipboardList, CreditCard, Trophy } from "lucide-react";
import { ParticipantInvitationForm } from "@/components/phase4/public-controls";
import { Phase4Header, Phase4Section, Phase4StatusBadge } from "@/components/phase4/common";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/session";
import {
  getPublicEvent,
  getPublicFiles,
  getPublicSport,
  getSportContext,
} from "@/lib/data/phase4";

export const metadata: Metadata = { title: "Competition" };
export const dynamic = "force-dynamic";

export default async function PublicSportPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; sportSlug: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { slug, sportSlug } = await params;
  const { token } = await searchParams;
  const event = await getPublicEvent(slug);
  if (!event) notFound();
  const sport = await getPublicSport(event.id, sportSlug);
  if (!sport) notFound();
  const [context, user] = await Promise.all([
    getSportContext(event.id, sport.id),
    getCurrentUser(),
  ]);
  const rules = context?.rules ?? null;
  const payment = context?.payment ?? null;
  const files = await getPublicFiles([sport.image_file_id, payment?.qr_file_id ?? null]);
  const image = files.find((file) => file.id === sport.image_file_id);
  const qr = files.find((file) => file.id === payment?.qr_file_id);
  const registrationOpen = ["published", "registration_open"].includes(sport.status);

  return (
    <div className="mx-auto max-w-6xl space-y-10 px-5 py-10 sm:px-8">
      <Link href={`/events/${event.slug}`} className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.1em] text-ink-muted hover:text-navy"><ArrowLeft className="size-4" /> {event.name}</Link>
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/api/phase4/files/${image.id}/download`} alt={`${sport.name} image`} className="h-56 w-full object-cover" />
      ) : null}
      <Phase4Header
        kicker={`${event.name} / Competition`}
        title={sport.name}
        description={sport.description ?? "Competition details are being prepared."}
        actions={<Phase4StatusBadge label={sport.status} />}
      />
      {token && token.length >= 20 ? <ParticipantInvitationForm token={token} /> : null}
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-8">
          <Phase4Section title="Rules & eligibility" description={rules?.eligibility_summary ?? undefined}>
            <div className="whitespace-pre-wrap border border-navy/10 bg-white p-5 text-sm">
              {rules?.public_rules ?? "Published rules will be added by the PE Department."}
            </div>
            {rules?.required_participant_fields?.length || rules?.custom_questions ? (
              <div className="border border-navy/10 bg-white p-5 text-xs text-ink-muted">
                <p className="font-bold uppercase text-navy">Additional information requested</p>
                <p className="mt-2">{(rules?.required_participant_fields ?? []).join(", ") || "Custom registration questions apply."}</p>
              </div>
            ) : null}
          </Phase4Section>
          <Phase4Section title="Schedule" description={`${sport.mode} competition · ${sport.venue ?? "Venue TBA"}`}>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="border border-navy/10 bg-white p-4 text-xs"><p className="font-bold uppercase text-ink-muted">Registration opens</p><p className="mt-1">{sport.registration_start ?? "—"}</p></div>
              <div className="border border-navy/10 bg-white p-4 text-xs"><p className="font-bold uppercase text-ink-muted">Deadline</p><p className="mt-1">{sport.registration_deadline ?? "—"}</p></div>
              <div className="border border-navy/10 bg-white p-4 text-xs"><p className="font-bold uppercase text-ink-muted">Competition date</p><p className="mt-1">{sport.competition_date ?? "—"}</p></div>
            </div>
          </Phase4Section>
        </div>
        <div className="space-y-4">
          <div className="border-2 border-navy bg-navy p-5 text-chalk">
            <ClipboardList className="size-6 text-lime" />
            <p className="mt-3 font-barlow text-2xl uppercase">Register</p>
            <p className="mt-2 text-xs text-chalk/70">
              {registrationOpen
                ? "Submit your entry for PE Admin review. You can upload payment proof after submission."
                : "Registration is not currently open for this competition."}
            </p>
            <div className="mt-4">
              <Button asChild variant="lime" disabled={!registrationOpen || !user}>
                <Link href={`/events/${event.slug}/${sport.slug}/register`}>{user ? "Start registration" : "Sign in to register"}</Link>
              </Button>
            </div>
          </div>
          {payment?.is_required ? (
            <div className="border border-navy/10 bg-white p-5">
              <CreditCard className="size-5 text-cobalt" />
              <p className="mt-2 font-barlow text-xl uppercase">Payment</p>
              <p className="mt-1 font-bold text-navy">{payment.fee_amount ?? "Amount TBA"} per {payment.payment_unit}</p>
              <p className="mt-2 whitespace-pre-wrap text-xs text-ink-muted">{payment.instructions ?? "Pay using the QR code and upload proof in My Events."}</p>
              {qr ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`/api/phase4/files/${qr.id}/download`} alt="Payment QR" className="mt-3 h-40 w-40 object-contain" />
              ) : null}
              {payment.payment_deadline ? <p className="mt-2 text-xs text-coral-dark">Deadline: {new Date(payment.payment_deadline).toLocaleString()}</p> : null}
            </div>
          ) : null}
          <Button asChild variant="outline" className="w-full"><Link href={`/events/${event.slug}/${sport.slug}/results`}><Trophy /> View results</Link></Button>
        </div>
      </div>
    </div>
  );
}
