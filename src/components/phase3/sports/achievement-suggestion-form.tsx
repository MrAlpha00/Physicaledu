"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { attachStudentEvidence, suggestAchievement } from "@/app/(student)/my-sports-profile/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FileUploadControl } from "@/components/phase3/file-upload-control";
import { SportsActionNotice } from "./action-notice";
import type { ActionState } from "@/types/domain";

export function AchievementSuggestionForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [sport, setSport] = useState("");
  const [eventName, setEventName] = useState("");
  const [academicYear, setAcademicYear] = useState("");
  const [achievementDate, setAchievementDate] = useState("");
  const [positionResult, setPositionResult] = useState("");
  const [awardDescription, setAwardDescription] = useState("");
  const [createdId, setCreatedId] = useState("");
  const [notice, setNotice] = useState<ActionState | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    const form = new FormData(event.currentTarget);
    const evidenceFileId = String(form.get("evidenceFileId") ?? "");

    startTransition(async () => {
      const result = createdId
        ? await attachStudentEvidence(createdId, evidenceFileId)
        : await suggestAchievement({
            title,
            sport,
            eventName,
            academicYear,
            achievementDate,
            positionResult,
            awardDescription,
            // Forced pending here and in the action; students cannot self-verify.
            verificationStatus: "pending",
          });
      setNotice(result);
      if (result.status === "success") {
        if (!createdId) {
          const newId = (result as ActionState & { achievementId?: string }).achievementId;
          if (newId) setCreatedId(newId);
        }
        router.refresh();
      }
    });
  }

  function reset() {
    setCreatedId("");
    setTitle("");
    setSport("");
    setEventName("");
    setAcademicYear("");
    setAchievementDate("");
    setPositionResult("");
    setAwardDescription("");
    setNotice(null);
  }

  return (
    <form onSubmit={submit} className="space-y-5 border-t-4 border-t-coral bg-white p-6 shadow-sm">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-coral-dark">Student suggestion</p>
        <h2 className="mt-1 font-barlow text-3xl leading-none text-navy">Suggest an achievement</h2>
        <p className="mt-2 text-xs text-ink-muted">
          Suggestions are saved as pending. You cannot verify your own achievement; PE Admin reviews every claim.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block text-[10px] font-bold uppercase tracking-[0.14em] text-ink-muted">
          Achievement title
          <Input className="mt-2" required minLength={3} maxLength={140} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. District-level badminton semifinalist" />
        </label>
        <label className="block text-[10px] font-bold uppercase tracking-[0.14em] text-ink-muted">
          Sport
          <Input className="mt-2" required minLength={2} maxLength={80} value={sport} onChange={(event) => setSport(event.target.value)} placeholder="e.g. Badminton" />
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
          <Input className="mt-2" maxLength={120} value={positionResult} onChange={(event) => setPositionResult(event.target.value)} placeholder="Second place" />
        </label>
      </div>

      <label className="block text-[10px] font-bold uppercase tracking-[0.14em] text-ink-muted">
        Award description (optional)
        <Textarea className="mt-2" rows={3} maxLength={2000} value={awardDescription} onChange={(event) => setAwardDescription(event.target.value)} />
      </label>

      {createdId ? (
        <div className="border-l-4 border-l-lime bg-lime/10 p-4">
          <p className="text-xs font-bold text-navy">
            Suggestion {createdId.slice(0, 8)} is pending. Upload supporting evidence, then attach it here.
          </p>
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
        <Button type="submit" variant="default" disabled={pending}>
          {pending ? "Saving…" : createdId ? "Attach evidence" : "Submit suggestion"}
        </Button>
        <Button type="button" variant="outline" disabled={pending} onClick={reset}>
          {createdId ? "Suggest another" : "Clear form"}
        </Button>
      </div>
    </form>
  );
}
