import ExcelJS from "exceljs";
import type { ExportRow } from "@/lib/data/phase3-reports";

export interface WorkbookOptions {
  sheetName: string;
  title: string;
  subtitle?: string;
  rows: ExportRow[];
}

function columnsFromRows(rows: ExportRow[]): string[] {
  const columns = new Set<string>();
  rows.forEach((row) => Object.keys(row).forEach((key) => columns.add(key)));
  return [...columns].slice(0, 40);
}

export async function buildPhase3Workbook(options: WorkbookOptions): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "VARSITY PE Department";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(options.sheetName.slice(0, 31), {
    views: [{ state: "frozen", ySplit: 4 }],
  });
  const columns = columnsFromRows(options.rows);

  sheet.mergeCells(1, 1, 1, Math.max(columns.length, 1));
  const titleCell = sheet.getCell(1, 1);
  titleCell.value = options.title;
  titleCell.font = { name: "Arial", size: 18, bold: true, color: { argb: "FF101D2C" } };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFC8F169" } };
  titleCell.alignment = { vertical: "middle" };
  sheet.getRow(1).height = 34;

  if (options.subtitle) {
    sheet.mergeCells(2, 1, 2, Math.max(columns.length, 1));
    sheet.getCell(2, 1).value = options.subtitle;
    sheet.getCell(2, 1).font = { name: "Arial", size: 10, color: { argb: "FF5D6875" } };
  }

  sheet.addRow([]);
  const header = sheet.addRow(columns);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF101D2C" } };
  header.alignment = { vertical: "middle" };
  header.height = 24;

  options.rows.forEach((row) => {
    sheet.addRow(columns.map((column) => row[column] ?? null));
  });

  columns.forEach((column, index) => {
    const values = options.rows.map((row) => String(row[column] ?? "").length);
    const width = Math.min(48, Math.max(12, column.length + 2, ...values.slice(0, 200)));
    sheet.getColumn(index + 1).width = width;
  });
  sheet.autoFilter = {
    from: { row: 4, column: 1 },
    to: { row: 4 + options.rows.length, column: Math.max(columns.length, 1) },
  };

  return workbook;
}

export function toCsv(rows: ExportRow[]): string {
  const columns = columnsFromRows(rows);
  const escape = (value: string | number | boolean | null) => {
    const text = value === null || value === undefined ? "" : String(value);
    return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  return [columns.join(","), ...rows.map((row) => columns.map((column) => escape(row[column] ?? null)).join(","))].join("\r\n");
}

export const EXPORT_DATASET_LABELS: Record<string, string> = {
  attendance: "Attendance",
  tasks: "Class tasks",
  visitors: "Visitors",
  rooms: "Room sessions",
  equipment: "Equipment inventory",
  maintenance: "Equipment maintenance",
  feedback: "Feedback requests",
  achievements: "Sports achievements",
  calendar: "PE calendar",
};
