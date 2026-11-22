"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import Link from "next/link";
import { QrCode } from "lucide-react";
import { createEquipmentQr } from "@/app/(admin)/admin/equipment/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { EquipmentAssetView, EquipmentItemView } from "@/types/domain";
import type { ActionState } from "@/types/domain";
import { EquipmentActionNotice } from "./equipment-action-notice";
import { Field, FormSelect } from "./form-controls";

export function QrForm({
  item,
  assets,
}: {
  item: EquipmentItemView;
  assets: EquipmentAssetView[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<ActionState | null>(null);
  const [name, setName] = useState(`${item.name} — PE equipment`);
  const [assetId, setAssetId] = useState("");

  function submit() {
    setNotice(null);
    startTransition(async () => {
      const result = await createEquipmentQr({ name, itemId: item.id, assetId });
      setNotice(result);
      if (result.status === "success") router.refresh();
    });
  }

  return (
    <section className="border-l-4 border-l-lime bg-white p-6 shadow-sm">
      <div className="flex items-center gap-3">
        <QrCode className="size-5 text-cobalt" />
        <h3 className="text-xl font-bold">Create QR label</h3>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-ink-muted">
        Equipment codes open the student issue page. Asset-specific codes point at one registered unit.
      </p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field label="QR display name" htmlFor={`eq-qr-name-${item.id}`}>
          <Input
            id={`eq-qr-name-${item.id}`}
            className="mt-2"
            maxLength={80}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </Field>
        {item.trackingMode === "individual" ? (
          <Field label="Asset" htmlFor={`eq-qr-asset-${item.id}`} hint="Leave blank for a general item QR.">
            <FormSelect
              id={`eq-qr-asset-${item.id}`}
              value={assetId}
              onChange={(event) => setAssetId(event.target.value)}
            >
              <option value="">General item QR</option>
              {assets.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.assetTag}
                </option>
              ))}
            </FormSelect>
          </Field>
        ) : null}
      </div>
      <div className="mt-5">
        <EquipmentActionNotice state={notice} />
        <div className="flex flex-wrap items-center gap-4">
          <Button disabled={pending || name.trim().length < 2} onClick={submit}>
            {pending ? "Creating…" : "Create QR"}
          </Button>
          <Link href="/admin/qr-codes/print" className="text-xs font-bold text-cobalt hover:underline">
            Print QR posters →
          </Link>
        </div>
      </div>
    </section>
  );
}
