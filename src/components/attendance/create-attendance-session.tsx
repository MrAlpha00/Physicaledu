"use client";

import { useState, useTransition } from "react";
import { Plus, LoaderCircle } from "lucide-react";
import { createAttendanceSession } from "@/app/(admin)/admin/classroom/attendance/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { istDateString } from "@/lib/time/india";
import type { AttendanceSessionInput } from "@/lib/validations/phase2";

export function CreateAttendanceSession() {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [form, setForm] = useState<AttendanceSessionInput>({
    title: "",
    classDate: istDateString(),
    startsAt: `${istDateString()}T10:00`,
    expectedEndsAt: `${istDateString()}T12:00`,
    instructions: "",
    allowConcurrent: false,
    concurrentReason: "",
  });

  function update<K extends keyof AttendanceSessionInput>(key: K, value: AttendanceSessionInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function submit() {
    setMessage(null);
    startTransition(async () => {
      const result = await createAttendanceSession(form);
      setMessage({ tone: result.status === "success" ? "ok" : "error", text: result.message });
      if (result.status === "success") {
        setOpen(false);
        setForm((current) => ({ ...current, title: "", instructions: "" }));
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="lime">
          <Plus /> New session
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create attendance session</DialogTitle>
          <DialogDescription>
            The active PE roster is captured as eligible participants when the session is
            created. Any weekday or Saturday class can be scheduled.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="session-title">Session title</Label>
            <Input
              id="session-title"
              className="mt-2"
              value={form.title}
              onChange={(event) => update("title", event.target.value)}
              placeholder="e.g. Saturday PE class"
            />
          </div>
          <div>
            <Label htmlFor="session-date">Class date (IST)</Label>
            <Input
              id="session-date"
              type="date"
              className="mt-2"
              value={form.classDate}
              onChange={(event) => {
                const date = event.target.value;
                setForm((current) => ({
                  ...current,
                  classDate: date,
                  startsAt: `${date}T${current.startsAt.slice(11, 16)}`,
                  expectedEndsAt: `${date}T${current.expectedEndsAt.slice(11, 16)}`,
                }));
              }}
            />
          </div>
          <div>
            <Label htmlFor="session-priority">Start time (IST)</Label>
            <Input
              id="session-priority"
              type="time"
              className="mt-2"
              value={form.startsAt.slice(11, 16)}
              onChange={(event) => update("startsAt", `${form.classDate}T${event.target.value}`)}
            />
          </div>
          <div>
            <Label htmlFor="session-end">Expected end (IST)</Label>
            <Input
              id="session-end"
              type="time"
              className="mt-2"
              value={form.expectedEndsAt.slice(11, 16)}
              onChange={(event) => update("expectedEndsAt", `${form.classDate}T${event.target.value}`)}
            />
          </div>
          <div className="flex items-end gap-3 sm:col-span-2">
            <input
              id="session-concurrent"
              type="checkbox"
              className="size-4"
              checked={form.allowConcurrent}
              onChange={(event) => update("allowConcurrent", event.target.checked)}
            />
            <Label htmlFor="session-concurrent" className="cursor-pointer">
              Allow an explicitly justified overlapping session
            </Label>
          </div>
          {form.allowConcurrent ? (
            <div className="sm:col-span-2">
              <Label htmlFor="session-reason">Reason for overlap</Label>
              <Input
                id="session-reason"
                className="mt-2"
                value={form.concurrentReason ?? ""}
                onChange={(event) => update("concurrentReason", event.target.value)}
              />
            </div>
          ) : null}
          <div className="sm:col-span-2">
            <Label htmlFor="session-instructions">Instructions (optional)</Label>
            <Textarea
              id="session-instructions"
              className="mt-2"
              rows={3}
              value={form.instructions ?? ""}
              onChange={(event) => update("instructions", event.target.value)}
            />
          </div>
        </div>
        {message ? (
          <p role="status" className={`text-sm ${message.tone === "ok" ? "text-[#4b711d]" : "text-coral-dark"}`}>
            {message.text}
          </p>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending ? <LoaderCircle className="animate-spin" /> : null}
            Create session
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
