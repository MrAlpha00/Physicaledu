"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { adjustEquipmentStock } from "@/app/(admin)/admin/equipment/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ActionState } from "@/types/domain";
import { EquipmentActionNotice } from "./equipment-action-notice";
import { Field } from "./form-controls";

export function StockAdjustmentForm({ itemId }: { itemId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<ActionState | null>(null);
  const [quantityDelta, setQuantityDelta] = useState(1);
  const [reason, setReason] = useState("");

  function submit() {
    setNotice(null);
    startTransition(async () => {
      const result = await adjustEquipmentStock({ itemId, quantityDelta, reason });
      setNotice(result);
      if (result.status === "success") {
        setReason("");
        router.refresh();
      }
    });
  }

  return (
    <section className="border-l-4 border-l-cobalt bg-white p-5">
      <h3 className="text-lg font-bold">Adjust bulk stock</h3>
      <p className="mt-1 text-xs text-ink-muted">Every adjustment is recorded with a reason and administrator audit entry.</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-[120px_minmax(0,1fr)_auto] sm:items-end">
        <Field label="Delta" htmlFor="eq-stock-delta">
          <Input
            id="eq-stock-delta"
            type="number"
            min={-10000}
            max={10000}
            className="mt-2"
            value={quantityDelta}
            onChange={(event) => setQuantityDelta(Number(event.target.value))}
          />
        </Field>
        <Field label="Reason" htmlFor="eq-stock-reason">
          <Input
            id="eq-stock-reason"
            className="mt-2"
            maxLength={300}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="e.g. New stock received"
          />
        </Field>
        <Button size="sm" disabled={pending || quantityDelta === 0 || reason.trim().length < 5} onClick={submit}>
          Adjust
        </Button>
      </div>
      <div className="mt-3">
        <EquipmentActionNotice state={notice} />
      </div>
    </section>
  );
}
