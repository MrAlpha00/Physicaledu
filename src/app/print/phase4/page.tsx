import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";
import { PrintButton } from "@/components/phase3/reports/print-button";
import { Button } from "@/components/ui/button";
import { requirePeAdmin } from "@/lib/auth/session";
import {
  getPhase4ExportRows,
  PHASE4_EXPORT_DATASETS,
  PHASE4_EXPORT_LABELS,
  type Phase4ExportDataset,
} from "@/lib/export/phase4";
import { istDateString } from "@/lib/time/india";

export const metadata: Metadata = { title: "Print Phase 4 report" };
export const dynamic = "force-dynamic";

export default async function PrintPhase4Page({
  searchParams,
}: {
  searchParams: Promise<{ dataset?: string; eventId?: string; sportId?: string }>;
}) {
  await requirePeAdmin();
  const params = await searchParams;
  const raw = params.dataset ?? "standings";
  const dataset: Phase4ExportDataset = (PHASE4_EXPORT_DATASETS as readonly string[]).includes(raw)
    ? raw as Phase4ExportDataset
    : "standings";
  const eventId = z.string().uuid().safeParse(params.eventId ?? "");
  const sportId = z.string().uuid().safeParse(params.sportId ?? "");
  const rows = await getPhase4ExportRows(dataset, {
    eventId: eventId.success ? eventId.data : undefined,
    sportId: sportId.success ? sportId.data : undefined,
  });
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))].slice(0, 40);
  const label = PHASE4_EXPORT_LABELS[dataset];

  return (
    <div className="mx-auto max-w-6xl space-y-6 bg-white px-4 py-6 text-navy print:max-w-none print:px-0 print:py-0">
      <div className="flex items-center justify-between gap-3 print:hidden">
        <Button asChild variant="outline" size="sm"><Link href="/admin/events"><ArrowLeft /> Back to events</Link></Button>
        <PrintButton />
      </div>
      <header className="border-b-4 border-navy bg-navy px-6 py-6 text-chalk print:bg-white print:text-black">
        <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-lime print:text-black">VARSITY / PE department</p>
        <h1 className="mt-2 font-barlow text-4xl tracking-tight">{label}</h1>
        <p className="mt-3 text-xs text-chalk/75 print:text-black">Printed {istDateString()} · {rows.length} record(s) · PE Admin only</p>
      </header>
      {rows.length === 0 || columns.length === 0 ? (
        <p className="border border-dashed border-navy/25 px-6 py-12 text-center text-sm text-ink-muted">No records are available for this report.</p>
      ) : (
        <div className="overflow-x-auto print:overflow-visible">
          <table className="w-full border-collapse text-xs print:text-[9px]">
            <thead><tr className="border-b-2 border-navy bg-navy/[0.04] print:bg-transparent">
              {columns.map((column) => <th key={column} className="px-3 py-2 text-left font-extrabold uppercase tracking-[0.1em]">{column.replaceAll("_", " ")}</th>)}
            </tr></thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={index} className="border-b border-navy/10 break-inside-avoid">
                  {columns.map((column) => <td key={column} className="px-3 py-2">{row[column] === null || row[column] === undefined || row[column] === "" ? "—" : String(row[column])}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
