"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { removeEligibilityRule, setEventStatus } from "@/app/(admin)/admin/events/actions";
import {
  generateTournamentAction,
  saveManualPairings,
  setBracketLock,
  updateMatchAction,
  correctResultAction,
} from "@/app/(admin)/admin/events/[eventId]/tournament/actions";
import {
  confirmEntryMemberAction,
  editEntryDetails,
  reviewRegistration,
  verifyPaymentAction,
} from "@/app/(admin)/admin/events/[eventId]/registrations/actions";
import {
  inviteOrganizerAction,
  revokeOrganizerAssignmentAction,
  revokeOrganizerInvitationAction,
} from "@/app/(admin)/admin/events/[eventId]/organizers/actions";
import { Phase4ActionNotice } from "@/components/phase4/action-notice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ActionState } from "@/types/domain";
import type {
  Phase4EntryRow,
  Phase4EventStatus,
  Phase4MatchRow,
  Phase4MemberRow,
  Phase4PaymentRecordRow,
} from "@/types/database";

const fieldClass = "w-full border border-navy/20 bg-white px-3 py-2 text-sm";
const EVENT_STATUSES: Phase4EventStatus[] = [
  "draft", "published", "registration_open", "registration_closed",
  "ongoing", "completed", "archived",
];
const MATCH_STATUSES = [
  "scheduled", "ready", "ongoing", "postponed", "cancelled", "disputed",
];

function useActionFeedback() {
  const router = useRouter();
  const [notice, setNotice] = useState<ActionState | null>(null);
  const [pending, startTransition] = useTransition();
  const run = (
    operation: () => Promise<{ status: "success" | "error" | "idle"; message: string }>,
    refresh = true,
  ) => {
    setNotice(null);
    startTransition(async () => {
      const result = await operation();
      setNotice(result);
      if (result.status === "success" && refresh) router.refresh();
    });
  };
  return { notice, pending, run };
}

export function EventStatusControl({
  eventId,
  status,
}: {
  eventId: string;
  status: Phase4EventStatus;
}) {
  const { notice, pending, run } = useActionFeedback();
  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        run(() => setEventStatus(eventId, String(data.get("status") ?? "draft")));
      }}
    >
      <Phase4ActionNotice state={notice} />
      <div className="space-y-2">
        <Label htmlFor="eventStatus">Event status</Label>
        <select id="eventStatus" name="status" defaultValue={status} className={fieldClass}>
          {EVENT_STATUSES.map((item) => (
            <option key={item} value={item}>{item.replaceAll("_", " ")}</option>
          ))}
        </select>
      </div>
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        {pending ? "Updating…" : "Update status"}
      </Button>
    </form>
  );
}

export function DrawControl({
  eventId,
  sportId,
  drawId,
  drawMode,
  thirdPlace,
  locked,
}: {
  eventId: string;
  sportId: string;
  drawId: string | null;
  drawMode: "random" | "seeded" | "manual";
  thirdPlace: boolean;
  locked: boolean;
}) {
  const { notice, pending, run } = useActionFeedback();

  return (
    <div className="space-y-5 border border-navy/10 bg-white p-5">
      <div>
        <p className="eyebrow">Draw generator</p>
        <p className="mt-1 text-xs text-ink-muted">
          Uses approved, paid entries from the database. A validated plan is persisted transactionally as a new version.
        </p>
      </div>
      <Phase4ActionNotice state={notice} />
      <form
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          run(() => generateTournamentAction({
            competitionId: sportId,
            thirdPlace: data.get("thirdPlace") === "on" || thirdPlace,
            reason: String(data.get("reason") ?? "") || null,
          }));
        }}
      >
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="drawReason">Change reason (optional, recorded in draw history)</Label>
          <Input id="drawReason" name="reason" maxLength={1000} className={fieldClass} />
        </div>
        <label className="flex items-center gap-2 text-xs font-semibold">
          <input type="checkbox" name="thirdPlace" defaultChecked={thirdPlace} className="size-4 accent-[#3564E9]" />
          Include third-place match
        </label>
        <p className="text-xs text-ink-muted sm:text-right">Configured mode: <strong>{drawMode}</strong></p>
        <div className="sm:col-span-2">
          <Button type="submit" variant="lime" disabled={pending}>
            {pending ? "Generating…" : drawId ? "Regenerate validated draw" : "Generate draw"}
          </Button>
        </div>
      </form>
      {drawId ? (
        <form
          className="flex flex-wrap items-end gap-3 border-t border-navy/10 pt-4"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            run(() => setBracketLock(
              drawId,
              !locked,
              String(data.get("lockReason") ?? ""),
              eventId,
              sportId,
            ));
          }}
        >
          <div className="min-w-56 flex-1 space-y-2">
            <Label htmlFor="lockReason">Lock / unlock reason</Label>
            <Input id="lockReason" name="lockReason" maxLength={500} className={fieldClass} />
          </div>
          <Button type="submit" variant={locked ? "outline" : "default"} disabled={pending}>
            {locked ? "Unlock bracket" : "Lock bracket"}
          </Button>
        </form>
      ) : null}
    </div>
  );
}

