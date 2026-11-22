import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { QrForm } from "@/components/phase3/equipment/qr-form";
import { StockAdjustmentForm } from "@/components/phase3/equipment/stock-adjustment-form";
import { ItemLabel } from "@/components/phase3/equipment/item-label";
import { TransactionTable } from "@/components/phase3/equipment/transaction-table";
import { Phase3Header, Phase3StatusBadge } from "@/components/phase3/common";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  getEquipmentAssets,
  getEquipmentItems,
  getEquipmentTransactions,
  getMaintenanceRecords,
} from "@/lib/data/phase3-equipment";
import { formatIstDateTime } from "@/lib/time/india";

export const metadata: Metadata = { title: "Equipment item detail" };

export default async function AdminEquipmentItemDetailPage({
  params,
}: {
  params: Promise<{ itemId: string }>;
}) {
  const { itemId } = await params;
  const [items, assets, transactions, maintenance] = await Promise.all([
    getEquipmentItems(),
    getEquipmentAssets(itemId),
    getEquipmentTransactions(),
    getMaintenanceRecords(),
  ]);
  const item = items.find((entry) => entry.id === itemId);
  if (!item) notFound();

  const itemTransactions = transactions.filter((entry) => entry.itemId === itemId);
  const itemMaintenance = maintenance.filter((entry) => entry.itemId === itemId);
  const openLoans = itemTransactions.filter((entry) =>
    ["issued", "partially_returned", "overdue"].includes(entry.displayStatus),
  ).length;

  return (
    <div className="space-y-8">
      <div data-no-print className="space-y-8">
      <Phase3Header
        kicker="Equipment / Item record"
        title={item.name}
        description={`${item.categoryName} · ${item.identificationNumber ?? "No identification number"} · ${item.storageLocation ?? "No storage location"}`}
        actions={
          <Button asChild variant="outline" className="border-chalk/40 text-chalk hover:bg-chalk/10 hover:text-chalk">
            <Link href="/admin/equipment/items">
              <ArrowLeft /> Back to items
            </Link>
          </Button>
        }
      />

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: "Registered", value: item.quantity },
          { label: "Available", value: item.availableQuantity },
          { label: "On loan", value: item.borrowedQuantity },
          { label: "Maintenance", value: item.maintenanceQuantity },
          { label: "Damaged", value: item.damagedQuantity },
        ].map((stat) => (
          <div key={stat.label} className="border border-navy/10 border-l-4 border-l-navy bg-white px-4 py-3">
            <p className="eyebrow text-ink-muted">{stat.label}</p>
            <p className="mt-2 font-barlow text-4xl leading-none">{stat.value}</p>
          </div>
        ))}
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <Phase3StatusBadge label={item.inventoryStatus} tone={item.inventoryStatus === "available" ? "good" : "warn"} />
        <span className="text-xs text-ink-muted">{openLoans} open loan{openLoans === 1 ? "" : "s"} · {assets.length} tagged assets</span>
      </div>

      {item.trackingMode === "bulk" ? <StockAdjustmentForm itemId={item.id} /> : null}

      <section className="space-y-3">
        <h2 className="text-2xl font-bold">Asset register</h2>
        {assets.length === 0 ? (
          <p className="border border-dashed border-navy/20 bg-white p-8 text-center text-sm text-ink-muted">
            {item.trackingMode === "individual"
              ? "No assets registered for this item yet."
              : "Bulk items are tracked by quantity, not by individual asset tag."}
          </p>
        ) : (
          <div className="overflow-x-auto border border-navy/10 bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Asset tag</TableHead>
                  <TableHead>Serial</TableHead>
                  <TableHead>Condition</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Location</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assets.map((asset) => (
                  <TableRow key={asset.id}>
                    <TableCell className="font-mono text-xs font-bold">{asset.assetTag}</TableCell>
                    <TableCell className="text-xs text-ink-muted">{asset.serialNumber ?? "—"}</TableCell>
                    <TableCell className="text-xs capitalize">{asset.condition}</TableCell>
                    <TableCell><Phase3StatusBadge label={asset.status} /></TableCell>
                    <TableCell className="text-xs text-ink-muted">{asset.location ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-bold">Issue &amp; return history</h2>
        <TransactionTable transactions={itemTransactions} />
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-bold">Maintenance history</h2>
        {itemMaintenance.length === 0 ? (
          <p className="border border-dashed border-navy/20 bg-white p-8 text-center text-sm text-ink-muted">
            No maintenance records for this item.
          </p>
        ) : (
          <div className="space-y-2">
            {itemMaintenance.map((record) => (
              <div key={record.id} className="flex flex-wrap items-center justify-between gap-3 border-l-4 border-l-coral bg-white px-4 py-3">
                <div>
                  <p className="text-sm font-bold">{record.issueDescription}</p>
                  <p className="eyebrow mt-1 text-ink-muted">
                    {record.maintenanceType} · reported {formatIstDateTime(record.reportedAt)}
                  </p>
                </div>
                <Phase3StatusBadge label={record.status} />
              </div>
            ))}
          </div>
        )}
      </section>

      <QrForm item={item} assets={assets} />
      </div>

      <ItemLabel item={item} assets={assets} loanCount={openLoans} />
    </div>
  );
}
