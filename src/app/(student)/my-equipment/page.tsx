import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { ReturnForm } from "@/components/phase3/equipment/return-form";
import { Phase3Header, Phase3Notice, Phase3StatusBadge } from "@/components/phase3/common";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/session";
import { getMyEquipmentTransactions } from "@/lib/data/phase3-equipment";
import { formatIstDateTime } from "@/lib/time/india";
import type { EquipmentTransactionView } from "@/types/domain";

export const metadata: Metadata = { title: "My equipment" };

function toneFor(status: EquipmentTransactionView["displayStatus"]) {
  switch (status) {
    case "returned":
      return "good" as const;
    case "overdue":
      return "bad" as const;
    case "issued":
    case "partially_returned":
      return "info" as const;
    default:
      return "warn" as const;
  }
}

export default async function MyEquipmentPage() {
  await requireUser();
  const transactions = await getMyEquipmentTransactions();
  const open = transactions.filter((entry) =>
    ["issued", "partially_returned", "overdue"].includes(entry.displayStatus),
  );
  const returned = transactions.filter((entry) => entry.displayStatus === "returned");
  const overdue = open.filter((entry) => entry.displayStatus === "overdue");

  return (
    <div className="space-y-8">
      <Phase3Header
        kicker="Student / PE resources"
        title="My equipment"
        description="Everything currently issued to you, anything overdue, and your completed returns."
        actions={
          <Button asChild variant="lime">
            <Link href="/equipment">Borrow more</Link>
          </Button>
        }
      />

      {overdue.length ? (
        <Phase3Notice tone="warning">
          {overdue.length} item{overdue.length === 1 ? "" : "s"} past the expected return time. Return them at the PE office as soon as possible.
        </Phase3Notice>
      ) : null}

      {transactions.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No equipment issued"
          description="When you borrow equipment from the PE store, the issue and return record will appear here."
          action={
            <Button asChild variant="lime">
              <Link href="/equipment">Browse equipment</Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-8">
          <section className="space-y-4">
            <div className="flex items-end justify-between border-b-2 border-navy pb-2">
              <h2 className="text-2xl font-bold">Currently with you</h2>
              <p className="text-xs text-ink-muted">{open.length} active</p>
            </div>
            {open.length === 0 ? (
              <p className="border border-dashed border-navy/20 bg-white p-8 text-center text-sm text-ink-muted">
                You have no equipment on loan.
              </p>
            ) : (
              open.map((entry) => (
                <article key={entry.id} className="border-l-4 border-l-cobalt bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-xl font-bold leading-none">{entry.itemName}</h3>
                      <p className="eyebrow mt-2 text-ink-muted">
                        Issued {formatIstDateTime(entry.issuedAt)} · Due {formatIstDateTime(entry.expectedReturnAt)}
                      </p>
                      {entry.assetTag ? <p className="mt-1 font-mono text-xs text-ink-muted">{entry.assetTag}</p> : null}
                    </div>
                    <Phase3StatusBadge label={entry.displayStatus} tone={toneFor(entry.displayStatus)} />
                  </div>
                  <p className="mt-3 text-xs text-ink-muted">
                    {entry.quantityIssued - entry.quantityReturned} unit(s) still to return
                  </p>
                  <div className="mt-4">
                    <ReturnForm transaction={entry} />
                  </div>
                </article>
              ))
            )}
          </section>

          <section className="space-y-4">
            <div className="flex items-end justify-between border-b-2 border-navy pb-2">
              <h2 className="text-2xl font-bold">Return history</h2>
              <p className="text-xs text-ink-muted">{returned.length} completed</p>
            </div>
            {returned.length === 0 ? (
              <p className="border border-dashed border-navy/20 bg-white p-8 text-center text-sm text-ink-muted">
                No completed returns yet.
              </p>
            ) : (
              <div className="overflow-x-auto border border-navy/10 bg-white">
                <table className="w-full text-left text-sm">
                  <thead className="bg-navy text-chalk">
                    <tr>
                      <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-[0.16em]">Equipment</th>
                      <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-[0.16em]">Issued</th>
                      <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-[0.16em]">Due date</th>
                      <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-[0.16em]">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-navy/10">
                    {returned.map((entry) => (
                      <tr key={entry.id}>
                        <td className="px-4 py-3 font-bold">{entry.itemName}</td>
                        <td className="px-4 py-3 text-xs text-ink-muted">{formatIstDateTime(entry.issuedAt)}</td>
                        <td className="px-4 py-3 text-xs">{formatIstDateTime(entry.expectedReturnAt)}</td>
                        <td className="px-4 py-3"><Phase3StatusBadge label={entry.displayStatus} tone="good" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
