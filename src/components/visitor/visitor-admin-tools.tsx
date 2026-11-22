"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Plus } from "lucide-react";
import { addVisitorPurpose, setVisitorPurposeActive } from "@/app/(admin)/admin/visitors/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { VisitorPurpose } from "@/types/domain";

export function VisitorAdminTools({ purposes }: { purposes: VisitorPurpose[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [label, setLabel] = useState("");
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  function run(action: () => Promise<{ status: string; message: string }>) {
    setNotice(null);
    startTransition(async () => {
      const result = await action();
      setNotice({ tone: result.status === "success" ? "ok" : "error", text: result.message });
      if (result.status === "success") {
        setLabel("");
        router.refresh();
      }
    });
  }

  return (
    <section className="border border-border bg-card/60 p-5">
      <h2 className="mb-1 border-b-2 border-navy pb-2 text-2xl font-bold">Purpose options</h2>
      <p className="mb-4 text-xs text-ink-muted">
        Purposes shown on the public register form. Disabling one keeps historic records intact.
      </p>
      <div className="flex flex-wrap gap-2">
        {purposes.map((purpose) => (
          <Button
            key={purpose.id}
            size="sm"
            variant={purpose.isActive ? "lime" : "outline"}
            disabled={pending}
            onClick={() => run(() => setVisitorPurposeActive(purpose.id, !purpose.isActive))}
          >
            {purpose.label}
            <span className="ml-1 text-[9px] uppercase">
              {purpose.isActive ? "· on" : "· off"}
            </span>
          </Button>
        ))}
      </div>
      <div className="mt-5 flex flex-wrap items-end gap-3">
        <div className="min-w-56 flex-1">
          <label htmlFor="new-purpose" className="eyebrow text-ink-muted">Add a purpose</label>
          <Input
            id="new-purpose"
            className="mt-2"
            maxLength={60}
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="e.g. Fitness assessment"
          />
        </div>
        <Button
          size="sm"
          disabled={pending || label.trim().length < 2}
          onClick={() => run(() => addVisitorPurpose(label))}
        >
          {pending ? <LoaderCircle className="animate-spin" /> : <Plus />}
          Add
        </Button>
      </div>
      {notice ? (
        <p role="status" className={`mt-4 text-xs ${notice.tone === "ok" ? "text-[#4b711d]" : "text-coral-dark"}`}>
          {notice.text}
        </p>
      ) : null}
    </section>
  );
}
