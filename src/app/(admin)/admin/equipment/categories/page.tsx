import type { Metadata } from "next";
import { CategoryManager } from "@/components/phase3/equipment/category-manager";
import { Phase3Header } from "@/components/phase3/common";
import { getEquipmentCategories } from "@/lib/data/phase3-equipment";

export const metadata: Metadata = { title: "Equipment categories" };

export default async function AdminEquipmentCategoriesPage() {
  const categories = await getEquipmentCategories();
  return (
    <div className="space-y-8">
      <Phase3Header
        kicker="Equipment / Catalogue"
        title="Categories"
        description="Group equipment by sport or store so students can find it quickly. Inactive categories are hidden from student views."
      />
      <CategoryManager categories={categories} />
    </div>
  );
}
