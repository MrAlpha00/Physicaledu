"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { authorizePhase3Upload, confirmPhase3Upload } from "@/lib/actions/phase3-files";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { FeedbackCategory } from "@/types/database";
import { attachFeedbackAttachment, submitFeedback } from "@/app/(student)/feedback/actions";
import { FeedbackActionNotice } from "./action-notice";

const CATEGORIES: FeedbackCategory[] = [
  "suggestion", "complaint", "equipment_request", "equipment_damage",
  "facility_issue", "sports_activity_request", "attendance_correction", "other",
];

async function uploadAttachment(
  requestId: string,
  file: File,
): Promise<{ fileId: string | null; error: string | null }> {
  const auth = await authorizePhase3Upload({
    parentType: "feedback_attachment",
    parentId: requestId,
    filename: file.name,
    contentType: file.type,
    byteSize: file.size,
    visibility: "private",
  });
  if (auth.status !== "success" || !auth.url || !auth.headers || !auth.fileId) {
    return { fileId: null, error: auth.message || "The attachment could not be authorised." };
  }
  try {
    const response = await fetch(auth.url, { method: "PUT", headers: auth.headers, body: file });
    if (!response.ok) return { fileId: null, error: "Storage rejected the attachment. Please try again." };
    const confirmed = await confirmPhase3Upload(auth.fileId);
    if (confirmed.status !== "success") return { fileId: null, error: confirmed.message };
    return { fileId: auth.fileId, error: null };
  } catch {
    return { fileId: null, error: "The attachment upload failed. Add it from your request page." };
  }
}

export function FeedbackSubmitForm() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState<FeedbackCategory>("suggestion");
  const [description, setDescription] = useState("");
  const [preferredResponse, setPreferredResponse] = useState<"in_app" | "email" | "either">("in_app");
  const [notice, setNotice] = useState<{ message: string; error: boolean } | null>(null);
  const [createdId, setCreatedId] = useState("");

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    setCreatedId("");
    const file = fileRef.current?.files?.[0];
    startTransition(async () => {
      const result = await submitFeedback({ subject, category, description, preferredResponse });
      if (result.status === "error" || !result.requestId) {
        setNotice({ message: result.message, error: true });
        return;
      }
      setCreatedId(result.requestId);
      if (file) {
        const upload = await uploadAttachment(result.requestId, file);
        if (upload.error || !upload.fileId) {
          setNotice({
            message: `${result.message} The request was saved, but the attachment failed: ${upload.error ?? "Unknown error"} Add it from the request page.`,
            error: true,
          });
        } else {
          const linked = await attachFeedbackAttachment(result.requestId, upload.fileId);
          setNotice({
            message: linked.status === "success"
              ? `${result.message} Attachment uploaded.`
              : `${result.message} The attachment was uploaded but could not be linked: ${linked.message}`,
            error: linked.status !== "success",
          });
        }
      } else {
        setNotice({ message: result.message, error: false });
      }
      setSubject("");
      setDescription("");
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-5 border-t-4 border-t-coral bg-white p-6 shadow-sm">
      <div>
        <p className="eyebrow text-coral-dark">New request</p>
        <h2 className="mt-1 text-2xl font-bold">Tell the PE department</h2>
        <p className="mt-1 text-xs text-ink-muted">
          Requests are tied to your student directory record and appear only in your own thread.
        </p>
      </div>

      <label className="block text-[10px] font-bold uppercase tracking-[0.14em] text-ink-muted">
        Subject
        <Input
          className="mt-2"
          required
          minLength={5}
          maxLength={120}
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
          placeholder="Short, specific summary"
        />
      </label>

      <label className="block text-[10px] font-bold uppercase tracking-[0.14em] text-ink-muted">
        Category
        <select
          className="mt-2 h-11 w-full rounded-md border border-input bg-white px-3 text-sm"
          value={category}
          onChange={(event) => setCategory(event.target.value as FeedbackCategory)}
        >
          {CATEGORIES.map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}
        </select>
      </label>

      <label className="block text-[10px] font-bold uppercase tracking-[0.14em] text-ink-muted">
        Description
        <Textarea
          className="mt-2"
          required
          minLength={15}
          maxLength={4000}
          rows={6}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="What happened, where and when? Include enough detail for the department to act."
        />
      </label>

      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink-muted">Preferred response</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {(["in_app", "email", "either"] as const).map((value) => (
            <label key={value} className="cursor-pointer border border-navy/15 px-3 py-2 text-xs font-bold">
              <input
                type="radio"
                name="preferredResponse"
                className="mr-2 accent-[#3564e9]"
                value={value}
                checked={preferredResponse === value}
                onChange={() => setPreferredResponse(value)}
              />
              {value === "in_app" ? "In app" : value === "email" ? "Email" : "Either"}
            </label>
          ))}
        </div>
      </div>

      <label className="block text-[10px] font-bold uppercase tracking-[0.14em] text-ink-muted">
        Supporting attachment (optional)
        <Input
          ref={fileRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp,.docx,.xlsx,.txt"
          className="mt-2 h-auto py-2 text-xs"
        />
        <span className="mt-1 block text-[11px] font-normal normal-case tracking-normal text-ink-muted">
          Uploaded only after the request is created, then linked to that request. Add more files from the request page.
        </span>
      </label>

      <FeedbackActionNotice state={notice ? { status: notice.error ? "error" : "success", message: notice.message } : null} />
      {createdId ? (
        <Link href={`/my-feedback/${createdId}`} className="block text-xs font-bold text-cobalt underline underline-offset-2">
          Open request #{createdId.slice(0, 8)}
        </Link>
      ) : null}
      <Button type="submit" variant="cobalt" disabled={pending} className="w-full">
        {pending ? "Submitting…" : "Submit feedback"}
      </Button>
    </form>
  );
}