export function ManualDrawForm({
  eventId,
  sportId,
  entries,
}: {
  eventId: string;
  sportId: string;
  entries: Array<{ id: string; label: string }>;
}) {
  const { notice, pending, run } = useActionFeedback();
  const [pairings, setPairings] = useState<Array<[string, string]>>([
    ["", ""],
  ]);

  function update(index: number, slot: 0 | 1, value: string) {
    setPairings((current) => current.map((pair, position) =>
      position === index ? ([slot === 0 ? value : pair[0], slot === 1 ? value : pair[1]] as [string, string]) : pair));
  }

  return (
    <form
      className="space-y-4 border border-navy/10 bg-white p-5"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        run(() => saveManualPairings({
          eventId,
          sportId,
          pairings: pairings
            .filter(([a, b]) => a || b)
            .map(([a, b]) => [a || null, b || null] as [string | null, string | null]),
          reason: String(data.get("reason") ?? ""),
        }));
      }}
    >
      <div>
        <p className="eyebrow">Manual knockout draw</p>
        <p className="mt-1 text-xs text-ink-muted">Pair approved competitors explicitly. Empty slots become byes where the engine allows them.</p>
      </div>
      <Phase4ActionNotice state={notice} />
      <div className="space-y-2">
        {pairings.map((pair, index) => (
          <div key={index} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
            {([0, 1] as const).map((slot) => (
              <select
                key={slot}
                aria-label={`Pair ${index + 1} slot ${slot + 1}`}
                value={pair[slot]}
                onChange={(change) => update(index, slot, change.target.value)}
                className={fieldClass}
              >
                <option value="">Bye / TBD</option>
                {entries.map((entry) => (
                  <option key={entry.id} value={entry.id}>{entry.label}</option>
                ))}
              </select>
            ))}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setPairings((current) => current.filter((_, position) => position !== index))}
            >
              Remove
            </Button>
          </div>
        ))}
      </div>
      <Button type="button" variant="outline" size="sm" onClick={() => setPairings((current) => [...current, ["", ""]])}>
        Add pairing
      </Button>
      <div className="space-y-2">
        <Label htmlFor="manualReason">Reason</Label>
        <Input id="manualReason" name="reason" maxLength={1000} className={fieldClass} />
      </div>
      <Button type="submit" variant="lime" disabled={pending}>{pending ? "Saving…" : "Save manual draw"}</Button>
    </form>
  );
}

export function RemoveEligibilityButton({
  ruleId,
  competitionId,
}: {
  ruleId: string;
  competitionId: string;
}) {
  const { notice, pending, run } = useActionFeedback();
  return (
    <div className="space-y-1">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={pending}
        onClick={() => run(() => removeEligibilityRule(ruleId, competitionId))}
      >
        {pending ? "Removing…" : "Remove"}
      </Button>
      <Phase4ActionNotice state={notice} />
    </div>
  );
}

