import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { RegistrationForm } from "@/components/phase4/registration-form";
import { Phase4Header, Phase4Notice } from "@/components/phase4/common";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/session";
import { getPublicEvent, getPublicSport, getSportContext } from "@/lib/data/phase4";

export const metadata: Metadata = { title: "Register" };
export const dynamic = "force-dynamic";

export default async function RegisterPage({
  params,
}: {
  params: Promise<{ slug: string; sportSlug: string }>;
}) {
  const { slug, sportSlug } = await params;
  const event = await getPublicEvent(slug);
  if (!event) notFound();
  const sport = await getPublicSport(event.id, sportSlug);
  if (!sport) notFound();
  const [context, user] = await Promise.all([getSportContext(event.id, sport.id), getCurrentUser()]);
  const base = `/events/${event.slug}/${sport.slug}`;
  const registrationOpen = ["published", "registration_open"].includes(sport.status);

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-5 py-10 sm:px-8">
      <Link href={base} className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.1em] text-ink-muted hover:text-navy"><ArrowLeft className="size-4" /> Competition details</Link>
      <Phase4Header
        kicker={`${event.name} / Registration`}
        title={sport.name}
        description="Every USN is verified against the official student directory. Submissions are reviewed by PE Admin before they enter the draw."
      />
      {!user ? (
        <div className="border border-navy/10 bg-white p-8 text-center">
          <p className="font-barlow text-2xl uppercase text-navy">Sign in to register</p>
          <p className="mt-2 text-sm text-ink-muted">Use your college account so the captain can be linked to their directory record.</p>
          <div className="mt-5"><Button asChild variant="lime"><Link href={`/login?next=${encodeURIComponent(`/events/${event.slug}/${sport.slug}/register`)}`}>Sign in</Link></Button></div>
        </div>
      ) : !registrationOpen ? (
        <Phase4Notice>Registration is currently closed for this competition.</Phase4Notice>
      ) : (
        <div className="border border-navy/10 bg-white p-6">
          <RegistrationForm
            competitionId={sport.id}
            mode={sport.mode}
            rules={context?.rules ?? null}
            defaultEmail={user.email ?? ""}
          />
        </div>
      )}
    </div>
  );
}
