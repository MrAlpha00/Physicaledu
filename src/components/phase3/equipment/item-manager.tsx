"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Phase3StatusBadge } from "@/components/phase3/common";
import { Button } from "@/components/ui/button";
import type { EquipmentAssetView, EquipmentCategoryView, EquipmentItemView } from "@/types/domain";
import { cn } from "@/lib/utils";
import { AssetRegister } from "./asset-register";
import { ItemForm } from "./item-form";

export function ItemManager({
  items,
  categories,
  assets,
  imageFileIds,
  notesByItem,
}: {
  items: EquipmentItemView[];
  categories: EquipmentCategoryView[];
  assets: EquipmentAssetView[];
  imageFileIds: Record<string, string>;
  notesByItem: Record<string, string>;
}) {
  const [selectedId, setSelectedId] = useState(items[0]?.id ?? "");
  const selected = items.find((item) => item.id === selectedId);

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(260px,0.75fr)_minmax(0,1.25fr)]">
      <aside className="border border-navy/10 bg-white">
        <div className="flex items-center justify-between border-b-2 border-navy px-4 py-3">
          <h2 className="text-lg font-bold">Registered items</h2>
          <Button
            size="sm"
            variant={selectedId === "" ? "lime" : "outline"}
            onClick={() => setSelectedId("")}
          >
            <Plus /> New
          </Button>
        </div>
        <div className="max-h-[600px] divide-y divide-navy/10 overflow-y-auto">
          {items.length === 0 ? (
            <p className="p-5 text-sm text-ink-muted">No equipment registered yet.</p>
          ) : (
            items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedId(item.id)}
                className={cn(
                  "block w-full px-4 py-3 text-left transition-colors hover:bg-navy/5",
                  selectedId === item.id ? "border-l-4 border-l-lime bg-lime/10" : "border-l-4 border-l-transparent",
                )}
              >
                <span className="flex items-start justify-between gap-2">
                  <span className="text-sm font-bold leading-tight">{item.name}</span>
                  <Phase3StatusBadge label={item.inventoryStatus} />
                </span>
                <span className="mt-1 block text-[11px] text-ink-muted">
                  {item.categoryName} · {item.trackingMode} · {item.availableQuantity}/{item.quantity} available
                </span>
              </button>
            ))
          )}
        </div>
      </aside>

      <section className="border border-navy/10 bg-white p-6 shadow-sm">
        <div className="border-b-2 border-navy pb-3">
          <p className="eyebrow text-cobalt">{selected ? "Edit equipment" : "New equipment"}</p>
          <h2 className="mt-2 text-2xl font-bold">{selected ? selected.name : "Register an item"}</h2>
          {selected ? (
            <Link href={`/admin/equipment/${selected.id}`} className="mt-1 inline-block text-xs font-bold text-cobalt hover:underline">
              Open detail and QR tools →
            </Link>
          ) : null}
        </div>
        <div className="mt-5">
          <ItemForm
            key={selected?.id ?? "new"}
            categories={categories}
            item={selected}
            imageFileId={selected ? imageFileIds[selected.id] ?? "" : ""}
            initialNotes={selected ? notesByItem[selected.id] ?? "" : ""}
          />
        </div>
        {selected?.trackingMode === "individual" ? (
          <AssetRegister key={`assets-${selected.id}`} item={selected} assets={assets.filter((asset) => asset.itemId === selected.id)} />
        ) : null}
      </section>
    </div>
  );
}
