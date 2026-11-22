import { Download, Printer } from "lucide-react";
import { EXPORT_DATASET_LABELS } from "@/lib/export/phase3";
import { exportDatasetSchema } from "@/lib/validations/phase3";
import { Button } from "@/components/ui/button";

function exportUrl(dataset: string, format: "xlsx" | "csv", from: string, to: string): string {
  const query = new URLSearchParams({ dataset, format, preset: "custom", from, to });
  return `/api/admin/exports/phase3?${query.toString()}`;
}

function printUrl(dataset: string, from: string, to: string): string {
  const query = new URLSearchParams({ dataset, preset: "custom", from, to });
  return `/print/reports?${query.toString()}`;
}

export function ReportExportLinks({ from, to }: { from: string; to: string }) {
  return (
    <section className="border border-navy/10 bg-white shadow-sm">
      <header className="border-b border-navy/10 bg-navy px-6 py-5 text-chalk">
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-lime">Exports</p>
        <h2 className="mt-1 font-barlow text-3xl tracking-tight">Download &amp; print</h2>
        <p className="mt-2 text-xs text-chalk/70">Every export uses the same IST window as the charts above and is recorded in the audit log.</p>
      </header>
      <div className="divide-y divide-navy/10">
        {exportDatasetSchema.options.map((dataset) => {
          const label = EXPORT_DATASET_LABELS[dataset] ?? dataset;
          return (
            <div key={dataset} className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
              <div>
                <p className="text-sm font-bold text-navy">{label}</p>
                <p className="text-[11px] text-ink-muted">{dataset}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button asChild size="sm" variant="lime">
                  <a href={exportUrl(dataset, "xlsx", from, to)}><Download /> XLSX</a>
                </Button>
                <Button asChild size="sm" variant="cobalt">
                  <a href={exportUrl(dataset, "csv", from, to)}><Download /> CSV</a>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <a href={printUrl(dataset, from, to)}><Printer /> Print</a>
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
