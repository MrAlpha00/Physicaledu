"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { adminRecordAchievement } from "@/app/(admin)/admin/sports-profiles/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FileUploadControl } from "@/components/phase3/file-upload-control";
import { SportsActionNotice } from "./action-notice";
import type { ActionState } from "@/types/domain";
import type { AchievementVerificationStatus } from "@/types/database";

export interface StudentOption {
  id: string;
  label: string;
}

export function AdminAchievementForm({ students }: { students: StudentOption[] }) {
  const router = useRouter();
  const [studentDirectoryId, setStudentDirectoryId] = useState("");
  const [title, setTitle] = useState("");
  const [sport, setSport] = useState("");
  const [eventName, setEventName] = useState("");
  const [academicYear, setAcademicYear] = useState("");
  const [achievementDate, setAchievementDate] = useState("");
  const [positionResult, setPositionResult] = useState("");
  const [awardDescription, setAwardDescription] = useState("");
  const [verificationStatus, setVerificationStatus] = useState<AchievementVerificationStatus>("pending");
  const [createdId, setCreatedId] = useState("");
  const [evidenceFileId, setEvidenceFileId] = useState("");
  const [notice, setNotice] = useState<ActionState | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    const form = new FormData(event.currentTarget);
    const attachedFile = String(form.get("evidenceFileId") ?? "");

    startTransition(async () => {
      const result = await adminRecordAchievement({
        id: createdId || undefined,
        studentDirectoryId,
        title,
        sport,
        eventName,
        academicYear,
        achievementDate,
        positionResult,
        awardDescription,
        evidenceFileId: attachedFile || evidenceFileId || undefined,
        verificationStatus,
      });
      setNotice(result);
      if (result.status === "success") {
        if (!createdId && result.achievementId) setCreatedId(result.achievementId);
        if (attachedFile) setEvidenceFileId(attachedFile);
        router.refresh();
      }
    });
  }

  function reset() {
    setCreatedId("");
    setEvidenceFileId("");
    setStudentDirectoryId("");
    setTitle("");
    setSport("");
    setEventName("");
    setAcademicYear("");
    setAchievementDate("");
    setPositionResult("");
    setAwardDescription("");
    setVerificationStatus("pending");
    setNotice(null);
  }

  return (
    <form onSubmit={submit} className="space-y-5 border-t-4 border-t-cobalt bg-white p-6 shadow-sm">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cobalt">Admin recorded</p>
        <h2 className="mt-1 font-barlow text-3xl leading-none text-navy">Add an achievement</h2>
        <p className="mt-2 text-xs text-ink-muted">
          Recorded achievements are attributed to the PE Admin account. Verification can be applied now or completed from the review queue.
        </p>
      </div>

      <label className="block text-[10px] font-bold uppercase tracking-[0.14em] text-ink-muted">
        Student
        <select
          name="studentDirectoryId"
          required
          value={studentDirectoryId}
          onChange={(event) => setStudentDirectoryId(event.target.value)}
          className="mt-2 h-11 w-full rounded-md border border-input bg-white px-3 text-sm"
        >
          <option value="">Choose a student</option>
          {students.map((student) => (
            <option key={student.id} value={student.id}>{student.label}</option>
          ))}
        </select>
      </label>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block text-[10px] font-bold uppercase tracking-[0.14em] text-ink-muted">
          Achievement title
          <Input className="mt-2" required minLength={3} maxLength={140} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Inter-college 400m finalist" />
        </label>
        <label className="block text-[10px] font-bold uppercase tracking-[0.14em] text-ink-muted">
          Sport
          <Input className="mt-2" required minLength={2} maxLength={80} value={sport} onChange={(event) => setSport(event.target.value)} placeholder="e.g. Athletics" />
        </label>
        <label className="block text-[10px] font-bold uppercase tracking-[0.14em] text-ink-muted">
          Event (optional)
          <Input className="mt-2" maxLength={140} value={eventName} onChange={(event) => setEventName(event.target.value)} />
        </label>
        <label className="block text-[10px] font-bold uppercase tracking-[0.14em] text-ink-muted">
          Academic year (optional)
          <Input className="mt-2" maxLength={30} value={academicYear} onChange={(event) => setAcademicYear(event.target.value)} placeholder="2025-26" />
        </label>
        <label className="block text-[10px] font-bold uppercase tracking-[0.14em] text-ink-muted">
          Achievement date (optional)
          <Input className="mt-2" type="date" value={achievementDate} onChange={(event) => setAchievementDate(event.target.value)} />
        </label>
        <label className="block text-[10px] font-bold uppercase tracking-[0.14em] text-ink-muted">
          Position / result (optional)
          <Input className="mt-2" maxLength={120} value={positionResult} onChange={(event) => setPositionResult(event.target.value)} placeholder="Gold medal" />
        </label>
      </div>

      <label className="block text-[10px] font-bold uppercase tracking-[0.14em] text-ink-muted">
        Award description (optional)
        <Textarea className="mt-2" rows={3} maxLength={2000} value={awardDescription} onChange={(event) => setAwardDescription(event.target.value)} />
      </label>

      <label className="block text-[10px] font-bold uppercase tracking-[0.14em] text-ink-muted">
        Initial status
        <select
          value={verificationStatus}
          onChange={(event) => setVerificationStatus(event.target.value as AchievementVerificationStatus)}
          className="mt-2 h-11 w-full rounded-md border border-input bg-white px-3 text-sm"
        >
          <option value="pending">Pending review</option>
          <option value="verified">Verified now</option>
        </select>
      </label>

      {createdId ? (
        <div className="border-l-4 border-l-lime bg-lime/10 p-4">
          <p className="text-xs font-bold text-navy">Achievement recorded. Evidence can now be attached to record {createdId.slice(0, 8)}.</p>
          <div className="mt-3">
            <FileUploadControl
              name="evidenceFileId"
              parentType="achievement_evidence"
              parentId={createdId}
              visibility="private"
              label="Evidence (optional)"
              accept=".pdf,.jpg,.jpeg,.png,.webp"
            />
          </div>
        </div>
      ) : null}

      <SportsActionNotice state={notice} />

      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="default" disabled={pending || students.length === 0}>
          {pending ? "Saving…" : createdId ? "Attach evidence / update" : "Record achievement"}
        </Button>
        <Button type="button" variant="outline" disabled={pending} onClick={reset}>
          {createdId ? "Add another" : "Clear form"}
        </Button>
      </div>
    </form>
  );
}
