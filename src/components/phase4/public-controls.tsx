"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { respondParticipantInvitationAction } from "@/app/(public)/events/actions";
import { Phase4ActionNotice } from "@/components/phase4/action-notice";
import { Button } from "@/components/ui/button";
import type { ActionState } from "@/types/domain";

export function ParticipantInvitationForm({ token }: { token: string }) {
  const router = useRouter();
  const [notice, setNotice] = useState<ActionState | null>(null);
  const [pending, startTransition] = useTransition();

  function respond(accept: boolean) {
    setNotice(null);
    startTransition(async () => {
      const result = await respondParticipantInvitationAction({ token, accept });
      setNotice(result);
      if (result.status === "success") router.refresh();
    });
  }

  return (
    <div className="space-y-3 border border-lime bg-lime/10 p-4">
      <p className="text-sm font-bold text-navy">Participation confirmation</p>
      <p className="text-xs text-ink-muted">Confirm that you will take part, or decline so the organiser can release your place.</p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="lime" disabled={pending} onClick={() => respond(true)}>Confirm participation</Button>
        <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => respond(false)}>Decline</Button>
      </div>
      <Phase4ActionNotice state={notice} />
    </div>
  );
}