export function ReviewEntryForm({ entry }: { entry: Phase4EntryRow }) {
  const { notice, pending, run } = useActionFeedback();
  return (
    <form
      className="grid items-end gap-2 sm:grid-cols-[1fr_1fr_auto]"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        run(() => reviewRegistration({
          entryId: entry.id,
          status: String(data.get("status")) as "approved",
          note: String(data.get("note") ?? ""),
        }));
      }}
    >
      <div className="space-y-1">
        <Label htmlFor={`review-${entry.id}`}>Decision</Label>
        <select id={`review-${entry.id}`} name="status" defaultValue={entry.status} className={fieldClass}>
          {["submitted", "under_review", "approved", "rejected", "waitlisted", "withdrawn"].map((status) => (
            <option key={status} value={status}>{status.replaceAll("_", " ")}</option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor={`review-note-${entry.id}`}>Note</Label>
        <Input id={`review-note-${entry.id}`} name="note" maxLength={1000} className={fieldClass} />
      </div>
      <Button type="submit" variant="lime" size="sm" disabled={pending}>{pending ? "Saving…" : "Apply"}</Button>
      <div className="sm:col-span-3"><Phase4ActionNotice state={notice} /></div>
    </form>
  );
}

export function PaymentReviewForm({ payment }: { payment: Phase4PaymentRecordRow }) {
  const { notice, pending, run } = useActionFeedback();
  return (
    <form
      className="grid items-end gap-2 sm:grid-cols-[1fr_1fr_auto]"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        run(() => verifyPaymentAction({
          paymentId: payment.id,
          status: String(data.get("status")) as "verified",
          note: String(data.get("note") ?? ""),
        }));
      }}
    >
      <div className="space-y-1">
        <Label htmlFor={`payment-${payment.id}`}>Verification</Label>
        <select id={`payment-${payment.id}`} name="status" defaultValue={payment.status} className={fieldClass}>
          {["pending_verification", "verified", "rejected", "waived", "refunded", "not_required"].map((status) => (
            <option key={status} value={status}>{status.replaceAll("_", " ")}</option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor={`payment-note-${payment.id}`}>Note</Label>
        <Input id={`payment-note-${payment.id}`} name="note" maxLength={1000} className={fieldClass} />
      </div>
      <Button type="submit" variant="lime" size="sm" disabled={pending}>{pending ? "Saving…" : "Apply"}</Button>
      <div className="sm:col-span-3"><Phase4ActionNotice state={notice} /></div>
    </form>
  );
}

export function EntryCorrectionForm({ entry }: { entry: Phase4EntryRow }) {
  const { notice, pending, run } = useActionFeedback();
  return (
    <form
      className="grid items-end gap-2 sm:grid-cols-[1fr_100px_1fr_auto]"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        run(() => editEntryDetails({
          entryId: entry.id,
          teamName: String(data.get("teamName") ?? "") || null,
          seed: Number(data.get("seed")) || null,
          note: String(data.get("note") ?? ""),
        }));
      }}
    >
      <div className="space-y-1">
        <Label htmlFor={`team-${entry.id}`}>Team name</Label>
        <Input id={`team-${entry.id}`} name="teamName" defaultValue={entry.team_name ?? ""} className={fieldClass} />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`seed-${entry.id}`}>Seed</Label>
        <Input id={`seed-${entry.id}`} name="seed" type="number" min={1} defaultValue={entry.seed ?? ""} className={fieldClass} />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`edit-note-${entry.id}`}>Reason</Label>
        <Input id={`edit-note-${entry.id}`} name="note" defaultValue="Administrative correction." className={fieldClass} />
      </div>
      <Button type="submit" variant="outline" size="sm" disabled={pending}>{pending ? "Saving…" : "Correct"}</Button>
      <div className="sm:col-span-4"><Phase4ActionNotice state={notice} /></div>
    </form>
  );
}

export function MemberConfirmationForm({ member }: { member: Phase4MemberRow }) {
  const { notice, pending, run } = useActionFeedback();
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        run(() => confirmEntryMemberAction({
          memberId: member.id,
          status: String(data.get("status")) as "verified",
        }));
      }}
    >
      <div className="space-y-1">
        <Label htmlFor={`member-${member.id}`}>{member.full_name} ({member.usn})</Label>
        <select id={`member-${member.id}`} name="status" defaultValue={member.confirmation_status} className={fieldClass}>
          {["pending", "accepted", "declined", "verified"].map((status) => (
            <option key={status} value={status}>{status}</option>
          ))}
        </select>
      </div>
      <Button type="submit" size="sm" variant="outline" disabled={pending}>{pending ? "Saving…" : "Update"}</Button>
      <Phase4ActionNotice state={notice} />
    </form>
  );
}

