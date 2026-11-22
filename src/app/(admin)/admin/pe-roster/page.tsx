import type { Metadata } from "next";
import { PeRosterManager } from "@/components/tables/pe-roster-manager";
import { getDepartmentOptions, getDirectoryRows } from "@/lib/data/admin";

export const metadata: Metadata = { title: "PE Roster" };

export default async function PeRosterPage() {
  const [records, departments] = await Promise.all([
    getDirectoryRows(),
    getDepartmentOptions(),
  ]);

  return (
    <div className="space-y-7">
      <div className="border-b-2 border-navy pb-6">
        <p className="eyebrow text-cobalt">Administration / Students / PE Roster</p>
        <h1 className="mt-3 text-5xl font-bold leading-none">PE Roster</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-muted">
          PE membership is separate from having a college account. Only students on
          this active roster will be eligible for PE classroom functionality.
        </p>
      </div>
      <PeRosterManager records={records} departments={departments} />
    </div>
  );
}
