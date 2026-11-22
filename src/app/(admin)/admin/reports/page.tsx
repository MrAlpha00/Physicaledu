import type { Metadata } from "next";
import {
  Award,
  CalendarDays,
  ClipboardList,
  Wrench,
} from "lucide-react";
import { requirePeAdmin } from "@/lib/auth/session";
import { getPhase3DashboardMetrics, getPhase3ReportData } from "@/lib/data/phase3-reports";
import { getAdminAchievements } from "@/lib/data/phase3-sports";
import { aggregateReportRows, audienceLabel, percentage } from "@/lib/operations/phase3";
import { VISITOR_DATE_PRESETS } from "@/lib/time/india";
import { Phase3Header, Phase3Metric, Phase3Notice } from "@/components/phase3/common";
import { ReportCharts, type ReportChart } from "@/components/phase3/reports/report-charts";
import { ReportExportLinks } from "@/components/phase3/reports/report-export-links";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { resolveReportWindow } from "./report-window";

export const metadata: Metadata = { title: "Reports & exports" };
export const dynamic = "force-dynamic";

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ preset?: string; from?: string; to?: string }>;
}) {
  await requirePeAdmin();
  const params = await searchParams;
  const reportWindow = resolveReportWindow(params);
  const [report, metrics, achievements] = await Promise.all([
    getPhase3ReportData(reportWindow.window),
    getPhase3DashboardMetrics(),
    getAdminAchievements(),
  ]);

  const verifiedShare = percentage(
    achievements.filter((row) => row.verificationStatus === "verified").length,
    achievements.length,
  );
  const audience = audienceLabel({ audienceType: "active_pe" });

  const charts: ReportChart[] = [
    { key: "attendance", title: "Attendance", rows: report.attendance, accent: "#101d2c" },
    { key: "tasks", title: "Class tasks", rows: report.tasks, accent: "#3564e9" },
    { key: "visitors", title: "Visitors", rows: report.visitors, accent: "#c8f169" },
    { key: "equipment", title: "Equipment inventory", rows: report.equipment, accent: "#3564e9" },
    { key: "maintenance", title: "Maintenance", rows: report.maintenance, accent: "#e4674e" },
    { key: "feedback", title: "Feedback", rows: report.feedback, accent: "#101d2c" },
    { key: "achievements", title: "Achievements by sport", rows: report.achievements, accent: "#c8f169" },
    { key: "calendar", title: "Calendar events", rows: report.calendar, accent: "#3564e9" },
    {
      key: "participation",
      title: "Participation by department",
      rows: report.participationByDepartment,
      accent: "#e4674e",
      layout: "vertical",
    },
  ];

  const topCategories = aggregateReportRows(
    charts.flatMap((chart) =>
      chart.rows.map((row) => ({ label: `${chart.title} · ${row.label}`, value: row.value })),
    ),
  ).slice(0, 6);

  return (
    <div className="space-y-8">
      <Phase3Header
        kicker="PE Admin / Analytics"
        title="Reports & exports"
        description={`Aggregated PE activity for a fixed IST window. Scope: ${audience}. All charts consume the same serialized report data as the exports.`}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Phase3Metric label="Pending achievements" value={metrics.pendingAchievements} detail={`${verifiedShare}% of achievements verified`} icon={Award} tone="lime" />
        <Phase3Metric label="Open maintenance" value={metrics.maintenanceOpen} detail="Records not yet terminal" icon={Wrench} tone="coral" />
        <Phase3Metric label="Upcoming events" value={metrics.upcomingEvents} detail="Published PE calendar" icon={CalendarDays} tone="cobalt" />
        <Phase3Metric label="Pending feedback" value={metrics.pendingFeedback} detail="Requests awaiting action" icon={ClipboardList} tone="navy" />
      </div>

      <form method="get" className="grid gap-4 border border-navy/10 bg-white p-5 shadow-sm sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
        <div>
          <label htmlFor="preset" className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink-muted">Period</label>
          <select
            id="preset"
            name="preset"
            defaultValue={reportWindow.preset}
            className="mt-2 h-11 w-full rounded-md border border-input bg-white px-3 text-sm"
          >
            {VISITOR_DATE_PRESETS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="from" className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink-muted">From (IST)</label>
          <Input id="from" name="from" type="date" defaultValue={reportWindow.fromParam} className="mt-2" />
        </div>
        <div>
          <label htmlFor="to" className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink-muted">To (IST)</label>
          <Input id="to" name="to" type="date" defaultValue={reportWindow.toParam} className="mt-2" />
        </div>
        <Button type="submit" variant="default">Apply date range</Button>
      </form>

      <Phase3Notice>
        Window: <strong>{reportWindow.label}</strong>. Dates are interpreted in Asia/Kolkata and converted to UTC before querying. Empty datasets are shown honestly as zero records.
      </Phase3Notice>

      <ReportCharts charts={charts} />

      <section className="border border-navy/10 bg-white p-6 shadow-sm">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-coral-dark">Cross-dataset view</p>
        <h2 className="mt-1 font-barlow text-3xl tracking-tight text-navy">Largest categories</h2>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {topCategories.map((row) => (
            <li key={row.label} className="flex items-center justify-between gap-3 border-l-4 border-l-cobalt bg-navy/[0.02] px-4 py-3">
              <span className="text-xs font-semibold text-navy">{row.label}</span>
              <span className="font-barlow text-2xl text-cobalt">{row.value}</span>
            </li>
          ))}
        </ul>
      </section>

      <ReportExportLinks from={reportWindow.fromParam} to={reportWindow.toParam} />
    </div>
  );
}
