"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { replyFeedback } from "@/app/(student)/feedback/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FeedbackActionNotice } from "./action-notice";

export function FeedbackReplyForm({ requestId, locked }: { requestId: string; locked: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [body, setBody] = useState("");
  const [notice, setNotice] = useState<{ message: string; error: boolean } | null>(null);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    startTransition(async () => {
      const result = await replyFeedback({ requestId, body });
      setNotice({ message: result.message, error: result.status === "error" });
      if (result.status === "success") {
        setBody("");
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3 border-t-4 border-t-lime bg-white p-5 shadow-sm">
      <div>
        <p className="eyebrow text-cobalt">Add to thread</p>
        <h2 className="mt-1 text-xl font-bold">Your reply</h2>
      </div>
      <Textarea
        aria-label="Reply"
        rows={4}
        minLength={2}
        maxLength={2000}
        required
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder="Add context or answer a question from the department"
        disabled={locked}
      />
      {locked ? <p className="text-xs text-coral-dark">Closed requests cannot accept further replies.</p> : null}
      <FeedbackActionNotice state={notice ? { status: notice.error ? "error" : "success", message: notice.message } : null} />
      <Button type="submit" variant="lime" disabled={pending || locked} className="w-full">
        {pending ? "Sending…" : "Send reply"}
      </Button>
    </form>
  );
}
