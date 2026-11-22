"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Phase3ReportRow } from "@/types/domain";

export interface ReportChart {
  key: string;
  title: string;
  rows: Phase3ReportRow[];
  accent: string;
  layout?: "horizontal" | "vertical";
}

const axisStyle = { fontSize: 10, fill: "#5d6875", fontWeight: 600 };

export function ReportCharts({ charts }: { charts: ReportChart[] }) {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {charts.map((chart) => (
        <section key={chart.key} className="border border-navy/10 bg-white p-5 shadow-sm">
          <div className="flex items-baseline justify-between gap-3 border-b border-navy/10 pb-3">
            <h2 className="font-barlow text-2xl tracking-tight text-navy">{chart.title}</h2>
            <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-ink-muted">
              {chart.rows.reduce((sum, row) => sum + row.value, 0)} total
            </span>
          </div>
          {chart.rows.length === 0 ? (
            <p className="py-12 text-center text-sm text-ink-muted">No records in this window.</p>
          ) : (
            <div className="mt-4 h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chart.rows.map((row) => ({ label: row.label, value: row.value }))}
                  layout={chart.layout === "vertical" ? "vertical" : "horizontal"}
                  margin={{ top: 4, right: 12, bottom: 8, left: chart.layout === "vertical" ? 8 : 0 }}
                >
                  <CartesianGrid stroke="#e6e8ec" strokeDasharray="3 3" vertical={false} />
                  {chart.layout === "vertical" ? (
                    <>
                      <XAxis type="number" allowDecimals={false} tick={axisStyle} />
                      <YAxis type="category" dataKey="label" width={110} tick={axisStyle} />
                    </>
                  ) : (
                    <>
                      <XAxis dataKey="label" interval="preserveStartEnd" tick={axisStyle} tickMargin={8} />
                      <YAxis allowDecimals={false} tick={axisStyle} width={34} />
                    </>
                  )}
                  <Tooltip
                    cursor={{ fill: "rgba(53, 100, 233, 0.06)" }}
                    contentStyle={{ border: "1px solid rgba(16,29,44,0.15)", borderRadius: 4, fontSize: 12 }}
                  />
                  <Bar dataKey="value" name="Count" fill={chart.accent} radius={[3, 3, 0, 0]} maxBarSize={42} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          {chart.rows.some((row) => row.detail) ? (
            <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-navy/10 pt-3 text-[11px] text-ink-muted">
              {chart.rows.filter((row) => row.detail).slice(0, 4).map((row) => (
                <li key={row.label}>
                  <strong className="text-navy">{row.label}:</strong> {row.detail}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ))}
    </div>
  );
}
