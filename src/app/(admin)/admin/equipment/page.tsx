import type { Metadata } from "next";
import Link from "next/link";
import { Boxes, CircleAlert, Clock3, PackageCheck, Truck, Wrench } from "lucide-react";
import { Phase3Header, Phase3Metric, Phase3Notice, Phase3StatusBadge } from "@/components/phase3/common";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getEquipmentItems, getEquipmentMetrics } from "@/lib/data/phase3-equipment";

export const metadata: Metadata = { title: "Equipment management" };

export default async function AdminEquipmentPage() {
  const [metrics, items] = await Promise.all([getEquipmentMetrics(), getEquipmentItems()]);
  const attention = items.filter((item) =>
    ["damaged", "under_maintenance", "retired", "unavailable"].includes(item.inventoryStatus),
  );

  return (
    <div className="space-y-8">
      <Phase3Header
        kicker="Phase 3 / Department management"
        title="Equipment desk"
        description="Stock, issue records, individual assets and maintenance in one register. All numbers come from the live equipment tables."
        actions={
          <>
            <Button asChild variant="lime">
              <Link href="/admin/equipment/items">Manage items</Link>
            </Button>
            <Button asChild variant="outline" className="border-chalk/40 text-chalk hover:bg-chalk/10 hover:text-chalk">
              <Link href="/admin/equipment/transactions">Issue &amp; returns</Link>
            </Button>
          </>
        }
      />

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Phase3Metric label="Registered items" value={metrics.totalItems} detail="Distinct equipment catalogue entries" icon={Boxes} />
        <Phase3Metric label="Available units" value={metrics.availableItems} detail="Ready to issue from stock" icon={PackageCheck} tone="lime" />
        <Phase3Metric label="Currently issued" value={metrics.issuedQuantity} detail="Units with students" icon={Truck} tone="cobalt" />
        <Phase3Metric label="Overdue" value={metrics.overdueTransactions} detail="Transactions past expected return" icon={Clock3} tone="coral" />
        <Phase3Metric label="Open maintenance" value={metrics.openMaintenance} detail="Records not yet closed" icon={Wrench} tone="cobalt" />
        <Phase3Metric label="Damaged stock" value={metrics.damagedQuantity} detail="Units flagged on return or repair" icon={CircleAlert} tone="coral" />
      </section>

      {attention.length ? (
        <Phase3Notice tone="warning">
          {attention.length} item{attention.length === 1 ? "" : "s"} need attention in the register. Review the inventory table
          below or open the maintenance desk.
        </Phase3Notice>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Quick links">
        {[
          { href: "/admin/equipment/categories", label: "Categories", detail: "Group the catalogue" },
          { href: "/admin/equipment/items", label: "Items & assets", detail: "Register and adjust stock" },
          { href: "/admin/equipment/transactions", label: "Transactions", detail: "Issue, return, correct" },
          { href: "/admin/equipment/maintenance", label: "Maintenance", detail: "Report and close faults" },
        ].map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="border-l-4 border-l-navy bg-white px-5 py-4 transition-colors hover:border-l-lime hover:bg-lime/5"
          >
            <p className="text-sm font-bold uppercase tracking-[0.08em]">{link.label} →</p>
            <p className="mt-1 text-xs text-ink-muted">{link.detail}</p>
          </Link>
        ))}
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-2 border-b-2 border-navy pb-2">
          <h2 className="text-2xl font-bold">Inventory register</h2>
          <p className="text-xs text-ink-muted">{items.length} catalogue entries</p>
        </div>
        <div className="overflow-x-auto border border-navy/10 bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Equipment</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Tracking</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Status</TableHead>
                <TableHead aria-label="Open" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="p-10 text-center text-sm text-ink-muted">
                    No equipment registered. Start with a category, then add items.
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <p className="text-sm font-bold">{item.name}</p>
                      {item.identificationNumber ? (
                        <p className="mt-1 font-mono text-[11px] text-ink-muted">{item.identificationNumber}</p>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-xs text-ink-muted">{item.categoryName}</TableCell>
                    <TableCell className="text-xs capitalize">{item.trackingMode}</TableCell>
                    <TableCell className="text-xs tabular-nums">
                      {item.availableQuantity}/{item.quantity} free
                      <span className="block text-[10px] text-ink-muted">
                        {item.borrowedQuantity} out · {item.assetCount} tagged
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-ink-muted">{item.storageLocation ?? "—"}</TableCell>
                    <TableCell>
                      <Phase3StatusBadge label={item.inventoryStatus} tone={item.inventoryStatus === "available" ? "good" : "warn"} />
                    </TableCell>
                    <TableCell>
                      <Link href={`/admin/equipment/${item.id}`} className="text-xs font-bold text-cobalt hover:underline">
                        Open →
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}
