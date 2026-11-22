import type { Metadata } from "next";
import Link from "next/link";
import { Download, UserRoundCheck } from "lucide-react";
import { getAdminVisitors, getVisitorPurposes } from "@/lib/data/visitors";
import { getDepartmentOptions } from "@/lib/data/admin";
import { EmptyState } from "@/components/shared/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { VisitorAdminTools } from "@/components/visitor/visitor-admin-tools";
import { VisitorCorrectionButton } from "@/components/visitor/visitor-correction-button";
import { VISITOR_DATE_PRESETS, type VisitorDatePreset } from "@/lib/time/india";
import { formatIstDateTime } from "@/lib/time/india";

export const metadata: Metadata = { title: "Visitor register" };

type SearchParams = Promise<{
  preset?: string;
  from?: string;
  to?: string;
  search?: string;
  purpose?: string;
  department?: string;
}>;

export default async function AdminVisitorsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const preset = (VISITOR_DATE_PRESETS.some((item) => item.value === params.preset)
    ? params.preset
    : "today") as VisitorDatePreset;
  const [records, purposes, departments] = await Promise.all([
    getAdminVisitors({
      preset,
      from: params.from,
      to: params.to,
      search: params.search,
      purposeId: params.purpose,
      departmentId: params.department,
    }),
    getVisitorPurposes(),
    getDepartmentOptions(),
  ]);

  const exportQuery = new URLSearchParams({
    preset,
    ...(params.from ? { from: params.from } : {}),
    ...(params.to ? { to: params.to } : {}),
    ...(params.search ? { search: params.search } : {}),
    ...(params.purpose ? { purpose: params.purpose } : {}),
    ...(params.department ? { department: params.department } : {}),
  });

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-4 border-b-2 border-navy pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow text-cobalt">Daily operations / Visitors</p>
          <h1 className="mt-3 text-5xl font-bold leading-none sm:text-6xl">Visitor register</h1>
          <p className="mt-3 text-sm text-ink-muted">
            Full visitor records are visible to PE Admin only. All times are Asia/Kolkata.
          </p>
        </div>
        <a href={`/api/admin/visitors/export?${exportQuery.toString()}`}>
          <Button variant="lime" asChild={false}>
            <Download /> Export .xlsx
          </Button>
        </a>
      </section>

      <form method="get" className="grid gap-3 border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-6">
        <div>
          <label htmlFor="preset" className="eyebrow text-ink-muted">Period</label>
          <select
            id="preset"
            name="preset"
            defaultValue={preset}
            className="mt-2 h-10 w-full border border-input bg-card px-3 text-sm"
          >
            {VISITOR_DATE_PRESETS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="from" className="eyebrow text-ink-muted">From</label>
          <Input id="from" name="from" type="date" defaultValue={params.from ?? ""} className="mt-2" />
        </div>
        <div>
          <label htmlFor="to" className="eyebrow text-ink-muted">To</label>
          <Input id="to" name="to" type="date" defaultValue={params.to ?? ""} className="mt-2" />
        </div>
        <div>
          <label htmlFor="purpose" className="eyebrow text-ink-muted">Purpose</label>
          <select
            id="purpose"
            name="purpose"
            defaultValue={params.purpose ?? ""}
            className="mt-2 h-10 w-full border border-input bg-card px-3 text-sm"
          >
            <option value="">All</option>
            {purposes.map((purpose) => (
              <option key={purpose.id} value={purpose.id}>{purpose.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="department" className="eyebrow text-ink-muted">Department</label>
          <select
            id="department"
            name="department"
            defaultValue={params.department ?? ""}
            className="mt-2 h-10 w-full border border-input bg-card px-3 text-sm"
          >
            <option value="">All</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>{department.code}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="search" className="eyebrow text-ink-muted">Name / USN</label>
          <Input id="search" name="search" defaultValue={params.search ?? ""} className="mt-2" />
        </div>
        <div className="lg:col-span-6">
          <Button type="submit" size="sm">Apply filters</Button>
          <Link href="/admin/visitors" className="ml-3 text-xs font-bold text-cobalt hover:underline">
            Reset
          </Link>
        </div>
      </form>

      <VisitorAdminTools purposes={purposes} />

      {records.length === 0 ? (
        <EmptyState
          icon={UserRoundCheck}
          title="No visitor records"
          description="No entries match the current filters. Visitor submissions appear here immediately."
        />
      ) : (
        <div className="overflow-x-auto border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time (IST)</TableHead>
                <TableHead>Visitor</TableHead>
                <TableHead>USN / Department</TableHead>
                <TableHead>Purpose</TableHead>
                <TableHead>Identity</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead aria-label="Actions" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((record) => (
                <TableRow key={record.id}>
                  <TableCell className="whitespace-nowrap text-xs">{formatIstDateTime(record.visitedAt)}</TableCell>
                  <TableCell className="font-bold">{record.fullName}</TableCell>
                  <TableCell className="text-xs text-ink-muted">
                    {record.usn ?? "—"}
                    {record.departmentCode ? ` · ${record.departmentCode}` : ""}
                    {record.semester ? ` · Sem ${record.semester}` : ""}
                  </TableCell>
                  <TableCell className="text-xs">
                    {record.purposeLabel}
                    {record.purposeDetail ? ` — ${record.purposeDetail}` : ""}
                  </TableCell>
                  <TableCell className="text-xs capitalize">
                    {record.identitySource === "authenticated_profile" ? "Verified account" : "Guest entry"}
                  </TableCell>
                  <TableCell className="max-w-xs text-xs text-ink-muted">{record.description ?? "—"}</TableCell>
                  <TableCell>
                    <VisitorCorrectionButton visitorId={record.id} name={record.fullName} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
