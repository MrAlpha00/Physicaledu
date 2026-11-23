"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  acceptOrganizerInvitationAction,
  setOrganizerMatchStatusAction,
  submitOrganizerResultAction,
} from "@/app/(student)/organizer/actions";
import { Phase4ActionNotice } from "@/components/phase4/action-notice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ActionState } from "@/types/domain";
import type { Phase4MatchRow } from "@/types/database";

const fieldClass = "w-full border border-navy/20 bg-white px-3 py-2 text-sm";

function useFeedback() {
  const router = useRouter();
  const [notice, setNotice] = useState<ActionState | null>(null);
  const [pending, startTransition] = useTransition();
  const run = (operation: () => Promise<ActionState>) => {
    setNotice(null);
    startTransition(async () => {
      const result = await operation();
      setNotice(result);
      if (result.status === "success") router.refresh();
    });
  };
  return { notice, pending, run };
}

export function AcceptInvitationForm({ initialToken = "" }: { initialToken?: string }) {
  const { notice, pending, run } = useFeedback();
  return (
    <form
      className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        run(() => acceptOrganizerInvitationAction(String(data.get("token") ?? "")));
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="invitationToken">Invitation token</Label>
        <Input
          id="invitationToken"
          name="token"
          required
          defaultValue={initialToken}
          placeholder="Paste the private token from your invitation"
          className={fieldClass}
        />
      </div>
      <Button type="submit" variant="lime" disabled={pending}>
        {pending ? "Accepting…" : "Accept invitation"}
      </Button>
      <div className="sm:col-span-2"><Phase4ActionNotice state={notice} /></div>
    </form>
  );
}

export function OrganizerMatchStatusForm({ match }: { match: Phase4MatchRow }) {
  const { notice, pending, run } = useFeedback();
  return (
    <form
      className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        run(() => setOrganizerMatchStatusAction({
          matchId: match.id,
          status: String(data.get("status")) as "ongoing",
          venue: String(data.get("venue") ?? "") || null,
          notes: String(data.get("notes") ?? "") || null,
        }));
      }}
    >
      <div className="space-y-1">
        <Label htmlFor={`organizer-status-${match.id}`}>Live status</Label>
        <select id={`organizer-status-${match.id}`} name="status" defaultValue={match.status} className={fieldClass}>
          {["scheduled", "ready", "ongoing", "postponed", "cancelled", "disputed"].map((status) => (
            <option key={status} value={status}>{status.replaceAll("_", " ")}</option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor={`organizer-venue-${match.id}`}>Venue</Label>
        <Input id={`organizer-venue-${match.id}`} name="venue" defaultValue={match.venue ?? ""} className={fieldClass} />
      </div>
      <div className="flex items-end">
        <Button type="submit" variant="outline" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Update"}
        </Button>
      </div>
      <div className="space-y-1 sm:col-span-3">
        <Label htmlFor={`organizer-notes-${match.id}`}>Match notes</Label>
        <Textarea id={`organizer-notes-${match.id}`} name="notes" rows={2} defaultValue={match.notes ?? ""} className={fieldClass} />
      </div>
      <div className="sm:col-span-3"><Phase4ActionNotice state={notice} /></div>
    </form>
  );
}

export function OrganizerResultForm({
  match,
  entries,
}: {
  match: Phase4MatchRow;
  entries: Array<{ id: string; label: string }>;
}) {
  const { notice, pending, run } = useFeedback();
  return (
    <form
      className="grid gap-3 sm:grid-cols-4"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        run(() => submitOrganizerResultAction({
          matchId: match.id,
          scoreA: String(data.get("scoreA") ?? ""),
          scoreB: String(data.get("scoreB") ?? ""),
          winnerEntryId: String(data.get("winnerEntryId") ?? ""),
          notes: String(data.get("notes") ?? ""),
          breakdown: [],
        }));
      }}
    >
      <div className="space-y-1">
        <Label htmlFor={`organizer-score-a-${match.id}`}>Score A</Label>
        <Input id={`organizer-score-a-${match.id}`} name="scoreA" className={fieldClass} />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`organizer-score-b-${match.id}`}>Score B</Label>
        <Input id={`organizer-score-b-${match.id}`} name="scoreB" className={fieldClass} />
      </div>
      <div className="space-y-1 sm:col-span-2">
        <Label htmlFor={`organizer-winner-${match.id}`}>Winner</Label>
        <select id={`organizer-winner-${match.id}`} name="winnerEntryId" required defaultValue="" className={fieldClass}>
          <option value="">Choose winner…</option>
          {entries.map((entry) => (
            <option key={entry.id} value={entry.id}>{entry.label}</option>
          ))}
        </select>
      </div>
      <div className="space-y-1 sm:col-span-4">
        <Label htmlFor={`organizer-result-notes-${match.id}`}>Result notes</Label>
        <Textarea id={`organizer-result-notes-${match.id}`} name="notes" rows={2} className={fieldClass} />
      </div>
      <div className="sm:col-span-4">
        <Button type="submit" variant="lime" disabled={pending}>
          {pending ? "Submitting…" : "Submit result"}
        </Button>
      </div>
      <div className="sm:col-span-4"><Phase4ActionNotice state={notice} /></div>
    </form>
  );
}

export function ParticipantInvitationResponse({
  token,
  respond,
}: {
  token: string;
  respond: (token: string, accept: boolean) => Promise<ActionState>;
}) {
  const { notice, pending, run } = useFeedback();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="lime"
        size="sm"
        disabled={pending}
        onClick={() => run(() => respond(token, true))}
      >
        {pending ? "Saving…" : "Confirm participation"}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => run(() => respond(token, false))}
      >
        Decline
      </Button>
      <Phase4ActionNotice state={notice} />
    </div>
  );
}
