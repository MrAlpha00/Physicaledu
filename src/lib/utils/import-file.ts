import Papa from "papaparse";
import { importRowSchema, type ImportRowInput } from "@/lib/validations/admin";
import type { ImportIssue } from "@/types/domain";

const HEADER_ALIASES: Record<keyof ImportRowInput, string[]> = {
  usn: ["usn"],
  full_name: ["fullname", "name", "studentname"],
  department_code: ["departmentcode", "deptcode", "department"],
  academic_year: ["academicyear", "year"],
  semester: ["semester", "sem"],
  official_email: ["officialemail", "email"],
};

function normaliseHeader(value: string) {
  return value.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

export interface ParsedImport {
  rows: ImportRowInput[];
  issues: ImportIssue[];
  totalDataRows: number;
}

export async function parseDirectoryFile(file: File): Promise<ParsedImport> {
  if (!/\.(csv|txt)$/i.test(file.name)) {
    throw new Error("Choose a CSV file. Export Excel files as CSV UTF-8 first.");
  }
  if (file.size > 2 * 1024 * 1024) {
    throw new Error("Import files must be 2 MB or smaller.");
  }

  const text = await file.text();
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: normaliseHeader,
  });

  const headers = parsed.meta.fields ?? [];
  const missing = (Object.keys(HEADER_ALIASES) as Array<keyof ImportRowInput>).filter(
    (field) => !HEADER_ALIASES[field].some((alias) => headers.includes(alias)),
  );

  if (missing.length > 0) {
    throw new Error(`Missing column(s): ${missing.map((field) => field.replace("_", " ")).join(", ")}.`);
  }

  const rows: ImportRowInput[] = [];
  const issues: ImportIssue[] = [];

  parsed.data.forEach((raw, index) => {
    const rowNumber = index + 2;
    const read = (field: keyof ImportRowInput) => {
      const key = HEADER_ALIASES[field].find((alias) => alias in raw);
      return key ? String(raw[key] ?? "").trim() : "";
    };

    const candidate: ImportRowInput = {
      usn: read("usn"),
      full_name: read("full_name"),
      department_code: read("department_code").toUpperCase(),
      academic_year: read("academic_year"),
      semester: read("semester"),
      official_email: read("official_email"),
    };

    const result = importRowSchema.safeParse(candidate);
    if (result.success) {
      rows.push(result.data);
    } else {
      issues.push({
        row: rowNumber,
        usn: candidate.usn || null,
        message: result.error.issues[0]?.message ?? "Invalid row",
      });
    }
  });

  return { rows, issues, totalDataRows: parsed.data.length };
}
