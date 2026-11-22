"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Send, Save } from "lucide-react";
import { saveTaskSubmission } from "@/app/(student)/tasks/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { MyTaskView } from "@/types/domain";

export function TaskSubmissionForm({ task }: { task: MyTaskView }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [text, setText] = useState(task.submission?.textContent ?? "");
  const [link, setLink] = useState(task.submission?.linkUrl ?? "");
  const locked = Boolean(
    task.submission && ["reviewed", "completed"].includes(task.submission.status),
  );
  const overdue = new Date().getTime() > new Date(task.dueAt).getTime();

  function save(submit: boolean) {
    setMessage(null);
    startTransition(async () => {
      const result = await saveTaskSubmission({
        taskId: task.id,
        textContent: text,
        linkUrl: link,
        submit,
      });
      setMessage({ tone: result.status === "success" ? "ok" : "error", text: result.message });
      if (result.status === "success") router.refresh();
    });
  }

  if (locked) {
    return (
      <p className="border border-border bg-muted/40 p-5 text-sm text-ink-muted">
        This submission has been reviewed and is locked. Feedback:{" "}
        <span className="font-bold text-navy">{task.submission?.feedback || "No written feedback"}</span>
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {task.submission?.feedback ? (
        <p className="border-l-4 border-l-coral bg-coral/10 p-4 text-sm text-[#8b3725]">
          <span className="font-bold">Feedback from PE department:</span> {task.submission.feedback}
        </p>
      ) : null}
      {task.allowText ? (
        <div>
          <Label htmlFor="submission-text">Your response</Label>
          <Textarea
            id="submission-text"
            className="mt-2"
            rows={8}
            maxLength={10000}
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Write your answer here…"
          />
        </div>
      ) : null}
      {task.allowLinks ? (
        <div>
          <Label htmlFor="submission-link">Link to your work (https://)</Label>
          <Input
            id="submission-link"
            className="mt-2"
            type="url"
            value={link}
            onChange={(event) => setLink(event.target.value)}
            placeholder="https://"
          />
        </div>
      ) : null}
      {message ? (
        <p role="status" className={`text-sm ${message.tone === "ok" ? "text-[#4b711d]" : "text-coral-dark"}`}>
          {message.text}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <Button
          variant="outline"
          disabled={pending || overdue}
          onClick={() => save(false)}
        >
          <Save /> Save draft
        </Button>
        <Button variant="lime" disabled={pending || overdue} onClick={() => save(true)}>
          {pending ? <LoaderCircle className="animate-spin" /> : <Send />}
          Submit for review
        </Button>
      </div>
      {overdue ? (
        <p className="text-xs text-coral-dark">
          The deadline has passed. Contact the PE department if you need a correction.
        </p>
      ) : null}
    </div>
  );
}
