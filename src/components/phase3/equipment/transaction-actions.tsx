"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  adminReturnEquipment,
  correctEquipmentTransaction,
} from "@/app/(admin)/admin/equipment/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toIstLocalInput } from "@/lib/time/india";
import type { EquipmentTransactionView } from "@/types/domain";
import type { ActionState } from "@/types/domain";
import { EquipmentActionNotice } from "./equipment-action-notice";
import { EQUIPMENT_CONDITION_OPTIONS, Field, FormSelect } from "./form-controls";

export function TransactionActions({ transaction }: { transaction: EquipmentTransactionView }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<ActionState | null>(null);
  const remaining = Math.max(1, transaction.quantityIssued - transaction.quantityReturned);
  const [returnQuantity, setReturnQuantity] = useState(remaining);
  const [returnCondition, setReturnCondition] = useState<(typeof EQUIPMENT_CONDITION_OPTIONS)[number]>("good");
  const [damageIndicator, setDamageIndicator] = useState(false);
  const [returnNotes, setReturnNotes] = useState("");
  const [reason, setReason] = useState("");
  const [correctedReturn, setCorrectedReturn] = useState(toIstLocalInput(transaction.expectedReturnAt));

  function run(action: () => Promise<ActionState>, clear: () => void) {
    setNotice(null);
    startTransition(async () => {
      const result = await action();
      setNotice(result);
      if (result.status === "success") {
        clear();
        router.refresh();
      }
    });
  }

  const isOpen = !["returned", "cancelled", "lost"].includes(transaction.displayStatus);

  return (
    <div className="min-w-56 space-y-2">
      {isOpen ? (
        <details className="border border-navy/15 bg-white p-2">
          <summary className="cursor-pointer text-[11px] font-bold uppercase tracking-[0.1em] text-cobalt">
            Record return
          </summary>
          <div className="mt-3 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Field label="Qty" htmlFor={`return-qty-${transaction.id}`}>
                <Input
                  id={`return-qty-${transaction.id}`}
                  type="number"
                  min={1}
                  max={remaining}
                  className="mt-2"
                  value={returnQuantity}
                  onChange={(event) => setReturnQuantity(Number(event.target.value))}
                />
              </Field>
              <Field label="Condition" htmlFor={`return-condition-${transaction.id}`}>
                <FormSelect
                  id={`return-condition-${transaction.id}`}
                  value={returnCondition}
                  onChange={(event) => setReturnCondition(event.target.value as (typeof EQUIPMENT_CONDITION_OPTIONS)[number])}
                >
                  {EQUIPMENT_CONDITION_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </FormSelect>
              </Field>
            </div>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                className="size-4"
                checked={damageIndicator}
                onChange={(event) => setDamageIndicator(event.target.checked)}
              />
              Damage reported
            </label>
            <Field label="Notes" htmlFor={`return-notes-${transaction.id}`}>
              <Textarea
                id={`return-notes-${transaction.id}`}
                className="mt-2 min-h-16"
                rows={2}
                maxLength={500}
                value={returnNotes}
                onChange={(event) => setReturnNotes(event.target.value)}
              />
            </Field>
            <Button
              size="sm"
              variant="lime"
              disabled={pending || returnQuantity < 1 || returnQuantity > remaining}
              onClick={() =>
                run(
                  () =>
                    adminReturnEquipment({
                      transactionId: transaction.id,
                      quantity: returnQuantity,
                      condition: returnCondition,
                      damageIndicator,
                      notes: returnNotes,
                    }),
                  () => setReturnNotes(""),
                )
              }
            >
              Confirm return
            </Button>
          </div>
        </details>
      ) : null}

      <details className="border border-navy/15 bg-white p-2">
        <summary className="cursor-pointer text-[11px] font-bold uppercase tracking-[0.1em] text-cobalt">
          Correct record
        </summary>
        <div className="mt-3 space-y-3">
          <Field label="Reason" htmlFor={`correction-reason-${transaction.id}`}>
            <Textarea
              id={`correction-reason-${transaction.id}`}
              className="mt-2 min-h-16"
              rows={2}
              maxLength={300}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Audit reason for this change"
            />
          </Field>
          <Field label="Expected return (IST)" htmlFor={`correction-return-${transaction.id}`}>
            <Input
              id={`correction-return-${transaction.id}`}
              type="datetime-local"
              className="mt-2"
              value={correctedReturn}
              onChange={(event) => setCorrectedReturn(event.target.value)}
            />
          </Field>
          <Button
            size="sm"
            variant="outline"
            disabled={pending || reason.trim().length < 5}
            onClick={() =>
              run(
                () =>
                  correctEquipmentTransaction({
                    transactionId: transaction.id,
                    reason,
                    expectedReturnAt: correctedReturn,
                  }),
                () => {
                  setReason("");
                },
              )
            }
          >
            Save correction
          </Button>
        </div>
      </details>

      <EquipmentActionNotice state={notice} />
    </div>
  );
}
