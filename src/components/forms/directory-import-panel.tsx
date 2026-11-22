"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Download,
  FileSpreadsheet,
  LoaderCircle,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { importStudentDirectory } from "@/app/(admin)/admin/students/actions";
import { parseDirectoryFile, type ParsedImport } from "@/lib/utils/import-file";
import { formatDateTime } from "@/lib/utils";
import type { ActionState, ImportBatchSummary, ImportResult } from "@/types/domain";

export function DirectoryImportPanel({
  history,
}: {
  history: ImportBatchSummary[];
}) {
  const router = useRouter();
  const [parsed, setParsed] = useState<ParsedImport | null>(null);
  const [fileName, setFileName] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [notice, setNotice] = useState<ActionState | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);

  async function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setParsed(null);
    setResult(null);
    setNotice(null);
    setParseError(null);
    if (!file) return;

    setFileName(file.name);
    setBusy(true);
    try {
      setParsed(await parseDirectoryFile(file));
    } catch (error) {
      setParseError(error instanceof Error ? error.message : "Could not read this file.");
    } finally {
      setBusy(false);
    }
  }

  async function onConfirm() {
    if (!parsed || parsed.rows.length === 0) return;
    setBusy(true);
    setNotice(null);
    const response = await importStudentDirectory(parsed.rows, fileName);
    setBusy(false);
    setNotice(response.state);
    setResult(response.result);
    if (response.state.status === "success") {
      setParsed(null);
      router.refresh();
    }
  }

  return (
    <div className="space-y-7">
      <div className="grid gap-6 lg:grid-cols-[1fr_0.8fr]">
        <div className="space-y-5">
          <div className="border border-dashed border-navy/30 bg-white/50 p-6">
            <FileSpreadsheet className="size-7 text-cobalt" />
            <h3 className="mt-4 text-xl font-bold">Upload official directory</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">
              Choose a CSV exported from Excel. Records are only written after you
              review the preview and confirm. No login accounts are created.
            </p>
            <Button asChild variant="outline" size="sm" className="mt-4">
              <a href="/templates/student-directory-template.csv" download>
                <Download /> Download import template
              </a>
            </Button>
            <div className="mt-5">
              <Label htmlFor="import-file">CSV file</Label>
              <Input
                id="import-file"
                type="file"
                accept=".csv,.txt,text/csv"
                onChange={onFileChange}
                className="mt-2 h-auto py-2"
              />
            </div>
          </div>

          {parseError ? (
            <p role="alert" className="flex gap-2 border-l-4 border-l-coral bg-coral/10 p-4 text-sm text-[#8b3725]">
              <AlertCircle className="size-4 shrink-0" /> {parseError}
            </p>
          ) : null}

          {notice ? (
            <p
              role="status"
              className={`border-l-4 p-4 text-sm ${
                notice.status === "success"
                  ? "border-l-lime bg-lime/15 text-[#33521b]"
                  : "border-l-coral bg-coral/10 text-[#8b3725]"
              }`}
            >
              {notice.message}
            </p>
          ) : null}

          {result ? (
            <div className="border border-border bg-card p-5 text-sm">
              <h4 className="font-heading text-xl font-bold uppercase">Import summary</h4>
              <div className="mt-3 grid grid-cols-3 gap-3">
                <div><p className="eyebrow text-ink-muted">Total</p><p className="stat-number text-3xl">{result.total_rows}</p></div>
                <div><p className="eyebrow text-ink-muted">Added</p><p className="stat-number text-3xl text-[#5d8b1d]">{result.inserted_rows}</p></div>
                <div><p className="eyebrow text-ink-muted">Skipped</p><p className="stat-number text-3xl text-coral-dark">{result.skipped_rows}</p></div>
              </div>
              {result.errors.length > 0 ? (
                <ul className="mt-4 max-h-40 space-y-1 overflow-y-auto text-xs text-[#8b3725]">
                  {result.errors.map((issue, index) => (
                    <li key={index}>Row {issue.row} ({issue.usn ?? "no USN"}): {issue.message}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="space-y-4">
          <h3 className="font-heading text-xl font-bold uppercase">Recent import history</h3>
          {history.length === 0 ? (
            <p className="border border-dashed border-border p-5 text-sm text-ink-muted">
              No imports recorded yet.
            </p>
          ) : (
            <div className="divide-y divide-border border border-border bg-card">
              {history.map((batch) => (
                <div key={batch.id} className="p-4">
                  <p className="truncate text-sm font-bold">{batch.fileName}</p>
                  <p className="mt-1 text-xs text-ink-muted">{formatDateTime(batch.createdAt)}</p>
                  <p className="mt-2 text-xs font-semibold">
                    {batch.insertedRows} added · {batch.skippedRows} skipped · {batch.totalRows} total
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {parsed ? (
        <div className="border border-navy/15 bg-card">
          <div className="flex flex-col gap-3 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-heading text-2xl font-bold uppercase">Preview before import</h3>
              <p className="mt-1 text-xs text-ink-muted">
                {fileName} · {parsed.totalDataRows} rows · {parsed.rows.length} valid · {parsed.issues.length} invalid
              </p>
            </div>
            <Button onClick={onConfirm} disabled={busy || parsed.rows.length === 0}>
              {busy ? <LoaderCircle className="animate-spin" /> : <Upload />}
              Confirm import of {parsed.rows.length}
            </Button>
          </div>

          {parsed.issues.length > 0 ? (
            <div className="border-b border-border bg-coral/5 p-4">
              <p className="text-xs font-bold text-[#8b3725]">Invalid rows will be skipped:</p>
              <ul className="mt-2 max-h-28 space-y-1 overflow-y-auto text-xs text-[#8b3725]">
                {parsed.issues.map((issue, index) => (
                  <li key={index}>Row {issue.row} ({issue.usn ?? "no USN"}): {issue.message}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Row</TableHead>
                <TableHead>USN</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Dept</TableHead>
                <TableHead>Year / Sem</TableHead>
                <TableHead>Email</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {parsed.rows.slice(0, 8).map((row, index) => (
                <TableRow key={`${row.usn}-${index}`}>
                  <TableCell className="text-xs text-ink-muted">{index + 2}</TableCell>
                  <TableCell className="font-mono text-xs">{row.usn}</TableCell>
                  <TableCell className="text-sm">{row.full_name}</TableCell>
                  <TableCell className="text-sm font-bold">{row.department_code}</TableCell>
                  <TableCell className="text-sm">{row.academic_year} / {row.semester}</TableCell>
                  <TableCell className="text-xs text-ink-muted">{row.official_email || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {parsed.rows.length > 8 ? (
            <p className="border-t border-border p-3 text-xs text-ink-muted">
              Showing first 8 valid rows of {parsed.rows.length}.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
