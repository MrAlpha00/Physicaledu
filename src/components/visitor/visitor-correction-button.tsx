"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Pencil } from "lucide-react";
import { correctVisitorRecord } from "@/app/(admin)/admin/visitors/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function VisitorCorrectionButton({
  visitorId,
  name,
}: {
  visitorId: string;
  name: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  function save() {
    setNotice(null);
    startTransition(async () => {
      const result = await correctVisitorRecord(visitorId, reason);
      setNotice({ tone: result.status === "success" ? "ok" : "error", text: result.message });
      if (result.status === "success") {
        setOpen(false);
        setReason("");
        router.refresh();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" aria-label={`Correct ${name}'s record`}>
          <Pencil />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Correct visitor record</DialogTitle>
          <DialogDescription>
            The original entry stays unchanged. Your reason is written to the audit trail.
          </DialogDescription>
        </DialogHeader>
        <div>
          <Label htmlFor={`correction-${visitorId}`}>Reason for correction</Label>
          <Input
            id={`correction-${visitorId}`}
            className="mt-2"
            maxLength={500}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </div>
        {notice ? (
          <p role="status" className={`text-xs ${notice.tone === "ok" ? "text-[#4b711d]" : "text-coral-dark"}`}>
            {notice.text}
          </p>
        ) : null}
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button disabled={pending || reason.trim().length < 4} onClick={save}>
            {pending ? <LoaderCircle className="animate-spin" /> : null}
            Record correction
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