export function OrganizerInviteForm({
  competitionId,
  students,
}: {
  competitionId: string;
  students: Array<{ id: string; fullName: string; usn: string }>;
}) {
  const { notice, pending, run } = useActionFeedback();
  const [link, setLink] = useState("");
  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        setNotice(null);
        setLink("");
        startTransition(async () => {
          const result = await inviteOrganizerAction({
            competitionId,
            studentDirectoryId: String(data.get("studentDirectoryId") ?? ""),
            expiresHours: Number(data.get("expiresHours") ?? 72),
          });
          setNotice(result);
          if (result.status === "success") {
            router.refresh();
            if (result.token) setLink(`/organizer/invitations?token=${encodeURIComponent(result.token)}`);
          }
        });
      }}
    >
      <Phase4ActionNotice state={notice} />
      <div className="grid gap-3 sm:grid-cols-[1fr_120px_auto] sm:items-end">
        <div className="space-y-2">
          <Label htmlFor="organizerStudent">Student</Label>
          <select id="organizerStudent" name="studentDirectoryId" required className={fieldClass}>
            <option value="">Choose a student…</option>
            {students.map((student) => (
              <option key={student.id} value={student.id}>{student.fullName} · {student.usn}</option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="expiresHours">Expires in (hours)</Label>
          <Input id="expiresHours" name="expiresHours" type="number" min={1} max={720} defaultValue={72} className={fieldClass} />
        </div>
        <Button type="submit" variant="lime" disabled={pending}>{pending ? "Inviting…" : "Invite organiser"}</Button>
      </div>
      {link ? (
        <div className="border border-lime bg-lime/10 p-3 text-xs">
          <p className="font-bold">Share this one-time link privately:</p>
          <a href={link} className="mt-1 block break-all font-mono text-cobalt underline">{link}</a>
        </div>
      ) : null}
    </form>
  );
}

export function RevokeAssignmentButton({
  assignmentId,
  eventId,
  sportId,
}: {
  assignmentId: string;
  eventId: string;
  sportId: string;
}) {
  const { notice, pending, run } = useActionFeedback();
  return (
    <div className="space-y-1">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={pending}
        onClick={() => run(() => revokeOrganizerAssignmentAction(
          assignmentId, eventId, sportId, "Revoked by PE Admin",
        ))}
      >
        {pending ? "Revoking…" : "Revoke"}
      </Button>
      <Phase4ActionNotice state={notice} />
    </div>
  );
}

export function RevokeInvitationButton({
  invitationId,
  eventId,
  sportId,
}: {
  invitationId: string;
  eventId: string;
  sportId: string;
}) {
  const { notice, pending, run } = useActionFeedback();
  return (
    <div className="space-y-1">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={pending}
        onClick={() => run(() => revokeOrganizerInvitationAction(
          invitationId, eventId, sportId, "Revoked by PE Admin",
        ))}
      >
        {pending ? "Revoking…" : "Revoke"}
      </Button>
      <Phase4ActionNotice state={notice} />
    </div>
  );
}

export function MatchScheduleForm({
  match,
  organizers,
}: {
  match: Phase4MatchRow;
  organizers: Array<{ id: string; label: string }>;
}) {
  const { notice, pending, run } = useActionFeedback();
  return (
    <form
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        run(() => updateMatchAction({
          matchId: match.id,
          startsAt: String(data.get("startsAt") ?? "") || null,
          endsAt: String(data.get("endsAt") ?? "") || null,
          venue: String(data.get("venue") ?? "") || null,
          status: String(data.get("status")) as "scheduled",
          organizerId: String(data.get("organizerId") ?? "") || null,
          notes: String(data.get("notes") ?? "") || null,
          reason: String(data.get("reason") ?? "Schedule updated by PE Admin."),
        }));
      }}
    >
      <div className="space-y-1">
        <Label htmlFor={`start-${match.id}`}>Starts at</Label>
        <Input id={`start-${match.id}`} name="startsAt" type="datetime-local" defaultValue={match.starts_at?.slice(0, 16) ?? ""} className={fieldClass} />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`end-${match.id}`}>Ends at</Label>
        <Input id={`end-${match.id}`} name="endsAt" type="datetime-local" defaultValue={match.ends_at?.slice(0, 16) ?? ""} className={fieldClass} />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`venue-${match.id}`}>Venue</Label>
        <Input id={`venue-${match.id}`} name="venue" defaultValue={match.venue ?? ""} className={fieldClass} />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`status-${match.id}`}>Status</Label>
        <select id={`status-${match.id}`} name="status" defaultValue={match.status} className={fieldClass}>
          {[...MATCH_STATUSES, "result_submitted", "completed"].map((status) => (
            <option key={status} value={status}>{status.replaceAll("_", " ")}</option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor={`organizer-${match.id}`}>Assigned organiser</Label>
        <select id={`organizer-${match.id}`} name="organizerId" defaultValue={match.organizer_id ?? ""} className={fieldClass}>
          <option value="">Unassigned</option>
          {organizers.map((organizer) => (
            <option key={organizer.id} value={organizer.id}>{organizer.label}</option>
          ))}
        </select>
      </div>
      <div className="space-y-1 sm:col-span-2">
        <Label htmlFor={`notes-${match.id}`}>Notes</Label>
        <Textarea id={`notes-${match.id}`} name="notes" rows={2} defaultValue={match.notes ?? ""} className={fieldClass} />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`reason-${match.id}`}>Change reason</Label>
        <Input id={`reason-${match.id}`} name="reason" defaultValue="Schedule updated by PE Admin." className={fieldClass} />
      </div>
      <div className="flex items-end">
        <Button type="submit" variant="outline" disabled={pending}>{pending ? "Saving…" : "Save match"}</Button>
      </div>
      <div className="sm:col-span-4"><Phase4ActionNotice state={notice} /></div>
    </form>
  );
}

