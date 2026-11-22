import type { Metadata } from "next";
import { ItemManager } from "@/components/phase3/equipment/item-manager";
import { Phase3Header } from "@/components/phase3/common";
import { getEquipmentAssets, getEquipmentCategories, getEquipmentItems } from "@/lib/data/phase3-equipment";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Equipment items" };

export default async function AdminEquipmentItemsPage() {
  const [categories, items, assets, imageResult] = await Promise.all([
    getEquipmentCategories(),
    getEquipmentItems(),
    getEquipmentAssets(),
    createClient().then((supabase) =>
      supabase.from("equipment_items").select("id, image_file_id, notes"),
    ),
  ]);

  const imageFileIds: Record<string, string> = {};
  const notesByItem: Record<string, string> = {};
  (imageResult.data ?? []).forEach((row) => {
    imageFileIds[row.id] = row.image_file_id ?? "";
    notesByItem[row.id] = row.notes ?? "";
  });

  return (
    <div className="space-y-8">
      <Phase3Header
        kicker="Equipment / Catalogue"
        title="Items & assets"
        description="Register equipment, choose individual or bulk tracking, and maintain the asset register for tagged units."
      />
      <ItemManager
        items={items}
        categories={categories}
        assets={assets}
        imageFileIds={imageFileIds}
        notesByItem={notesByItem}
      />
    </div>
  );
}
