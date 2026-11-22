import type { Metadata } from "next";
import { MaintenanceManager } from "@/components/phase3/equipment/maintenance-manager";
import { Phase3Header } from "@/components/phase3/common";
import {
  getEquipmentAssets,
  getEquipmentItems,
  getMaintenanceRecords,
} from "@/lib/data/phase3-equipment";

export const metadata: Metadata = { title: "Equipment maintenance" };

export default async function AdminEquipmentMaintenancePage() {
  const [items, assets, records] = await Promise.all([
    getEquipmentItems(),
    getEquipmentAssets(),
    getMaintenanceRecords(),
  ]);

  return (
    <div className="space-y-8">
      <Phase3Header
        kicker="Equipment / Operations"
        title="Maintenance desk"
        description="Report damaged or faulty equipment, move records through review and repair, and close them with an authorised cost."
      />
      <MaintenanceManager items={items} assets={assets} records={records} />
    </div>
  );
}
