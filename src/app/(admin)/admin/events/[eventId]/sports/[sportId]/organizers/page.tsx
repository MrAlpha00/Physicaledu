import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  OrganizerInviteForm,
  RevokeAssignmentButton,
  RevokeInvitationButton,
} from "@/components/phase4/admin-controls";
import { Phase4Header, Phase4Section, Phase4StatusBadge } from "@/components/phase4/common";
import { Button } from "@/components/ui/button";
import {
  getPhase4DirectoryOptions,
  getSportAssignments,
  getSportContext,
  getSportInvitations,
} from "@/lib/data/phase4";

export const metadata: Metadata = { title: "Sport organisers" };
export const dynamic = "force-dynamic";

export default async function OrganizersPage({
  params,
}: {
  params: Promise<{ eventId: string; sportId: string }>;
}) {
  const { eventId, sportId } = await params;
  const [context, assignments, invitations, students] = await Promise.all([
    getSportContext(eventId, sportId),
    getSportAssignments(sportId),
    getSportInvitations(sportId),
    getPhase4DirectoryOptions(),
  ]);
  if (!context) notFound();
  const base = `/admin/events/${eventId}/sports/${sportId}`;

  return (
    <div className="space-y-8">
      <Phase4Header
        kicker="Phase 4 / Organisers"
        title={`${context.sport.name} — organisers`}
        description="Invite students as organisers for this sport only. Organisers never receive global PE Admin permissions."
        actions={<Button asChild variant="outline"><Link href={base}>Back to configuration</Link></Button>}
      />
      <div className="border border-navy/10 bg-white p-6">
        <p className="eyebrow mb-4">Invite an organiser</p>
        <OrganizerInviteForm competitionId={sportId} students={students} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Phase4Section title={`Active assignments (${assignments.length})`}>
          {assignments.length === 0 ? <p className="border border-dashed border-navy/25 bg-white p-6 text-center text-sm text-ink-muted">No active organisers.</p> : (
            <div className="space-y-2">
              {assignments.map((assignment) => (
                <div key={assignment.id} className="flex flex-wrap items-center justify-between gap-3 border border-navy/10 bg-white p-4 text-sm">
                  <div>
                    <p className="font-bold">User {assignment.user_id.slice(0, 8)}</p>
                    <p className="text-xs text-ink-muted">Results: {assignment.can_submit_results ? "allowed" : "not allowed"}</p>
                  </div>
                  <RevokeAssignmentButton assignmentId={assignment.id} eventId={eventId} sportId={sportId} />
                </div>
              ))}
            </div>
          )}
        </Phase4Section>
        <Phase4Section title={`Invitations (${invitations.length})`}>
          {invitations.length === 0 ? <p className="border border-dashed border-navy/25 bg-white p-6 text-center text-sm text-ink-muted">No invitations issued.</p> : (
            <div className="space-y-2">
              {invitations.map((invitation) => (
                <div key={invitation.id} className="flex flex-wrap items-center justify-between gap-3 border border-navy/10 bg-white p-4 text-sm">
                  <div>
                    <p className="font-bold">Directory {invitation.student_directory_id.slice(0, 8)}</p>
                    <p className="text-xs text-ink-muted">Expires {new Date(invitation.expires_at).toLocaleString()}</p>
                    <div className="mt-1"><Phase4StatusBadge label={invitation.accepted_at ? "accepted" : invitation.revoked_at ? "revoked" : "pending"} /></div>
                  </div>
                  <RevokeInvitationButton invitationId={invitation.id} eventId={eventId} sportId={sportId} />
                </div>
              ))}
            </div>
          )}
        </Phase4Section>
      </div>
    </div>
  );
}
