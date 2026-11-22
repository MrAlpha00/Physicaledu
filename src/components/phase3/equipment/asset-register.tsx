"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { createEquipmentAsset } from "@/app/(admin)/admin/equipment/actions";
import { Phase3StatusBadge } from "@/components/phase3/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import type { EquipmentAssetView, EquipmentItemView } from "@/types/domain";
import type { ActionState } from "@/types/domain";
import { EquipmentActionNotice } from "./equipment-action-notice";
import { EQUIPMENT_CONDITION_OPTIONS, Field, FormSelect } from "./form-controls";

export function AssetRegister({
  item,
  assets,
}: {
  item: EquipmentItemView;
  assets: EquipmentAssetView[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<ActionState | null>(null);
  const [assetTag, setAssetTag] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [condition, setCondition] = useState<(typeof EQUIPMENT_CONDITION_OPTIONS)[number]>("good");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");

  function submit() {
    setNotice(null);
    startTransition(async () => {
      const result = await createEquipmentAsset({
        itemId: item.id,
        assetTag,
        serialNumber,
        condition,
        location,
        notes,
      });
      setNotice(result);
      if (result.status === "success") {
        setAssetTag("");
        setSerialNumber("");
        setLocation("");
        setNotes("");
        router.refresh();
      }
    });
  }

  return (
    <section className="mt-8 border-t border-navy/10 pt-6">
      <h3 className="text-xl font-bold">Asset register</h3>
      <p className="mt-1 text-xs text-ink-muted">
        Each unit is issued individually. New assets expand the registered quantity.
      </p>

      <div className="mt-4 overflow-x-auto border border-navy/10 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Asset tag</TableHead>
              <TableHead>Serial</TableHead>
              <TableHead>Condition</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {assets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="p-8 text-center text-sm text-ink-muted">
                  No assets registered for this item yet.
                </TableCell>
              </TableRow>
            ) : (
              assets.map((asset) => (
                <TableRow key={asset.id}>
                  <TableCell className="text-sm font-bold">{asset.assetTag}</TableCell>
                  <TableCell className="font-mono text-xs text-ink-muted">{asset.serialNumber ?? "—"}</TableCell>
                  <TableCell className="text-xs capitalize">{asset.condition}</TableCell>
                  <TableCell>
                    <Phase3StatusBadge label={asset.status} tone={asset.status === "available" ? "good" : "warn"} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="mt-5 grid gap-4 border-l-4 border-l-cobalt bg-white p-5 sm:grid-cols-2">
        <Field label="Asset tag" htmlFor="eq-asset-tag">
          <Input
            id="eq-asset-tag"
            className="mt-2"
            maxLength={80}
            value={assetTag}
            onChange={(event) => setAssetTag(event.target.value)}
          />
        </Field>
        <Field label="Serial number" htmlFor="eq-asset-serial">
          <Input
            id="eq-asset-serial"
            className="mt-2"
            maxLength={120}
            value={serialNumber}
            onChange={(event) => setSerialNumber(event.target.value)}
          />
        </Field>
        <Field label="Condition" htmlFor="eq-asset-condition">
          <FormSelect
            id="eq-asset-condition"
            value={condition}
            onChange={(event) => setCondition(event.target.value as (typeof EQUIPMENT_CONDITION_OPTIONS)[number])}
          >
            {EQUIPMENT_CONDITION_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option.charAt(0).toUpperCase() + option.slice(1)}
              </option>
            ))}
          </FormSelect>
        </Field>
        <Field label="Location" htmlFor="eq-asset-location">
          <Input
            id="eq-asset-location"
            className="mt-2"
            maxLength={120}
            value={location}
            onChange={(event) => setLocation(event.target.value)}
          />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Notes" htmlFor="eq-asset-notes">
            <Textarea
              id="eq-asset-notes"
              className="mt-2"
              rows={2}
              maxLength={500}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <EquipmentActionNotice state={notice} />
          <Button size="sm" disabled={pending || assetTag.trim().length < 2} onClick={submit}>
            <Plus /> Add asset
          </Button>
        </div>
      </div>
    </section>
  );
}
