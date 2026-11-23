"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitRegistrationAction } from "@/app/(public)/events/actions";
import { Phase4ActionNotice } from "@/components/phase4/action-notice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ActionState } from "@/types/domain";
import type { Json, Phase4RulesRow } from "@/types/database";

type Member = { usn: string; weightKg: string; isCaptain: boolean; isSubstitute: boolean };
type CustomQuestion = {
  key: string;
  label: string;
  type: "text" | "number" | "select";
  options?: string[];
  required?: boolean;
};

function readQuestions(value: Json | null): CustomQuestion[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const question = item as Record<string, unknown>;
    if (typeof question.key !== "string" || typeof question.label !== "string") return [];
    return [{
      key: question.key,
      label: question.label,
      type: question.type === "number" || question.type === "select" ? question.type : "text",
      options: Array.isArray(question.options) ? question.options.filter((option): option is string => typeof option === "string") : [],
      required: question.required === true,
    }];
  });
}

export function RegistrationForm({
  competitionId,
  mode,
  rules,
  defaultUsn = "",
  defaultEmail = "",
}: {
  competitionId: string;
  mode: "team" | "individual";
  rules: Phase4RulesRow | null;
  defaultUsn?: string;
  defaultEmail?: string;
}) {
  const router = useRouter();
  const [notice, setNotice] = useState<ActionState | null>(null);
  const [pending, startTransition] = useTransition();
  const [teamName, setTeamName] = useState("");
  const [contactEmail, setContactEmail] = useState(defaultEmail);
  const [contactPhone, setContactPhone] = useState("");
  const [members, setMembers] = useState<Member[]>([
    { usn: defaultUsn, weightKg: "", isCaptain: true, isSubstitute: false },
  ]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const questions = readQuestions(rules?.custom_questions ?? null);

  function updateMember(index: number, patch: Partial<Member>) {
    setMembers((current) => current.map((member, position) =>
      position === index ? { ...member, ...patch } : member));
  }

  function setCaptain(index: number) {
    setMembers((current) => current.map((member, position) => ({
      ...member,
      isCaptain: position === index,
    })));
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const captain = members.find((member) => member.isCaptain) ?? members[0];
    startTransition(async () => {
      const result = await submitRegistrationAction(competitionId, {
        kind: mode,
        teamName,
        captainUsn: captain?.usn ?? "",
        contactEmail,
        contactPhone,
        answers,
        members: members.map((member) => ({
          usn: member.usn,
          weightKg: member.weightKg ? Number(member.weightKg) : null,
          isCaptain: member.isCaptain,
          isSubstitute: member.isSubstitute,
          metadata: {},
        })),
      });
      setNotice(result);
      if (result.status === "success") {
        router.refresh();
        router.push("/my-events");
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <Phase4ActionNotice state={notice} />
      {mode === "team" ? (
        <div className="space-y-2">
          <Label htmlFor="teamName">Team name</Label>
          <Input id="teamName" required value={teamName} onChange={(event) => setTeamName(event.target.value)} className="w-full border border-navy/20 bg-white px-3 py-2 text-sm" />
        </div>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="contactEmail">Contact email</Label>
          <Input id="contactEmail" type="email" value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} className="w-full border border-navy/20 bg-white px-3 py-2 text-sm" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contactPhone">Contact phone</Label>
          <Input id="contactPhone" value={contactPhone} onChange={(event) => setContactPhone(event.target.value)} className="w-full border border-navy/20 bg-white px-3 py-2 text-sm" />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-barlow text-xl uppercase text-navy">Participants</h3>
          {mode === "team" ? (
            <Button type="button" variant="outline" size="sm" onClick={() => setMembers((current) => [
              ...current,
              { usn: "", weightKg: "", isCaptain: false, isSubstitute: false },
            ])}>
              Add participant
            </Button>
          ) : null}
        </div>
        {members.map((member, index) => (
          <div key={index} className="grid gap-3 border border-navy/10 bg-white p-4 md:grid-cols-[1fr_1fr_auto_auto_auto]">
            <div className="space-y-1">
              <Label htmlFor={`usn-${index}`}>USN</Label>
              <Input id={`usn-${index}`} required value={member.usn} onChange={(event) => updateMember(index, { usn: event.target.value.toUpperCase() })} className="w-full border border-navy/20 px-3 py-2 text-sm" />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`weight-${index}`}>Weight (kg)</Label>
              <Input id={`weight-${index}`} type="number" min={1} max={499} step="0.01" value={member.weightKg} onChange={(event) => updateMember(index, { weightKg: event.target.value })} className="w-full border border-navy/20 px-3 py-2 text-sm" />
            </div>
            <label className="flex items-center gap-2 text-xs font-semibold">
              <input type="radio" name="captain" checked={member.isCaptain} onChange={() => setCaptain(index)} className="size-4 accent-[#3564E9]" /> Captain
            </label>
            <label className="flex items-center gap-2 text-xs font-semibold">
              <input type="checkbox" checked={member.isSubstitute} onChange={(event) => updateMember(index, { isSubstitute: event.target.checked })} className="size-4 accent-[#3564E9]" /> Substitute
            </label>
            {mode === "team" && members.length > 1 ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => setMembers((current) => current.filter((_, position) => position !== index))}>Remove</Button>
            ) : null}
          </div>
        ))}
        <p className="text-xs text-ink-muted">
          Weight is only required where an eligibility rule uses it. The server validates every USN against the official directory.
        </p>
      </div>

      {questions.length ? (
        <div className="space-y-4 border-t border-navy/10 pt-5">
          <h3 className="font-barlow text-xl uppercase text-navy">Additional questions</h3>
          {questions.map((question) => (
            <div key={question.key} className="space-y-2">
              <Label htmlFor={`answer-${question.key}`}>{question.label}</Label>
              {question.type === "select" ? (
                <select
                  id={`answer-${question.key}`}
                  required={question.required}
                  value={answers[question.key] ?? ""}
                  onChange={(event) => setAnswers((current) => ({ ...current, [question.key]: event.target.value }))}
                  className="w-full border border-navy/20 bg-white px-3 py-2 text-sm"
                >
                  <option value="">Choose…</option>
                  {(question.options ?? []).map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              ) : question.type === "number" ? (
                <Input
                  id={`answer-${question.key}`}
                  type="number"
                  required={question.required}
                  value={answers[question.key] ?? ""}
                  onChange={(event) => setAnswers((current) => ({ ...current, [question.key]: event.target.value }))}
                  className="w-full border border-navy/20 bg-white px-3 py-2 text-sm"
                />
              ) : (
                <Textarea
                  id={`answer-${question.key}`}
                  required={question.required}
                  value={answers[question.key] ?? ""}
                  onChange={(event) => setAnswers((current) => ({ ...current, [question.key]: event.target.value }))}
                  rows={3}
                  className="w-full border border-navy/20 bg-white px-3 py-2 text-sm"
                />
              )}
            </div>
          ))}
        </div>
      ) : null}

      <Button type="submit" variant="lime" disabled={pending}>
        {pending ? "Submitting…" : "Submit registration"}
      </Button>
    </form>
  );
}
