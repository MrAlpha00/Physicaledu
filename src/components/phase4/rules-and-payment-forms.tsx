"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  removeEligibilityRule,
  saveCompetitionRules,
  saveEligibilityRule,
  savePaymentSettings,
} from "@/app/(admin)/admin/events/actions";
import { Phase4ActionNotice } from "@/components/phase4/action-notice";
import { Phase4FileUploadControl } from "@/components/phase4/file-upload-control";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { competitionRulesSchema, type CompetitionRulesInput } from "@/lib/validations/phase4";
import type { ActionState } from "@/types/domain";
import type { Json, Phase4EligibilityRow, Phase4PaymentSettingsRow, Phase4RulesRow } from "@/types/database";

const fieldClass = "w-full border border-navy/20 bg-white px-3 py-2 text-sm";

type RuleType = "department" | "semester" | "academic_year" | "min_weight" | "max_weight" | "custom";

function asArray(value: Json | null): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

export function CompetitionRulesForm({
  competitionId,
  rules,
  eligibility,
}: {
  competitionId: string;
  rules: Phase4RulesRow | null;
  eligibility: Phase4EligibilityRow[];
}) {
  const router = useRouter();
  const [notice, setNotice] = useState<ActionState | null>(null);
  const [pending, startTransition] = useTransition();
  const [ruleType, setRuleType] = useState<RuleType>("semester");

  function submit(formData: FormData) {
    const customQuestionsText = String(formData.get("customQuestions") ?? "").trim();
    let customQuestions: Json[] = [];
    try {
      customQuestions = customQuestionsText ? (JSON.parse(customQuestionsText) as Json[]) : [];
    } catch {
      setNotice({ status: "error", message: "Custom questions must be valid JSON." });
      return;
    }
    startTransition(async () => {
      const result = await saveCompetitionRules({
        competitionId,
        teamNameRequired: formData.get("teamNameRequired") === "on",
        minTeamSize: Number(formData.get("minTeamSize")) || null,
        maxTeamSize: Number(formData.get("maxTeamSize")) || null,
        teamLimit: Number(formData.get("teamLimit")) || null,
        captainRequired: formData.get("captainRequired") === "on",
        substituteAllowance: Number(formData.get("substituteAllowance") ?? 0),
        allowMultipleCompetitions: formData.get("allowMultipleCompetitions") === "on",
        allowDuplicatePlayerOtherTeam: formData.get("allowDuplicatePlayerOtherTeam") === "on",
        requireMemberConfirmation: formData.get("requireMemberConfirmation") === "on",
        requireManualIdentityVerification: formData.get("requireManualIdentityVerification") === "on",
        requiredParticipantFields: String(formData.get("requiredParticipantFields") ?? "")
          .split(",").map((item) => item.trim()).filter(Boolean),
        customQuestions,
        publicRules: String(formData.get("publicRules") ?? ""),
        eligibilitySummary: String(formData.get("eligibilitySummary") ?? ""),
      });
      setNotice(result);
      if (result.status === "success") router.refresh();
    });
  }

  function addRule(formData: FormData) {
    let ruleValue: Record<string, unknown>;
    if (ruleType === "department") {
      ruleValue = {
        departments: String(formData.get("departments") ?? "").split(",").map((item) => item.trim()).filter(Boolean),
      };
    } else if (ruleType === "custom") {
      try {
        ruleValue = JSON.parse(String(formData.get("customValue") ?? "{}")) as Record<string, unknown>;
      } catch {
        setNotice({ status: "error", message: "Custom eligibility value must be valid JSON." });
        return;
      }
    } else {
      ruleValue = { min: Number(formData.get("ruleNumber") ?? 1) };
      if (ruleType.includes("weight")) ruleValue = { value: Number(formData.get("ruleNumber") ?? 1) };
    }
    startTransition(async () => {
      const result = await saveEligibilityRule({
        competitionId,
        ruleType,
        ruleValue,
        description: String(formData.get("description") ?? ""),
      });
      setNotice(result);
      if (result.status === "success") router.refresh();
    });
  }

  function remove(ruleId: string) {
    startTransition(async () => {
      setNotice(await removeEligibilityRule(ruleId, competitionId));
      router.refresh();
    });
  }

  return (
    <div className="space-y-8">
      <form action={submit} className="space-y-6">
        <Phase4ActionNotice state={notice} />
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="minTeamSize">Minimum roster</Label>
            <Input id="minTeamSize" name="minTeamSize" type="number" min={1} defaultValue={rules?.min_team_size ?? ""} className={fieldClass} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="maxTeamSize">Maximum roster</Label>
            <Input id="maxTeamSize" name="maxTeamSize" type="number" min={1} defaultValue={rules?.max_team_size ?? ""} className={fieldClass} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="substituteAllowance">Substitutes allowed</Label>
            <Input id="substituteAllowance" name="substituteAllowance" type="number" min={0} max={20} defaultValue={rules?.substitute_allowance ?? 0} className={fieldClass} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="teamLimit">Entry limit</Label>
            <Input id="teamLimit" name="teamLimit" type="number" min={1} defaultValue={rules?.team_limit ?? ""} className={fieldClass} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="requiredParticipantFields">Required participant fields (comma separated)</Label>
            <Input id="requiredParticipantFields" name="requiredParticipantFields" defaultValue={asArray(rules?.required_participant_fields ?? null).join(", ")} className={fieldClass} />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="publicRules">Published rules</Label>
            <Textarea id="publicRules" name="publicRules" rows={6} defaultValue={rules?.public_rules ?? ""} className={fieldClass} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="eligibilitySummary">Eligibility summary</Label>
            <Textarea id="eligibilitySummary" name="eligibilitySummary" rows={6} defaultValue={rules?.eligibility_summary ?? ""} className={fieldClass} />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="customQuestions">Custom questions (JSON array)</Label>
          <Textarea
            id="customQuestions"
            name="customQuestions"
            rows={5}
            defaultValue={JSON.stringify(rules?.custom_questions ?? [], null, 2)}
            className={fieldClass}
          />
          <p className="text-xs text-ink-muted">{`Example: [{"key":"jersey","label":"Jersey size","type":"select","options":["M","L"],"required":true}]`}</p>
        </div>
        <div className="flex flex-wrap gap-5 border-t border-navy/10 pt-5">
          {[
            ["teamNameRequired", "Team name required", rules?.team_name_required ?? true],
            ["captainRequired", "Captain required", rules?.captain_required ?? true],
            ["allowMultipleCompetitions", "Allow multiple competitions", rules?.allow_multiple_competitions ?? true],
            ["allowDuplicatePlayerOtherTeam", "Allow same student in another team", rules?.allow_duplicate_player_other_team ?? false],
            ["requireMemberConfirmation", "Require member confirmation", rules?.require_member_confirmation ?? false],
            ["requireManualIdentityVerification", "Manual identity verification", rules?.require_manual_identity_verification ?? false],
          ].map(([name, label, checked]) => (
            <label key={String(name)} className="flex items-center gap-2 text-sm font-semibold">
              <input type="checkbox" name={String(name)} defaultChecked={Boolean(checked)} className="size-4 accent-[#3564E9]" /> {String(label)}
            </label>
          ))}
        </div>
        <Button type="submit" variant="lime" disabled={pending}>{pending ? "Saving…" : "Save registration rules"}</Button>
      </form>

      <div className="border-t border-navy/10 pt-6">
        <h3 className="font-barlow text-xl uppercase text-navy">Eligibility rules</h3>
        <div className="mt-4 space-y-2">
          {eligibility.length ? eligibility.map((rule) => (
            <div key={rule.id} className="flex flex-wrap items-center justify-between gap-3 border border-navy/10 bg-white px-4 py-3">
              <div>
                <p className="text-sm font-bold capitalize text-navy">{rule.rule_type.replaceAll("_", " ")}</p>
                <p className="text-xs text-ink-muted">{rule.description || JSON.stringify(rule.rule_value)}</p>
              </div>
              <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => remove(rule.id)}>Remove</Button>
            </div>
          )) : <p className="text-sm text-ink-muted">No eligibility rules configured.</p>}
        </div>
        <form action={addRule} className="mt-5 grid gap-4 md:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="ruleType">Rule type</Label>
            <select id="ruleType" value={ruleType} onChange={(event) => setRuleType(event.target.value as RuleType)} className={fieldClass}>
              <option value="department">Department</option>
              <option value="semester">Minimum semester</option>
              <option value="academic_year">Minimum academic year</option>
              <option value="min_weight">Minimum weight</option>
              <option value="max_weight">Maximum weight</option>
              <option value="custom">Custom JSON</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ruleValue">Value</Label>
            {ruleType === "department" ? (
              <Input id="departments" name="departments" placeholder="Department UUIDs, comma separated" className={fieldClass} />
            ) : ruleType === "custom" ? (
              <Input id="customValue" name="customValue" defaultValue="{}" className={fieldClass} />
            ) : (
              <Input id="ruleNumber" name="ruleNumber" type="number" min={1} step="0.01" defaultValue={1} className={fieldClass} />
            )}
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="description">Description</Label>
            <Input id="description" name="description" className={fieldClass} />
          </div>
          <div className="md:col-span-4">
            <Button type="submit" variant="outline" disabled={pending}>Add eligibility rule</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function PaymentSettingsForm({
  competitionId,
  payment,
}: {
  competitionId: string;
  payment: Phase4PaymentSettingsRow | null;
}) {
  const router = useRouter();
  const [notice, setNotice] = useState<ActionState | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    startTransition(async () => {
      const result = await savePaymentSettings({
        competitionId,
        isRequired: formData.get("isRequired") === "on",
        feeAmount: Number(formData.get("feeAmount")) || null,
        paymentUnit: String(formData.get("paymentUnit") ?? "team") as "team",
        instructions: String(formData.get("instructions") ?? ""),
        paymentDeadline: String(formData.get("paymentDeadline") ?? "") || null,
        qrFileId: String(formData.get("qrFileId") ?? "") || null,
      });
      setNotice(result);
      if (result.status === "success") router.refresh();
    });
  }

  return (
    <form action={submit} className="space-y-5">
      <Phase4ActionNotice state={notice} />
      <div className="grid gap-4 md:grid-cols-3">
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" name="isRequired" defaultChecked={payment?.is_required ?? false} className="size-4 accent-[#3564E9]" /> Payment required
        </label>
        <div className="space-y-2">
          <Label htmlFor="feeAmount">Fee amount</Label>
          <Input id="feeAmount" name="feeAmount" type="number" min={0} step="0.01" defaultValue={payment?.fee_amount ?? ""} className={fieldClass} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="paymentUnit">Charged per</Label>
          <select id="paymentUnit" name="paymentUnit" defaultValue={payment?.payment_unit ?? "team"} className={fieldClass}>
            <option value="team">Team</option>
            <option value="participant">Participant</option>
          </select>
        </div>
        <div className="space-y-2 md:col-span-3">
          <Label htmlFor="paymentDeadline">Payment deadline</Label>
          <Input id="paymentDeadline" name="paymentDeadline" type="datetime-local" defaultValue={payment?.payment_deadline?.slice(0, 16) ?? ""} className={fieldClass} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="instructions">Payment instructions</Label>
        <Textarea id="instructions" name="instructions" rows={4} defaultValue={payment?.instructions ?? ""} className={fieldClass} />
      </div>
      <Phase4FileUploadControl
        name="qrFileId"
        parentType="payment_qr"
        parentId={competitionId}
        label="Payment QR code"
        visibility="public"
        initialFileId={payment?.qr_file_id ?? ""}
      />
      <Button type="submit" variant="lime" disabled={pending}>{pending ? "Saving…" : "Save payment settings"}</Button>
    </form>
  );
}
