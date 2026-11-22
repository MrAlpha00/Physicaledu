import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requirePeAdmin } from "@/lib/auth/session";
import { getExportRows } from "@/lib/data/phase3-reports";
import { EXPORT_DATASET_LABELS } from "@/lib/export/phase3";
import { exportDatasetSchema } from "@/lib/validations/phase3";
import { istDateString } from "@/lib/time/india";
import { PrintButton } from "@/components/phase3/reports/print-button";
import { Button } from "@/components/ui/button";
import { resolveReportWindow } from "@/app/(admin)/admin/reports/report-window";

export const metadata: Metadata = { title: "Print report" };
export const dynamic = "force-dynamic";

export default async function PrintReportPage({
  searchParams,
}: {
  searchParams: Promise<{ dataset?: string; preset?: string; from?: string; to?: string }>;
}) {
  await requirePeAdmin();
  const params = await searchParams;
  const parsedDataset = exportDatasetSchema.safeParse(params.dataset ?? "achievements");
  const dataset = parsedDataset.success ? parsedDataset.data : "achievements";
  const reportWindow = resolveReportWindow(params);
  const rows = await getExportRows(dataset, reportWindow.window.from, reportWindow.window.to);
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))].slice(0, 40);
  const label = EXPORT_DATASET_LABELS[dataset] ?? dataset;

  return (
    <div className="mx-auto max-w-6xl space-y-6 bg-white px-4 py-6 text-navy print:max-w-none print:px-0 print:py-0">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Button asChild variant="outline" size="sm">
          <Link href="/admin/reports"><ArrowLeft /> Back to reports</Link>
        </Button>
        <PrintButton />
      </div>

      <header className="border-b-4 border-navy bg-navy px-6 py-6 text-chalk print:bg-white print:text-black">
        <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-lime print:text-black">VARSITY / PE department</p>
        <h1 className="mt-2 font-barlow text-4xl leading-none tracking-tight">{label}</h1>
        <p className="mt-3 text-xs text-chalk/75 print:text-black">
          Window: {reportWindow.label} ({reportWindow.fromParam} – {reportWindow.toParam}, IST) · Printed {istDateString()} · {rows.length} record(s) · PE Admin only
        </p>
      </header>

      {rows.length === 0 || columns.length === 0 ? (
        <p className="border border-dashed border-navy/25 px-6 py-12 text-center text-sm text-ink-muted">
          No records are available for this dataset and window.
        </p>
      ) : (
        <div className="overflow-x-auto print:overflow-visible">
          <table className="w-full border-collapse text-xs print:text-[9px]">
            <thead>
              <tr className="border-b-2 border-navy bg-navy/[0.04] print:bg-transparent">
                {columns.map((column) => (
                  <th key={column} className="px-3 py-2 text-left align-top font-extrabold uppercase tracking-[0.1em]">
                    {column.replaceAll("_", " ")}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={index} className="border-b border-navy/10 break-inside-avoid">
                  {columns.map((column) => (
                    <td key={column} className="max-w-64 px-3 py-2 align-top [overflow-wrap:anywhere]">
                      {row[column] === null || row[column] === undefined || row[column] === ""
                        ? "—"
                        : String(row[column])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-[10px] text-ink-muted print:hidden">This table is rendered directly from server-side report data; the print view makes no additional data requests.</p>
    </div>
  );
}
