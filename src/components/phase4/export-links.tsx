import Link from "next/link";
import { Download, Printer } from "lucide-react";
import { PHASE4_EXPORT_DATASETS, PHASE4_EXPORT_LABELS } from "@/lib/export/phase4";
import { Button } from "@/components/ui/button";

export function Phase4ExportLinks({
  eventId,
  sportId,
  datasets = PHASE4_EXPORT_DATASETS,
}: {
  eventId?: string;
  sportId?: string;
  datasets?: readonly (typeof PHASE4_EXPORT_DATASETS)[number][];
}) {
  const query = new URLSearchParams();
  if (eventId) query.set("eventId", eventId);
  if (sportId) query.set("sportId", sportId);
  const printQuery = new URLSearchParams(query);
  printQuery.set("dataset", "standings");

  return (
    <section className="border border-navy/10 bg-white p-5">
      <p className="eyebrow">Reports</p>
      <h2 className="mt-1 font-barlow text-2xl uppercase text-navy">Exports & print</h2>
      <p className="mt-2 text-xs text-ink-muted">ExcelJS and CSV downloads use the same server-side rows as the print view. Every download is audited.</p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-[0.65rem] uppercase tracking-[0.1em] text-ink-muted">
            <tr><th className="py-2">Dataset</th><th className="py-2">Formats</th></tr>
          </thead>
          <tbody>
            {datasets.map((dataset) => {
              const xlsx = new URLSearchParams(query);
              xlsx.set("dataset", dataset);
              xlsx.set("format", "xlsx");
              const csv = new URLSearchParams(xlsx);
              csv.set("format", "csv");
              return (
                <tr key={dataset} className="border-t border-navy/10">
                  <td className="py-2 font-semibold">{PHASE4_EXPORT_LABELS[dataset]}</td>
                  <td className="py-2">
                    <div className="flex flex-wrap gap-2">
                      <a href={`/api/phase4/exports?${xlsx.toString()}`} className="inline-flex items-center gap-1 text-xs font-bold text-cobalt underline"><Download className="size-3.5" /> XLSX</a>
                      <a href={`/api/phase4/exports?${csv.toString()}`} className="inline-flex items-center gap-1 text-xs font-bold text-cobalt underline"><Download className="size-3.5" /> CSV</a>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm"><Link href={`/print/phase4?${printQuery.toString()}`}><Printer /> Print standings</Link></Button>
      </div>
    </section>
  );
}
