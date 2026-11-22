"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { CheckCircle2, Clock3, LoaderCircle } from "lucide-react";
import { submitMyAttendance } from "@/app/(student)/classroom/actions";
import { AttendanceBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { formatIstDate, formatIstTime } from "@/lib/time/india";
import type { AttendanceSubmissionType } from "@/types/database";
import type { MyAttendanceSummary } from "@/types/domain";

export function StudentAttendancePanel({
  attendance,
}: {
  attendance: MyAttendanceSummary;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const session = attendance.session;
  const canSubmit = Boolean(
    session && ["not_submitted", "pending"].includes(attendance.status ?? "not_submitted"),
  );

  function submit(type: AttendanceSubmissionType) {
    if (!session) return;
    setMessage(null);
    startTransition(async () => {
      const result = await submitMyAttendance(session.id, type);
      setMessage({ tone: result.status === "success" ? "ok" : "error", text: result.message });
    });
  }

  return (
    <div className="space-y-6">
      {message ? (
        <p
          role="status"
          className={`border-l-4 p-4 text-sm ${
            message.tone === "ok"
              ? "border-l-[#8fb63c] bg-lime/40 text-[#33521b]"
              : "border-l-coral bg-coral/10 text-[#8b3725]"
          }`}
        >
          {message.text}
        </p>
      ) : null}

      {!session ? (
        <div className="border border-dashed border-border bg-card/60 p-10 text-center">
          <Clock3 className="mx-auto size-9 text-ink-muted" />
          <h2 className="mt-4 text-3xl font-bold">No open session</h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-ink-muted">
            When the PE department opens an attendance session, it will appear here with the
            class date, time and instructions.
          </p>
          <Link href="/classroom/attendance" className="mt-5 inline-block text-sm font-bold text-cobalt underline">
            View attendance history
          </Link>
        </div>
      ) : (
        <section className="border border-navy/15 bg-card">
          <div className="border-b border-border bg-navy px-6 py-6 text-chalk sm:px-8">
            <p className="eyebrow text-lime">Session open</p>
            <h2 className="mt-3 text-4xl font-bold">{session.title}</h2>
            <div className="mt-4 flex flex-wrap gap-x-8 gap-y-2 text-xs font-bold uppercase tracking-[0.1em] text-chalk/75">
              <span>{formatIstDate(session.classDate)}</span>
              <span>
                {formatIstTime(session.startsAt)} – {formatIstTime(session.expectedEndsAt)} IST
              </span>
            </div>
          </div>
          <div className="space-y-6 p-6 sm:p-8">
            {session.instructions ? (
              <div className="border-l-4 border-l-cobalt bg-cobalt/5 p-4 text-sm text-navy/80">
                <p className="eyebrow text-cobalt">Instructions</p>
                <p className="mt-2">{session.instructions}</p>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-4">
              <span className="eyebrow text-ink-muted">Your status</span>
              {attendance.status ? <AttendanceBadge status={attendance.status} /> : <AttendanceBadge status="not_submitted" />}
              {attendance.submittedAt ? (
                <span className="text-xs text-ink-muted">Submitted {formatIstTime(attendance.submittedAt)} IST</span>
              ) : null}
            </div>

            {canSubmit ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <Button variant="lime" size="lg" disabled={pending} onClick={() => submit("attended")}>
                  {pending ? <LoaderCircle className="animate-spin" /> : <CheckCircle2 />}
                  Attended PE class
                </Button>
                <Button variant="cobalt" size="lg" disabled={pending} onClick={() => submit("represented")}>
                  {pending ? <LoaderCircle className="animate-spin" /> : null}
                  Represented college / department
                </Button>
              </div>
            ) : (
              <p className="border border-border bg-muted/40 p-4 text-sm text-ink-muted">
                {attendance.status === "pending"
                  ? "Your submission is awaiting PE admin review."
                  : "This attendance record has been reviewed and is locked."}
              </p>
            )}
            <p className="text-xs leading-relaxed text-ink-muted">
              Choosing the wrong option? You may correct a pending submission while this
              session remains open. Reviewed records cannot be edited by students.
            </p>
          </div>
        </section>
      )}
    </div>
  );
}
