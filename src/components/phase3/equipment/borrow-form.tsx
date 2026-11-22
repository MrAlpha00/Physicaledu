"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { borrowEquipmentAsStudent } from "@/app/(student)/equipment/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { EquipmentTrackingMode } from "@/types/database";
import type { ActionState, EquipmentAssetView } from "@/types/domain";
import { EquipmentActionNotice } from "./equipment-action-notice";
import { Field, FormSelect } from "./form-controls";

export function BorrowForm({
  itemId,
  itemName,
  trackingMode,
  availableQuantity,
  assets,
  defaultReturnAt,
  lockedAssetId = "",
  lockedAssetLabel = "",
}: {
  itemId: string;
  itemName: string;
  trackingMode: EquipmentTrackingMode;
  availableQuantity: number;
  assets: EquipmentAssetView[];
  defaultReturnAt: string;
  lockedAssetId?: string;
  lockedAssetLabel?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<ActionState | null>(null);
  const [assetId, setAssetId] = useState(lockedAssetId || assets[0]?.id || "");
  const [quantity, setQuantity] = useState(1);
  const [expectedReturnAt, setExpectedReturnAt] = useState(defaultReturnAt);
  const [notes, setNotes] = useState("");

  const individual = trackingMode === "individual";
  const canBorrow = individual ? Boolean(assetId || assets[0]?.id) : availableQuantity > 0;

  function submit() {
    setNotice(null);
    startTransition(async () => {
      const result = await borrowEquipmentAsStudent({
        itemId,
        assetId: individual ? assetId || assets[0]?.id || "" : undefined,
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
    <div className="border-t border-navy/10 pt-4">
      <p className="eyebrow text-ink-muted">Borrow {itemName}</p>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        {individual ? (
          lockedAssetId || assets.length === 1 ? (
            <Field label="Asset" htmlFor={`borrow-asset-${itemId}`}>
              <Input
                id={`borrow-asset-${itemId}`}
                className="mt-2 uppercase"
                value={lockedAssetLabel || assets[0]?.assetTag || lockedAssetId}
                readOnly
              />
            </Field>
          ) : (
            <Field label="Choose available unit" htmlFor={`borrow-asset-${itemId}`}>
              <FormSelect
                id={`borrow-asset-${itemId}`}
                value={assetId || assets[0]?.id || ""}
                onChange={(event) => setAssetId(event.target.value)}
              >
                {assets.map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.assetTag}
                  </option>
                ))}
              </FormSelect>
            </Field>
          )
        ) : (
          <Field label="Quantity" htmlFor={`borrow-qty-${itemId}`}>
            <Input
              id={`borrow-qty-${itemId}`}
              type="number"
              min={1}
              max={Math.max(1, availableQuantity)}
              className="mt-2"
              value={quantity}
              onChange={(event) => setQuantity(Number(event.target.value))}
            />
          </Field>
        )}
        <Field label="Expected return (IST)" htmlFor={`borrow-return-${itemId}`}>
          <Input
            id={`borrow-return-${itemId}`}
            type="datetime-local"
            className="mt-2"
            value={expectedReturnAt}
            onChange={(event) => setExpectedReturnAt(event.target.value)}
          />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Note for PE office" htmlFor={`borrow-notes-${itemId}`}>
            <Textarea
              id={`borrow-notes-${itemId}`}
              className="mt-2"
              rows={2}
              maxLength={500}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </Field>
        </div>
      </div>
      <div className="mt-4">
        <EquipmentActionNotice state={notice} />
        <Button variant="lime" disabled={pending || !canBorrow} onClick={submit}>
          {pending ? "Requesting…" : "Borrow equipment"}
        </Button>
      </div>
    </div>
  );
}