export function ResultCorrectionForm({
  match,
  entries,
  eventId,
  sportId,
}: {
  match: Phase4MatchRow;
  entries: Array<{ id: string; label: string }>;
  eventId: string;
  sportId: string;
}) {
  const { notice, pending, run } = useActionFeedback();
  return (
    <form
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        run(() => correctResultAction(
          match.id,
          {
            scoreA: String(data.get("scoreA") ?? ""),
            scoreB: String(data.get("scoreB") ?? ""),
            winnerEntryId: String(data.get("winnerEntryId") ?? ""),
            notes: String(data.get("notes") ?? ""),
            breakdown: [],
          },
          String(data.get("reason") ?? ""),
          eventId,
          sportId,
        ));
      }}
    >
      <div className="space-y-1">
        <Label htmlFor={`score-a-${match.id}`}>Score A</Label>
        <Input id={`score-a-${match.id}`} name="scoreA" defaultValue={match.winner_entry_id ? "" : ""} className={fieldClass} />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`score-b-${match.id}`}>Score B</Label>
        <Input id={`score-b-${match.id}`} name="scoreB" className={fieldClass} />
      </div>
      <div className="space-y-1 lg:col-span-2">
        <Label htmlFor={`winner-${match.id}`}>Winner</Label>
        <select id={`winner-${match.id}`} name="winnerEntryId" required defaultValue={match.winner_entry_id ?? ""} className={fieldClass}>
          <option value="">Choose winner…</option>
          {entries.map((entry) => (
            <option key={entry.id} value={entry.id}>{entry.label}</option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor={`correction-reason-${match.id}`}>Correction reason</Label>
        <Input id={`correction-reason-${match.id}`} name="reason" required className={fieldClass} />
      </div>
      <div className="space-y-1 sm:col-span-2">
        <Label htmlFor={`result-notes-${match.id}`}>Result notes</Label>
        <Textarea id={`result-notes-${match.id}`} name="notes" rows={2} className={fieldClass} />
      </div>
      <div className="flex items-end sm:col-span-2 lg:col-span-3">
        <Button type="submit" variant="destructive" disabled={pending}>{pending ? "Correcting…" : "Correct result & advance"}</Button>
      </div>
      <div className="sm:col-span-2 lg:col-span-5"><Phase4ActionNotice state={notice} /></div>
    </form>
  );
}
