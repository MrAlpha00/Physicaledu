"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  saveMaintenance,
  setMaintenanceStatus,
} from "@/app/(admin)/admin/equipment/actions";
import { Phase3StatusBadge } from "@/components/phase3/common";
import { FileUploadControl } from "@/components/phase3/file-upload-control";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { canMaintenanceTransition } from "@/lib/operations/phase3";
import { formatIstDateTime } from "@/lib/time/india";
import type { EquipmentAssetView, EquipmentItemView, EquipmentMaintenanceView } from "@/types/domain";
import type { ActionState } from "@/types/domain";
import { EquipmentActionNotice } from "./equipment-action-notice";
import { Field, FormSelect } from "./form-controls";

const MAINTENANCE_TYPES = ["damage", "fault", "repair", "inspection", "other"] as const;
const REPORT_STATUSES = ["reported", "under_review", "scheduled", "in_progress"] as const;
const ALL_STATUSES = [
  "reported",
  "under_review",
  "scheduled",
  "in_progress",
  "completed",
  "unrepairable",
  "cancelled",
] as const;

type MaintenanceStatus = (typeof ALL_STATUSES)[number];

function toneFor(status: string) {
  if (["completed"].includes(status)) return "good" as const;
  if (["unrepairable", "cancelled"].includes(status)) return "bad" as const;
  if (["in_progress", "scheduled"].includes(status)) return "info" as const;
  return "warn" as const;
}

export function MaintenanceManager({
  items,
  assets,
  records,
}: {
  items: EquipmentItemView[];
  assets: EquipmentAssetView[];
  records: EquipmentMaintenanceView[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<ActionState | null>(null);
  const [itemId, setItemId] = useState(items[0]?.id ?? "");
  const [assetId, setAssetId] = useState("");
  const [issueDescription, setIssueDescription] = useState("");
  const [maintenanceType, setMaintenanceType] = useState<(typeof MAINTENANCE_TYPES)[number]>("fault");
  const [quantityAffected, setQuantityAffected] = useState(1);
  const [assignedPerson, setAssignedPerson] = useState("");
  const [scheduledFor, setScheduledFor] = useState("");
  const [expectedCompletionAt, setExpectedCompletionAt] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<(typeof REPORT_STATUSES)[number]>("reported");

  const itemAssets = assets.filter((asset) => asset.itemId === itemId);

  function submitReport() {
    setNotice(null);
    startTransition(async () => {
      const result = await saveMaintenance({
        itemId,
        assetId,
        issueDescription,
        maintenanceType,
        quantityAffected,
        assignedPerson,
        scheduledFor,
        expectedCompletionAt,
        notes,
        status,
      });
      setNotice(result);
      if (result.status === "success") {
        setIssueDescription("");
        setAssetId("");
        setAssignedPerson("");
        setScheduledFor("");
        setExpectedCompletionAt("");
        setNotes("");
        router.refresh();
      }
    });
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(300px,0.8fr)_minmax(0,1.2fr)]">
      <section className="border-t-4 border-t-coral bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-bold">Report maintenance</h2>
        <p className="mt-1 text-xs text-ink-muted">
          Report places available stock under maintenance until the record is closed.
        </p>
        <div className="mt-5 space-y-4">
          <Field label="Equipment" htmlFor="eq-maint-item">
            <FormSelect id="eq-maint-item" value={itemId} onChange={(event) => { setItemId(event.target.value); setAssetId(""); }}>
              <option value="">Choose equipment</option>
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} · {item.availableQuantity} available
                </option>
              ))}
            </FormSelect>
          </Field>
          <Field label="Specific asset" htmlFor="eq-maint-asset" hint="Optional. Leave blank for bulk stock.">
            <FormSelect id="eq-maint-asset" value={assetId} onChange={(event) => setAssetId(event.target.value)}>
              <option value="">Whole item / bulk stock</option>
              {itemAssets.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.assetTag} · {asset.status.replaceAll("_", " ")}
                </option>
              ))}
            </FormSelect>
          </Field>
          <Field label="Issue description" htmlFor="eq-maint-issue">
            <Textarea
              id="eq-maint-issue"
              className="mt-2"
              rows={4}
              minLength={10}
              maxLength={2000}
              value={issueDescription}
              onChange={(event) => setIssueDescription(event.target.value)}
              placeholder="Describe the fault or damage in detail"
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Type" htmlFor="eq-maint-type">
              <FormSelect
                id="eq-maint-type"
                value={maintenanceType}
                onChange={(event) => setMaintenanceType(event.target.value as (typeof MAINTENANCE_TYPES)[number])}
              >
                {MAINTENANCE_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </FormSelect>
            </Field>
            <Field label="Quantity affected" htmlFor="eq-maint-qty">
              <Input
                id="eq-maint-qty"
                type="number"
                min={1}
                max={1000}
                className="mt-2"
                value={quantityAffected}
                onChange={(event) => setQuantityAffected(Number(event.target.value))}
              />
            </Field>
            <Field label="Assigned person" htmlFor="eq-maint-assigned">
              <Input
                id="eq-maint-assigned"
                className="mt-2"
                maxLength={120}
                value={assignedPerson}
                onChange={(event) => setAssignedPerson(event.target.value)}
              />
            </Field>
            <Field label="Initial status" htmlFor="eq-maint-status">
              <FormSelect
                id="eq-maint-status"
                value={status}
                onChange={(event) => setStatus(event.target.value as (typeof REPORT_STATUSES)[number])}
              >
                {REPORT_STATUSES.map((option) => (
                  <option key={option} value={option}>
                    {option.replaceAll("_", " ")}
                  </option>
                ))}
              </FormSelect>
            </Field>
            <Field label="Scheduled for (IST)" htmlFor="eq-maint-scheduled">
              <Input
                id="eq-maint-scheduled"
                type="datetime-local"
                className="mt-2"
                value={scheduledFor}
                onChange={(event) => setScheduledFor(event.target.value)}
              />
            </Field>
            <Field label="Expected completion (IST)" htmlFor="eq-maint-completion">
              <Input
                id="eq-maint-completion"
                type="datetime-local"
                className="mt-2"
                value={expectedCompletionAt}
                onChange={(event) => setExpectedCompletionAt(event.target.value)}
              />
            </Field>
          </div>
          <Field label="Notes" htmlFor="eq-maint-notes">
            <Textarea
              id="eq-maint-notes"
              className="mt-2"
              rows={2}
              maxLength={1000}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </Field>
          <EquipmentActionNotice state={notice} />
          <Button disabled={pending || !itemId || issueDescription.trim().length < 10} onClick={submitReport}>
            {pending ? "Saving…" : "Report maintenance"}
          </Button>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-bold">Maintenance log</h2>
        {records.length === 0 ? (
          <p className="border border-dashed border-navy/20 bg-white p-10 text-center text-sm text-ink-muted">
            No maintenance records reported yet.
          </p>
        ) : (
          records.map((record) => (
            <MaintenanceRecordCard key={record.id} record={record} pending={pending} setPendingNotice={setNotice} />
          ))
        )}
      </section>
    </div>
  );
}

