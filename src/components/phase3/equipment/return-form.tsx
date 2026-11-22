"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { returnMyEquipment } from "@/app/(student)/my-equipment/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { EquipmentTransactionView } from "@/types/domain";
import type { ActionState } from "@/types/domain";
import { EquipmentActionNotice } from "./equipment-action-notice";
import { EQUIPMENT_CONDITION_OPTIONS, Field, FormSelect } from "./form-controls";

export function ReturnForm({
  transaction,
  token = "",
}: {
  transaction: EquipmentTransactionView;
  token?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<ActionState | null>(null);
  const remaining = Math.max(1, transaction.quantityIssued - transaction.quantityReturned);
  const [quantity, setQuantity] = useState(remaining);
  const [condition, setCondition] = useState<(typeof EQUIPMENT_CONDITION_OPTIONS)[number]>("good");
  const [damageIndicator, setDamageIndicator] = useState(false);
  const [notes, setNotes] = useState("");

  function submit() {
    setNotice(null);
    startTransition(async () => {
      const result = await returnMyEquipment({
        transactionId: transaction.id,
        quantity,
        condition,
        damageIndicator,
        notes,
        token: token || undefined,
      });
      setNotice(result);
      if (result.status === "success") {
        setNotes("");
        router.refresh();
      }
    });
  }

  return (
    <details className="border border-navy/15 bg-white p-3">
      <summary className="cursor-pointer text-[11px] font-bold uppercase tracking-[0.1em] text-cobalt">
        Return equipment
      </summary>
      <div className="mt-3 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Quantity" htmlFor={`my-return-qty-${transaction.id}`}>
            <Input
              id={`my-return-qty-${transaction.id}`}
              type="number"
              min={1}
              max={remaining}
              className="mt-2"
              value={quantity}
              onChange={(event) => setQuantity(Number(event.target.value))}
            />
          </Field>
          <Field label="Condition" htmlFor={`my-return-condition-${transaction.id}`}>
            <FormSelect
              id={`my-return-condition-${transaction.id}`}
              value={condition}
              onChange={(event) => setCondition(event.target.value as (typeof EQUIPMENT_CONDITION_OPTIONS)[number])}
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
          Item is damaged
        </label>
        <Field label="Return note" htmlFor={`my-return-notes-${transaction.id}`}>
          <Textarea
            id={`my-return-notes-${transaction.id}`}
            className="mt-2"
            rows={2}
            maxLength={500}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </Field>
        <EquipmentActionNotice state={notice} />
        <Button
          size="sm"
          variant="lime"
          disabled={pending || quantity < 1 || quantity > remaining}
          onClick={submit}
        >
          Confirm return
        </Button>
      </div>
    </details>
  );
}
