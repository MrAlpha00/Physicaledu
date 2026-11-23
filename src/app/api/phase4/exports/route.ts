import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getMyRoles } from "@/lib/auth/session";
import { buildPhase3Workbook, toCsv } from "@/lib/export/phase3";
import {
  getPhase4ExportRows,
  PHASE4_EXPORT_DATASETS,
  PHASE4_EXPORT_LABELS,
  type Phase4ExportDataset,
} from "@/lib/export/phase4";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const uuid = z.string().uuid();

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
  const rawDataset = query.get("dataset") ?? "registrations";
  if (!(PHASE4_EXPORT_DATASETS as readonly string[]).includes(rawDataset)) {
    return jsonError(`Choose a dataset: ${PHASE4_EXPORT_DATASETS.join(", ")}`, 400);
  }
  const dataset = rawDataset as Phase4ExportDataset;
  const format = query.get("format") ?? "xlsx";
  if (format !== "xlsx" && format !== "csv") {
    return jsonError("Choose a format: xlsx or csv", 400);
  }
  const eventId = query.get("eventId") || undefined;
  const sportId = query.get("sportId") || undefined;
  for (const [name, value] of [["eventId", eventId], ["sportId", sportId]] as const) {
    if (value && !uuid.safeParse(value).success) return jsonError(`${name} must be a UUID.`, 400);
  }

  const rows = await getPhase4ExportRows(dataset, { eventId, sportId });
  const { error: auditError } = await supabase.rpc("admin_log_action", {
    p_action: `phase4_export_${format}`,
    p_target_table: "sports_events",
    p_target_id: eventId ?? sportId ?? dataset,
    p_details: { dataset, format, event_id: eventId ?? null, sport_id: sportId ?? null, row_count: rows.length },
  });
  if (auditError) {
    return jsonError(auditError.message || "The export could not be audited.", 500);
  }

  const filename = `varsity-pe-phase4-${dataset}${eventId ? `-${eventId.slice(0, 8)}` : ""}.${format}`;
  const headers = {
    "Content-Disposition": `attachment; filename="${filename}"`,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  };
  if (format === "csv") {
    return new NextResponse(toCsv(rows), {
      status: 200,
      headers: { ...headers, "Content-Type": "text/csv; charset=utf-8" },
    });
  }

  const workbook = await buildPhase3Workbook({
    sheetName: PHASE4_EXPORT_LABELS[dataset].slice(0, 31),
    title: `VARSITY PE — ${PHASE4_EXPORT_LABELS[dataset]}`,
    subtitle: `${rows.length} record(s) · PE Admin only`,
    rows,
  });
  const buffer = await workbook.xlsx.writeBuffer();
  return new NextResponse(buffer as ArrayBuffer, {
    status: 200,
    headers: {
      ...headers,
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
  });
}
