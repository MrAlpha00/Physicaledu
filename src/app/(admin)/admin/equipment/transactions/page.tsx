import type { Metadata } from "next";
import { IssueForm, type EquipmentStudentOption } from "@/components/phase3/equipment/issue-form";
import { TransactionTable } from "@/components/phase3/equipment/transaction-table";
import { Phase3Header } from "@/components/phase3/common";
import {
  getEquipmentAssets,
  getEquipmentItems,
  getEquipmentTransactions,
} from "@/lib/data/phase3-equipment";
import { createClient } from "@/lib/supabase/server";
import { toIstLocalInput } from "@/lib/time/india";

export const metadata: Metadata = { title: "Equipment transactions" };

export default async function AdminEquipmentTransactionsPage() {
  const [items, assets, transactions, studentData] = await Promise.all([
    getEquipmentItems(),
    getEquipmentAssets(),
    getEquipmentTransactions(),
    (async () => {
      const supabase = await createClient();
      const [directory, memberships] = await Promise.all([
        supabase
          .from("student_directory")
          .select("id, usn, full_name")
          .eq("is_active", true)
          .order("full_name"),
        supabase.from("pe_memberships").select("student_directory_id").eq("status", "active"),
      ]);
      const activeIds = new Set((memberships.data ?? []).map((row) => row.student_directory_id));
      const students: EquipmentStudentOption[] = (directory.data ?? [])
        .filter((row) => activeIds.has(row.id))
        .map((row) => ({ id: row.id, label: `${row.full_name} · ${row.usn}` }));
      return students;
    })(),
  ]);

  const defaultReturnAt = toIstLocalInput(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));

  return (
    <div className="space-y-8">
      <Phase3Header
        kicker="Equipment / Operations"
        title="Issue & returns"
        description="Issue stock to active PE students, record returns and correct historical records with a full audit trail."
      />
      <IssueForm
        items={items.filter((item) => item.isActive)}
        assets={assets}
        students={studentData}
        defaultReturnAt={defaultReturnAt}
      />
      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-2 border-b-2 border-navy pb-2">
          <h2 className="text-2xl font-bold">Issue history</h2>
          <p className="text-xs text-ink-muted">{transactions.length} recent transactions</p>
        </div>
        <TransactionTable transactions={transactions} />
      </section>
    </div>
  );
}
