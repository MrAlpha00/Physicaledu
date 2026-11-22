"use client";

import { useState, useTransition } from "react";
import { Paperclip } from "lucide-react";
import { createPhase3DownloadUrl } from "@/lib/actions/phase3-files";
import { Button } from "@/components/ui/button";

export function AttachmentLink({ fileId, filename }: { fileId: string; filename: string }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");

  function open() {
    setMessage("");
    startTransition(async () => {
      const result = await createPhase3DownloadUrl(fileId);
      if (result.status !== "success" || !result.url) {
        setMessage(result.message);
        return;
      }
      window.open(result.url, "_blank", "noopener,noreferrer");
    });
  }

  return (
    <div>
      <Button type="button" size="sm" variant="outline" onClick={open} disabled={pending}>
        <Paperclip /> {pending ? "Opening…" : filename}
      </Button>
      {message ? <p className="mt-1 text-[11px] text-coral-dark">{message}</p> : null}
    </div>
  );
}
