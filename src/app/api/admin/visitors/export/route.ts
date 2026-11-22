import { NextResponse, type NextRequest } from "next/server";
import ExcelJS from "exceljs";
import { createClient } from "@/lib/supabase/server";
import { getMyRoles } from "@/lib/auth/session";
import { getAdminVisitors } from "@/lib/data/visitors";
import {
  istDateString,
  resolveDateRange,
  VISITOR_DATE_PRESETS,
  type VisitorDatePreset,
} from "@/lib/time/india";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  if (!(await getMyRoles(user.id)).includes("pe_admin")) {
    return NextResponse.json({ error: "PE Admin access required" }, { status: 403 });
  }

  const query = request.nextUrl.searchParams;
  const rawPreset = query.get("preset") ?? "today";
  const preset = (VISITOR_DATE_PRESETS.some((item) => item.value === rawPreset)
    ? rawPreset
    : "today") as VisitorDatePreset;
  const filters = {
    preset,
    from: query.get("from") ?? undefined,
    to: query.get("to") ?? undefined,
    search: query.get("search") ?? undefined,
    purposeId: query.get("purpose") ?? undefined,
    departmentId: query.get("department") ?? undefined,
  };

  const rows = await getAdminVisitors(filters);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "VARSITY College PE Department";
  workbook.created = new Date();
  const range = resolveDateRange(preset, new Date(), {
    from: filters.from,
    to: filters.to,
  });
  const sheet = workbook.addWorksheet("Visitor Register", {
    views: [{ state: "frozen", ySplit: 5 }],
  });

  sheet.mergeCells("A1:H1");
  sheet.getCell("A1").value = "VARSITY COLLEGE — PE DEPARTMENT VISITOR REGISTER";
  sheet.getCell("A1").font = { bold: true, size: 15, color: { argb: "FFF4F2E9" } };
  sheet.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF101D2C" } };
  sheet.getCell("A1").alignment = { vertical: "middle", horizontal: "left" };
  sheet.getRow(1).height = 30;

  sheet.mergeCells("A2:H2");
  sheet.getCell("A2").value = `Period: ${range.label}`;
  sheet.getCell("A2").font = { italic: true, color: { argb: "FF5B6673" } };
  sheet.mergeCells("A3:H3");
  sheet.getCell("A3").value = `Exported: ${istDateString()} (Asia/Kolkata) · ${rows.length} record(s) · PE Admin only`;
  sheet.getCell("A3").font = { italic: true, color: { argb: "FF5B6673" } };

  const headerRow = sheet.getRow(5);
  headerRow.values = [
    "Visited at (IST)",
    "Full name",
    "USN",
    "Department",
    "Academic year",
    "Semester",
    "Purpose",
    "Identity / notes",
  ];
  headerRow.font = { bold: true, color: { argb: "FF101D2C" } };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFC8F169" } };
  headerRow.alignment = { vertical: "middle" };
  headerRow.height = 22;

  rows.forEach((row) => {
    const sheetRow = sheet.addRow([
      new Date(row.visitedAt),
      row.fullName,
      row.usn ?? "",
      row.departmentCode ?? "",
      row.academicYear ?? "",
      row.semester ?? "",
      row.purposeDetail ? `${row.purposeLabel} — ${row.purposeDetail}` : row.purposeLabel,
      `${row.identitySource === "authenticated_profile" ? "Verified account" : "Guest entry"}${row.description ? ` · ${row.description}` : ""}`,
    ]);
    sheetRow.getCell(1).numFmt = "dd mmm yyyy hh:mm";
    sheetRow.alignment = { vertical: "top", wrapText: true };
  });

  sheet.getColumn(1).width = 22;
  sheet.getColumn(2).width = 28;
  sheet.getColumn(3).width = 16;
  sheet.getColumn(4).width = 16;
  sheet.getColumn(5).width = 14;
  sheet.getColumn(6).width = 12;
  sheet.getColumn(7).width = 34;
  sheet.getColumn(8).width = 46;
  sheet.autoFilter = { from: { row: 5, column: 1 }, to: { row: 5 + rows.length, column: 8 } };

  await supabase.rpc("write_audit", {
    p_action: "visitor_export_xlsx",
    p_target_table: "visitor_records",
    p_target_id: preset,
    p_details: { preset, row_count: rows.length, range: range.label },
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `varsity-pe-visitors-${istDateString()}-${preset}.xlsx`;
  return new NextResponse(buffer as ArrayBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
