"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, LoaderCircle, Paperclip } from "lucide-react";
import {
  confirmFileUpload,
  requestFileUpload,
} from "@/lib/actions/files";
import { humanFileSize } from "@/lib/storage/file-validation";
import type { StoredFileView } from "@/types/domain";

export function FileUpload({
  parentType,
  parentId,
  allowedTypes,
  maxFileSizeBytes,
  maxFiles,
  files,
}: {
  parentType: "task_reference" | "task_submission";
  parentId: string;
  allowedTypes: string[];
  maxFileSizeBytes: number;
  maxFiles: number;
  files: StoredFileView[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  function upload(file: File) {
    setMessage(null);
    startTransition(async () => {
      try {
        const auth = await requestFileUpload({
          parentType,
          parentId,
          filename: file.name,
          contentType: file.type || "application/octet-stream",
          byteSize: file.size,
        });
        if (auth.status !== "success" || !auth.url || !auth.fileId) {
          setMessage({ tone: "error", text: auth.message });
          return;
        }

        const put = await fetch(auth.url, {
          method: "PUT",
          headers: auth.headers,
          body: file,
        });
        if (!put.ok) {
          setMessage({
            tone: "error",
            text: `Upload failed (HTTP ${put.status}). Check the R2 CORS configuration.`,
          });
          return;
        }

        const confirmed = await confirmFileUpload(auth.fileId);
        setMessage({
          tone: confirmed.status === "success" ? "ok" : "error",
          text: confirmed.message,
        });
        if (confirmed.status === "success") router.refresh();
      } catch {
        setMessage({ tone: "error", text: "The upload could not be completed." });
      }
    });
  }

  return (
    <div className="space-y-3">
      {files.length ? (
        <ul className="divide-y divide-border border border-border">
          {files.map((file) => (
            <li key={file.id} className="flex items-center justify-between gap-3 p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold">{file.originalFilename}</p>
                <p className="text-xs text-ink-muted">{humanFileSize(file.byteSize)}</p>
              </div>
              <a
                href={`/api/files/${file.id}/download`}
                className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-cobalt hover:underline"
              >
                <Download className="size-3" /> Download
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="border border-dashed border-border p-4 text-sm text-ink-muted">
          No files attached yet.
        </p>
      )}

      {files.length < maxFiles ? (
        <label className="inline-flex cursor-pointer items-center gap-2 border border-navy/25 px-4 py-2 text-xs font-bold uppercase tracking-[0.08em] text-navy hover:border-navy hover:bg-navy/5">
          {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Paperclip className="size-4" />}
          {pending ? "Uploading…" : "Add file"}
          <input
            type="file"
            className="hidden"
            disabled={pending}
            accept={allowedTypes.map((type) => `.${type}`).join(",")}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) upload(file);
              event.target.value = "";
            }}
          />
        </label>
      ) : (
        <p className="text-xs text-ink-muted">Attachment limit reached.</p>
      )}
      <p className="text-xs text-ink-muted">
        Allowed: {allowedTypes.join(", ")} · Max {Math.round(maxFileSizeBytes / (1024 * 1024))} MB
        per file · {maxFiles} files
      </p>
      {message ? (
        <p role="status" className={`text-xs ${message.tone === "ok" ? "text-[#4b711d]" : "text-coral-dark"}`}>
          {message.text}
        </p>
      ) : null}
    </div>
  );
}
