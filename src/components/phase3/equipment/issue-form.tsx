"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { issueEquipment } from "@/app/(admin)/admin/equipment/actions";
import { Phase3Notice } from "@/components/phase3/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { EquipmentAssetView, EquipmentItemView } from "@/types/domain";
import type { ActionState } from "@/types/domain";
import { EquipmentActionNotice } from "./equipment-action-notice";
import { Field, FormSelect } from "./form-controls";

export interface EquipmentStudentOption {
  id: string;
  label: string;
}

export function IssueForm({
  items,
  assets,
  students,
  defaultReturnAt,
  initialItemId = "",
}: {
  items: EquipmentItemView[];
  assets: EquipmentAssetView[];
  students: EquipmentStudentOption[];
  defaultReturnAt: string;
  initialItemId?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<ActionState | null>(null);
  const [studentDirectoryId, setStudentDirectoryId] = useState(students[0]?.id ?? "");
  const [itemId, setItemId] = useState(initialItemId || items[0]?.id || "");
  const [assetId, setAssetId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [expectedReturnAt, setExpectedReturnAt] = useState(defaultReturnAt);
  const [notes, setNotes] = useState("");

  const item = items.find((entry) => entry.id === itemId);
  const availableAssets = assets.filter(
    (asset) => asset.itemId === itemId && asset.status === "available",
  );
  const individual = item?.trackingMode === "individual";
  const canIssue = Boolean(studentDirectoryId && item && (!individual || availableAssets.length > 0));

  function submit() {
    setNotice(null);
    startTransition(async () => {
      const result = await issueEquipment({
        studentDirectoryId,
        itemId,
        assetId: individual ? assetId || availableAssets[0]?.id || "" : undefined,
        quantity: individual ? 1 : quantity,
        expectedReturnAt,
        notes,
      });
      setNotice(result);
      if (result.status === "success") {
        setNotes("");
        router.refresh();
      }
    });
  }

  return (
    <section className="border-t-4 border-t-navy bg-white p-6 shadow-sm">
      <h2 className="text-2xl font-bold">Issue equipment</h2>
      <p className="mt-1 text-xs text-ink-muted">
        Expected return times are entered in Indian Standard Time (IST).
      </p>

      {students.length === 0 ? (
        <div className="mt-4">
          <Phase3Notice tone="warning">No active PE students are available for issue.</Phase3Notice>
        </div>
      ) : null}

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field label="PE student" htmlFor="eq-issue-student">
          <FormSelect
            id="eq-issue-student"
            value={studentDirectoryId}
            onChange={(event) => setStudentDirectoryId(event.target.value)}
          >
            <option value="">Choose a student</option>
            {students.map((student) => (
              <option key={student.id} value={student.id}>
                {student.label}
              </option>
            ))}
          </FormSelect>
        </Field>
        <Field label="Equipment" htmlFor="eq-issue-item">
          <FormSelect
            id="eq-issue-item"
            value={itemId}
            onChange={(event) => {
              setItemId(event.target.value);
              setAssetId("");
            }}
          >
            <option value="">Choose equipment</option>
            {items.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name} · {entry.availableQuantity} available
              </option>
            ))}
          </FormSelect>
        </Field>

        {individual ? (
          <Field label="Available asset" htmlFor="eq-issue-asset">
            <FormSelect id="eq-issue-asset" value={assetId || availableAssets[0]?.id || ""} onChange={(event) => setAssetId(event.target.value)}>
              {availableAssets.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.assetTag}
                  {asset.serialNumber ? ` · ${asset.serialNumber}` : ""}
                </option>
              ))}
            </FormSelect>
          </Field>
        ) : (
          <Field label="Quantity" htmlFor="eq-issue-quantity">
            <Input
              id="eq-issue-quantity"
              type="number"
              min={1}
              max={Math.max(1, item?.availableQuantity ?? 1)}
              className="mt-2"
              value={quantity}
              onChange={(event) => setQuantity(Number(event.target.value))}
            />
          </Field>
        )}

        <Field label="Expected return (IST)" htmlFor="eq-issue-return">
          <Input
            id="eq-issue-return"
            type="datetime-local"
            className="mt-2"
            value={expectedReturnAt}
            onChange={(event) => setExpectedReturnAt(event.target.value)}
          />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Issue notes" htmlFor="eq-issue-notes">
            <Textarea
              id="eq-issue-notes"
              className="mt-2"
              rows={2}
              maxLength={500}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Optional handover detail"
            />
          </Field>
        </div>
      </div>

      <div className="mt-5">
        <EquipmentActionNotice state={notice} />
        <Button disabled={pending || !canIssue} onClick={submit}>
          {pending ? "Issuing…" : "Issue equipment"}
        </Button>
      </div>
    </section>
  );
}
