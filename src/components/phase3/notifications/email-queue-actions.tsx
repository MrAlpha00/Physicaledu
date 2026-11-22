"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Send } from "lucide-react";
import { retryFailedEmails, sendNextEmailBatch } from "@/app/(admin)/admin/notifications/actions";
import { Button } from "@/components/ui/button";
import type { ActionState } from "@/types/domain";
import { NotificationActionNotice } from "./action-notice";

export function EmailQueueActions({
  emailAnnouncementId,
  hasQueued,
  hasFailed,
}: {
  emailAnnouncementId: string;
  hasQueued: boolean;
  hasFailed: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<ActionState | null>(null);

  function run(action: () => Promise<ActionState>) {
    setNotice(null);
    startTransition(async () => {
      const result = await action();
      setNotice(result);
      if (result.status === "success") router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="lime"
          size="sm"
          disabled={pending || !hasQueued}
          onClick={() => run(() => sendNextEmailBatch({ emailAnnouncementId }))}
        >
          <Send /> {pending ? "Working…" : "Send next batch"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending || !hasFailed}
          onClick={() => run(() => retryFailedEmails({ emailAnnouncementId }))}
        >
          <RefreshCw /> Retry failed
        </Button>
      </div>
      <NotificationActionNotice state={notice} />
      <p className="text-[11px] text-ink-muted">Each batch is capped at 25 messages. The daily cap is enforced on the server.</p>
    </div>
  );
}
