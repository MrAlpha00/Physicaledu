"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileUploadControl } from "@/components/phase3/file-upload-control";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { saveEquipmentItem } from "@/app/(admin)/admin/equipment/actions";
import type { EquipmentCategoryView, EquipmentItemView } from "@/types/domain";
import type { ActionState } from "@/types/domain";
import { EquipmentActionNotice } from "./equipment-action-notice";
import { EQUIPMENT_CONDITION_OPTIONS, Field, FormSelect } from "./form-controls";

export function ItemForm({
  categories,
  item,
  imageFileId = "",
  initialNotes = "",
}: {
  categories: EquipmentCategoryView[];
  item?: EquipmentItemView;
  imageFileId?: string;
  initialNotes?: string;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<ActionState | null>(null);
  const [categoryId, setCategoryId] = useState(item?.categoryId ?? categories[0]?.id ?? "");
  const [name, setName] = useState(item?.name ?? "");
  const [identificationNumber, setIdentificationNumber] = useState(item?.identificationNumber ?? "");
  const [trackingMode, setTrackingMode] = useState<"individual" | "bulk">(item?.trackingMode ?? "bulk");
  const [quantity, setQuantity] = useState(item?.quantity ?? 1);
  const [condition, setCondition] = useState<(typeof EQUIPMENT_CONDITION_OPTIONS)[number]>(item?.condition ?? "good");
  const [storageLocation, setStorageLocation] = useState(item?.storageLocation ?? "");
  const [purchasedOn, setPurchasedOn] = useState(item?.purchasedOn ?? "");
  const [usefulLifeMonths, setUsefulLifeMonths] = useState<number | "">(item?.usefulLifeMonths ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [notes, setNotes] = useState(initialNotes);
  const [isActive, setIsActive] = useState(item?.isActive ?? true);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    const uploadedId = String(new FormData(formRef.current ?? undefined).get("imageFileId") ?? "");
    startTransition(async () => {
      const result = await saveEquipmentItem({
        id: item?.id,
        categoryId,
        name,
        identificationNumber,
        trackingMode,
        quantity,
        condition,
        storageLocation,
        purchasedOn,
        usefulLifeMonths,
        description,
        notes,
        imageFileId: uploadedId || imageFileId || undefined,
        isActive,
      });
      setNotice(result);
      if (result.status === "success") router.refresh();
    });
  }

  return (
    <form ref={formRef} onSubmit={submit} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Category" htmlFor="eq-item-category">
          <FormSelect
            id="eq-item-category"
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
          >
            <option value="">Choose a category</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </FormSelect>
        </Field>
        <Field label="Equipment name" htmlFor="eq-item-name">
          <Input
            id="eq-item-name"
            className="mt-2"
            maxLength={120}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </Field>
        <Field label="Identification number" htmlFor="eq-item-identification">
          <Input
            id="eq-item-identification"
            className="mt-2"
            maxLength={80}
            value={identificationNumber}
            onChange={(event) => setIdentificationNumber(event.target.value)}
            placeholder="Optional, e.g. PE-CRT-014"
          />
        </Field>
        <Field
          label="Tracking mode"
          htmlFor="eq-item-mode"
          hint={item ? "Tracking mode is fixed once equipment is registered." : "Individual items get a separate asset tag; bulk items share one stock count."}
        >
          <FormSelect
            id="eq-item-mode"
            value={trackingMode}
            disabled={Boolean(item)}
            onChange={(event) => setTrackingMode(event.target.value as "individual" | "bulk")}
          >
            <option value="bulk">Bulk stock</option>
            <option value="individual">Individual (asset tags)</option>
          </FormSelect>
        </Field>
        <Field
          label="Registered quantity"
          htmlFor="eq-item-quantity"
          hint={item?.trackingMode === "individual" ? "Add or retire individual assets in the register below." : undefined}
        >
          <Input
            id="eq-item-quantity"
            type="number"
            min={1}
            max={10000}
            className="mt-2"
            value={quantity}
            disabled={item?.trackingMode === "individual"}
            onChange={(event) => setQuantity(Number(event.target.value))}
          />
        </Field>
        <Field label="Condition" htmlFor="eq-item-condition">
          <FormSelect
            id="eq-item-condition"
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
        <Field label="Storage location" htmlFor="eq-item-location">
          <Input
            id="eq-item-location"
            className="mt-2"
            maxLength={120}
            value={storageLocation}
            onChange={(event) => setStorageLocation(event.target.value)}
          />
        </Field>
        <Field label="Purchased on" htmlFor="eq-item-purchased">
          <Input
            id="eq-item-purchased"
            type="date"
            className="mt-2"
            value={purchasedOn}
            onChange={(event) => setPurchasedOn(event.target.value)}
          />
        </Field>
        <Field label="Useful life (months)" htmlFor="eq-item-life">
          <Input
            id="eq-item-life"
            type="number"
            min={1}
            max={600}
            className="mt-2"
            value={usefulLifeMonths}
            onChange={(event) =>
              setUsefulLifeMonths(event.target.value === "" ? "" : Number(event.target.value))
            }
          />
        </Field>
      </div>

      <Field label="Description" htmlFor="eq-item-description">
        <Textarea
          id="eq-item-description"
          className="mt-2"
          rows={3}
          maxLength={1000}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </Field>
      <Field label="Internal notes" htmlFor="eq-item-notes">
        <Textarea
          id="eq-item-notes"
          className="mt-2"
          rows={2}
          maxLength={1000}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />
      </Field>

      {item ? (
        <FileUploadControl
          name="imageFileId"
          parentType="equipment_image"
          parentId={item.id}
          visibility="public"
          label="Equipment photo"
          accept=".jpg,.jpeg,.png,.webp"
        />
      ) : (
        <p className="border border-dashed border-navy/20 p-3 text-xs text-ink-muted">
          Register the item first, then attach a photo from its edit form.
        </p>
      )}

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="size-4"
          checked={isActive}
          onChange={(event) => setIsActive(event.target.checked)}
        />
        Item active and available for issue
      </label>

      <EquipmentActionNotice state={notice} />
      <Button type="submit" disabled={pending || !categories.length || name.trim().length < 2}>
        {pending ? "Saving…" : item ? "Save item" : "Register item"}
      </Button>
    </form>
  );
}