function MaintenanceRecordCard({
  record,
  pending,
  setPendingNotice,
}: {
  record: EquipmentMaintenanceView;
  pending: boolean;
  setPendingNotice: (state: ActionState | null) => void;
}) {
  const router = useRouter();
  const [localPending, startTransition] = useTransition();
  const [status, setStatus] = useState<MaintenanceStatus>(
    ALL_STATUSES.includes(record.status as (typeof ALL_STATUSES)[number])
      ? (record.status as MaintenanceStatus)
      : "reported",
  );
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [cost, setCost] = useState<number | "">("");
  const [localNotice, setLocalNotice] = useState<ActionState | null>(null);
  const options = ALL_STATUSES.filter((option) => canMaintenanceTransition(record.status, option));

  function submit() {
    setLocalNotice(null);
    setPendingNotice(null);
    startTransition(async () => {
      const result = await setMaintenanceStatus({
        recordId: record.id,
        status,
        resolutionNotes,
        cost,
      });
      setLocalNotice(result);
      setPendingNotice(result);
      if (result.status === "success") {
        setResolutionNotes("");
        setCost("");
        router.refresh();
      }
    });
  }

  return (
    <article className="border border-navy/10 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-navy/10 pb-3">
        <div>
          <h3 className="text-lg font-bold leading-tight">{record.itemName}</h3>
          <p className="eyebrow mt-1 text-ink-muted">
            {record.maintenanceType} · qty {record.quantityAffected} · reported {formatIstDateTime(record.reportedAt)}
          </p>
        </div>
        <Phase3StatusBadge label={record.status} tone={toneFor(record.status)} />
      </div>
      <p className="mt-3 text-sm leading-relaxed">{record.issueDescription}</p>
      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-ink-muted">
        {record.assetId ? <span>Asset linked</span> : null}
        {record.assignedPerson ? <span>Assigned: {record.assignedPerson}</span> : null}
        {record.scheduledFor ? <span>Scheduled: {formatIstDateTime(record.scheduledFor)}</span> : null}
        {record.cost !== null ? <span className="font-bold text-navy">Cost: ₹{record.cost.toFixed(2)}</span> : null}
      </div>
      {record.resolutionNotes ? (
        <p className="mt-3 border-l-4 border-l-lime bg-lime/10 p-3 text-xs">{record.resolutionNotes}</p>
      ) : null}

      {options.length ? (
        <div className="mt-4 grid gap-4 border-t border-navy/10 pt-4 sm:grid-cols-2">
          <Field label="New status" htmlFor={`maint-status-${record.id}`}>
            <FormSelect
              id={`maint-status-${record.id}`}
              value={status}
              onChange={(event) => setStatus(event.target.value as MaintenanceStatus)}
            >
              {options.map((option) => (
                <option key={option} value={option}>
                  {option.replaceAll("_", " ")}
                </option>
              ))}
            </FormSelect>
          </Field>
          <Field label="Cost (INR, optional)" htmlFor={`maint-cost-${record.id}`}>
            <Input
              id={`maint-cost-${record.id}`}
              type="number"
              min={0}
              step="0.01"
              className="mt-2"
              value={cost}
              onChange={(event) => setCost(event.target.value === "" ? "" : Number(event.target.value))}
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Resolution notes" htmlFor={`maint-resolution-${record.id}`}>
              <Textarea
                id={`maint-resolution-${record.id}`}
                className="mt-2"
                rows={2}
                maxLength={1000}
                value={resolutionNotes}
                onChange={(event) => setResolutionNotes(event.target.value)}
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <FileUploadControl
              name={`maint-photo-${record.id}`}
              parentType="maintenance_photo"
              parentId={record.id}
              label="Maintenance photo"
              accept=".jpg,.jpeg,.png,.webp"
            />
          </div>
          <div className="sm:col-span-2">
            <EquipmentActionNotice state={localNotice} />
            <Button size="sm" disabled={pending || localPending} onClick={submit}>
              Update status
            </Button>
          </div>
        </div>
      ) : (
        <p className="mt-4 border-t border-navy/10 pt-3 text-xs font-bold uppercase tracking-[0.14em] text-ink-muted">
          Record closed
        </p>
      )}
    </article>
  );
}
