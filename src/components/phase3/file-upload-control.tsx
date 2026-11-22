"use client";

import { useRef, useState, useTransition } from "react";
import { UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { authorizePhase3Upload, confirmPhase3Upload } from "@/lib/actions/phase3-files";
import type { Phase3ParentType } from "@/types/database";

export function FileUploadControl({
  name,
  parentType,
  parentId,
  visibility = "private",
  label = "Attachment",
  accept = ".pdf,.jpg,.jpeg,.png,.webp,.docx,.xlsx,.txt",
  required = false,
}: {
  name: string;
  parentType: Phase3ParentType;
  parentId: string;
  visibility?: "private" | "public";
  label?: string;
  accept?: string;
  required?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileId, setFileId] = useState("");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  function upload(file: File | undefined) {
    if (!file) return;
    setMessage("");
    startTransition(async () => {
      const auth = await authorizePhase3Upload({
        parentType,
        parentId,
        filename: file.name,
        contentType: file.type,
        byteSize: file.size,
        visibility,
      });
      if (auth.status !== "success" || !auth.url || !auth.fileId || !auth.headers) {
        setMessage(auth.message);
        return;
      }

      try {
        const response = await fetch(auth.url, {
          method: "PUT",
          headers: auth.headers,
          body: file,
        });
        if (!response.ok) {
          setMessage("R2 rejected the upload. Check the bucket CORS rules and try again.");
          return;
        }
        const confirmed = await confirmPhase3Upload(auth.fileId);
        setMessage(confirmed.message);
        if (confirmed.status === "success") setFileId(auth.fileId);
      } catch {
        setMessage("Upload failed. Please try again.");
      }
    });
  }

  return (
    <div className="border border-dashed border-navy/25 bg-navy/[0.02] p-4">
      <label className="text-xs font-bold uppercase tracking-[0.14em] text-navy">{label}</label>
      <input type="hidden" name={name} value={fileId} />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(event) => upload(event.target.files?.[0])}
        />
        <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => inputRef.current?.click()}>
          <UploadCloud /> {pending ? "Uploading…" : "Choose file"}
        </Button>
        {fileId ? <span className="text-xs font-semibold text-cobalt">Attached</span> : null}
        {required && !fileId ? <span className="text-xs text-ink-muted">Required</span> : null}
      </div>
      {message ? <p className="mt-2 text-xs text-ink-muted">{message}</p> : null}
    </div>
  );
}
