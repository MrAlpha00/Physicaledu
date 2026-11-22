"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { reviewTaskSubmission } from "@/app/(admin)/admin/classroom/tasks/actions";
import { TaskBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatIstDateTime } from "@/lib/time/india";
import type { TaskSubmissionStatus } from "@/types/database";
import type { TaskSubmissionView } from "@/types/domain";

export function TaskSubmissionsPanel({ submissions }: { submissions: TaskSubmissionView[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [feedbackFor, setFeedbackFor] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");

  function review(id: string, status: TaskSubmissionStatus, note = "") {
    setNotice(null);
    startTransition(async () => {
      const result = await reviewTaskSubmission(id, status, note);
      setNotice({ tone: result.status === "success" ? "ok" : "error", text: result.message });
      if (result.status === "success") {
        setFeedbackFor(null);
        router.refresh();
      }
    });
  }

  if (!submissions.length) {
    return (
      <p className="border border-dashed border-border bg-card/60 p-8 text-sm text-ink-muted">
        No submissions have been recorded for this selection.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {notice ? (
        <p role="status" className={`border-l-4 p-3 text-sm ${notice.tone === "ok" ? "border-l-[#8fb63c] bg-lime/40 text-[#33521b]" : "border-l-coral bg-coral/10 text-[#8b3725]"}`}>
          {notice.text}
        </p>
      ) : null}
      <div className="overflow-x-auto border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Student</TableHead>
              <TableHead>Task</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Response</TableHead>
              <TableHead>Review</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {submissions.map((submission) => (
              <TableRow key={submission.id}>
                <TableCell>
                  <p className="font-bold">{submission.fullName}</p>
                  <p className="font-mono text-xs text-ink-muted">
                    {submission.usn} · {submission.departmentCode}
                  </p>
                </TableCell>
                <TableCell className="text-xs">{submission.taskTitle}</TableCell>
                <TableCell className="text-xs text-ink-muted">
                  {submission.submittedAt ? formatIstDateTime(submission.submittedAt) : "—"}
                </TableCell>
                <TableCell><TaskBadge status={submission.displayStatus} /></TableCell>
                <TableCell className="max-w-xs">
                  {submission.textContent ? (
                    <p className="line-clamp-3 text-xs text-navy/80">{submission.textContent}</p>
                  ) : (
                    <span className="text-xs text-ink-muted">—</span>
                  )}
                  {submission.linkUrl ? (
                    <a
                      href={submission.linkUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="mt-1 block text-xs font-bold text-cobalt underline"
                    >
                      Open link
                    </a>
                  ) : null}
                  {submission.fileCount ? (
                    <p className="mt-1 text-xs text-ink-muted">{submission.fileCount} file(s)</p>
                  ) : null}
                  {submission.feedback ? (
                    <p className="mt-1 text-xs italic text-coral-dark">{submission.feedback}</p>
                  ) : null}
                </TableCell>
                <TableCell>
                  {submission.status === "submitted" || submission.status === "needs_correction" ? (
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="lime" disabled={pending} onClick={() => review(submission.id, "completed")}>
                        Complete
                      </Button>
                      <Button size="sm" variant="default" disabled={pending} onClick={() => review(submission.id, "reviewed")}>
                        Reviewed
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={pending}
                        onClick={() => {
                          setFeedbackFor(submission.id);
                          setFeedback("");
                        }}
                      >
                        Needs correction
                      </Button>
                    </div>
                  ) : (
                    <span className="text-xs text-ink-muted">Finalised</span>
                  )}
                  {feedbackFor === submission.id ? (
                    <div className="mt-3 space-y-2">
                      <Label htmlFor={`feedback-${submission.id}`}>Correction note</Label>
                      <Input
                        id={`feedback-${submission.id}`}
                        value={feedback}
                        maxLength={500}
                        onChange={(event) => setFeedback(event.target.value)}
                      />
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => setFeedbackFor(null)}>
                          Cancel
                        </Button>
                        <Button size="sm" disabled={pending} onClick={() => review(submission.id, "needs_correction", feedback)}>
                          {pending ? <LoaderCircle className="animate-spin" /> : null}
                          Send
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
