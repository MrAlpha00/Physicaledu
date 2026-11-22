import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getMyRoles } from "@/lib/auth/session";
import { getExportRows } from "@/lib/data/phase3-reports";
import { buildPhase3Workbook, EXPORT_DATASET_LABELS, toCsv } from "@/lib/export/phase3";
import { exportDatasetSchema, type ExportDataset } from "@/lib/validations/phase3";
import { reportWindowFromSearchParams } from "@/app/(admin)/admin/reports/report-window";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TARGET_TABLES: Record<ExportDataset, string> = {
  attendance: "attendance_records",
  tasks: "task_submissions",
  visitors: "visitor_records",
  rooms: "room_sessions",
  equipment: "equipment_items",
  maintenance: "maintenance_records",
  feedback: "feedback_requests",
  achievements: "sports_achievements",
  calendar: "calendar_events",
};

function jsonError(message: string, status: number) {
  return NextResponse.json(
    { error: message },
    { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } },
  );
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonError("Authentication required", 401);
  if (!(await getMyRoles(user.id)).includes("pe_admin")) {
    return jsonError("PE Admin access required", 403);
  }

  const query = request.nextUrl.searchParams;
  const datasetResult = exportDatasetSchema.safeParse(query.get("dataset") ?? "");
  if (!datasetResult.success) {
    return jsonError(`Choose a dataset: ${exportDatasetSchema.options.join(", ")}`, 400);
  }
  const format = query.get("format");
  if (format !== "xlsx" && format !== "csv") {
    return jsonError("Choose a format: xlsx or csv", 400);
  }

  const dataset = datasetResult.data;
  const reportWindow = reportWindowFromSearchParams(query);
  const rows = await getExportRows(dataset, reportWindow.window.from, reportWindow.window.to);

  // Deliberate export actions must be audited. A failed audit aborts the download.
  const { error: auditError } = await supabase.rpc("admin_log_action", {
    p_action: `phase3_export_${format}`,
    p_target_table: TARGET_TABLES[dataset],
    p_target_id: dataset,
    p_details: {
      dataset,
      format,
      row_count: rows.length,
      from: reportWindow.fromParam,
      to: reportWindow.toParam,
      preset: reportWindow.preset,
    },
  });
  if (auditError) {
    return jsonError(auditError.message || "The export could not be recorded in the audit log.", 500);
  }

  const label = EXPORT_DATASET_LABELS[dataset] ?? dataset;
  const filename = `varsity-pe-${dataset}-${reportWindow.fromParam}-to-${reportWindow.toParam}.${format}`;
  const baseHeaders = {
    "Content-Disposition": `attachment; filename="${filename}"`,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  };

  if (format === "csv") {
    return new NextResponse(toCsv(rows), {
      status: 200,
      headers: {
        ...baseHeaders,
        "Content-Type": "text/csv; charset=utf-8",
      },
    });
  }

  const workbook = await buildPhase3Workbook({
    sheetName: label.slice(0, 31),
    title: `VARSITY PE — ${label}`,
    subtitle: `${reportWindow.label} · ${rows.length} record(s) · PE Admin only`,
    rows,
  });
  const buffer = await workbook.xlsx.writeBuffer();
  return new NextResponse(buffer as ArrayBuffer, {
    status: 200,
    headers: {
      ...baseHeaders,
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
  });
}
