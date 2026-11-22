"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateFeedback } from "@/app/(admin)/admin/feedback/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { canFeedbackTransition } from "@/lib/operations/phase3";
import type { FeedbackPriority, FeedbackStatus } from "@/types/database";
import type { FeedbackRequestView } from "@/types/domain";
import { FeedbackActionNotice } from "./action-notice";

const STATUSES: FeedbackStatus[] = [
  "submitted", "under_review", "in_progress", "waiting_for_student", "resolved", "rejected", "closed",
];
const PRIORITIES: FeedbackPriority[] = ["low", "normal", "high", "urgent"];

export function FeedbackUpdateForm({ request }: { request: FeedbackRequestView }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<FeedbackStatus>(request.status);
  const [priority, setPriority] = useState<FeedbackPriority>(request.priority);
  const [response, setResponse] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [notice, setNotice] = useState<{ message: string; error: boolean } | null>(null);
  const locked = request.status === "closed";

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    startTransition(async () => {
      const result = await updateFeedback({
        requestId: request.id,
        status,
        priority,
        response,
        internalNote,
      });
      setNotice({ message: result.message, error: result.status === "error" });
      if (result.status === "success") {
        setResponse("");
        setInternalNote("");
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4 border-t-4 border-t-cobalt bg-white p-5 shadow-sm">
      <div>
        <p className="eyebrow text-cobalt">Admin response</p>
        <h2 className="mt-1 text-xl font-bold">Update request</h2>
        {locked ? <p className="mt-1 text-xs text-coral-dark">Closed requests cannot be changed further.</p> : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink-muted">
          Status
          <select
            className="mt-2 h-11 w-full rounded-md border border-input bg-white px-3 text-sm"
            value={status}
            disabled={locked}
            onChange={(event) => setStatus(event.target.value as FeedbackStatus)}
          >
            {STATUSES.map((value) => (
              <option key={value} value={value} disabled={!canFeedbackTransition(request.status, value)}>
                {value.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink-muted">
          Priority
          <select
            className="mt-2 h-11 w-full rounded-md border border-input bg-white px-3 text-sm"
            value={priority}
            disabled={locked}
            onChange={(event) => setPriority(event.target.value as FeedbackPriority)}
          >
            {PRIORITIES.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
      </div>

      <label className="block text-[10px] font-bold uppercase tracking-[0.14em] text-ink-muted">
        Public response
        <Textarea
          className="mt-2"
          rows={4}
          maxLength={2000}
          value={response}
          onChange={(event) => setResponse(event.target.value)}
          placeholder="Visible to the student in the thread"
          disabled={locked}
        />
      </label>
      <label className="block text-[10px] font-bold uppercase tracking-[0.14em] text-ink-muted">
        Internal note
        <Input
          className="mt-2"
          maxLength={1000}
          value={internalNote}
          onChange={(event) => setInternalNote(event.target.value)}
          placeholder="PE staff only — never shown to students"
          disabled={locked}
        />
      </label>
      <p className="text-[11px] text-ink-muted">
        Both fields are optional. Saving records a status-history entry and notifies the student.
      </p>

      <FeedbackActionNotice state={notice ? { status: notice.error ? "error" : "success", message: notice.message } : null} />
      <Button type="submit" variant="cobalt" disabled={pending || locked} className="w-full">
        {pending ? "Saving…" : "Save update"}
      </Button>
    </form>
  );
}
