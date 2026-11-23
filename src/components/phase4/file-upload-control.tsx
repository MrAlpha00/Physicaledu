"use client";

import { useRef, useState, useTransition } from "react";
import { UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  authorizePhase4Upload,
  confirmPhase4Upload,
} from "@/lib/actions/phase4-files";

const ALLOWED = ["image/png", "image/jpeg", "image/webp", "application/pdf"];
const MAX_BYTES = 10 * 1024 * 1024;

export function Phase4FileUploadControl({
  name,
  parentType,
  parentId,
  label = "File",
  visibility,
  initialFileId = "",
  required = false,
}: {
  name: string;
  parentType: string;
  parentId: string;
  label?: string;
  visibility?: "private" | "public";
  initialFileId?: string;
  required?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileId, setFileId] = useState(initialFileId);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  function upload(file: File | undefined) {
    if (!file) return;
    setMessage("");
    if (!ALLOWED.includes(file.type)) {
      setMessage("Only PNG, JPEG, WebP and PDF files are accepted.");
      return;
    }
    if (file.size <= 0 || file.size > MAX_BYTES) {
      setMessage("Files must be between 1 byte and 10 MB.");
      return;
    }
    startTransition(async () => {
      const auth = await authorizePhase4Upload({
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
          setMessage("R2 rejected the upload. Check the bucket CORS configuration.");
          return;
        }
        const confirmed = await confirmPhase4Upload(auth.fileId);
        if (confirmed.status !== "success") {
          setMessage(confirmed.message);
          return;
        }
        setFileId(auth.fileId);
        setMessage("File attached.");
      } catch {
        setMessage("Upload failed. Please try again.");
      }
    });
  }

  return (
    <div className="border border-dashed border-navy/25 bg-navy/[0.02] p-4">
      <div className="flex items-center justify-between gap-3">
        <label className="text-xs font-bold uppercase tracking-[0.14em] text-navy">{label}</label>
        {required && !fileId ? <span className="text-xs text-coral-dark">Required</span> : null}
      </div>
      <input type="hidden" name={name} value={fileId} />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <input
          ref={inputRef}
          type="file"
          accept=".png,.jpg,.jpeg,.webp,.pdf"
          className="hidden"
          onChange={(event) => upload(event.target.files?.[0])}
        />
        <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => inputRef.current?.click()}>
          <UploadCloud /> {pending ? "Uploading…" : fileId ? "Replace file" : "Choose file"}
        </Button>
        {fileId ? <span className="text-xs font-semibold text-cobalt">Attached</span> : null}
      </div>
      {message ? <p className="mt-2 text-xs text-ink-muted">{message}</p> : null}
    </div>
  );
}
