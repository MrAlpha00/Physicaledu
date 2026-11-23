import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AcceptInvitationForm } from "@/components/phase4/organizer-controls";
import { Phase4Header, Phase4Section } from "@/components/phase4/common";
import { requireUser } from "@/lib/auth/session";
import { getMyOrganizerInvitations } from "@/lib/data/phase4";

export const metadata: Metadata = { title: "Organiser invitations" };
export const dynamic = "force-dynamic";

export default async function OrganizerInvitationsPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const user = await requireUser();
  const { token } = await searchParams;
  const invitations = await getMyOrganizerInvitations(user.id);

  return (
    <div className="space-y-8">
      <Link href="/organizer" className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.1em] text-ink-muted hover:text-navy"><ArrowLeft className="size-4" /> Organiser desk</Link>
      <Phase4Header
        kicker="Phase 4 / Organiser"
        title="Organiser invitations"
        description="Accept a one-time private token to manage a specific sport. Invitations are bound to your directory record."
      />
      <div className="border border-navy/10 bg-white p-6"><AcceptInvitationForm initialToken={token ?? ""} /></div>
      <Phase4Section title={`Pending invitations (${invitations.length})`}>
        {invitations.length === 0 ? <p className="text-sm text-ink-muted">No pending invitations found for your directory record.</p> : (
          <div className="space-y-2">
            {invitations.map(({ invitation, sport, event }) => (
              <div key={invitation.id} className="border border-navy/10 bg-white p-4 text-sm">
                <p className="font-bold">{event.name} — {sport.name}</p>
                <p className="text-xs text-ink-muted">Expires {new Date(invitation.expires_at).toLocaleString()}</p>
              </div>
            ))}
          </div>
        )}
      </Phase4Section>
    </div>
  );
}
