import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { processTimeoutBatch } from "@/lib/games/timeouts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store, max-age=0", "X-Content-Type-Options": "nosniff" };

function authorised(request: NextRequest, secret: string): boolean {
  const header = request.headers.get("authorization") ?? "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7) : "";
  const provided = bearer || request.headers.get("x-cron-secret") || "";
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(secret).digest();
  return timingSafeEqual(a, b) && provided.length > 0;
}

async function run(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET is not configured on the server." },
      { status: 503, headers: NO_STORE },
    );
  }
  if (!authorised(request, secret)) {
    return NextResponse.json(
      { ok: false, error: "Unauthorised." },
      { status: 401, headers: NO_STORE },
    );
  }

  let limit = 25;
  let graceMinutes: number | undefined;
  if (request.method === "POST") {
    try {
      const body = (await request.json()) as { limit?: unknown; graceMinutes?: unknown };
      if (typeof body.limit === "number") limit = body.limit;
      if (typeof body.graceMinutes === "number") graceMinutes = body.graceMinutes;
    } catch {
      // An empty body is valid; scheduler clients may send none.
    }
  } else {
    const queryLimit = Number(request.nextUrl.searchParams.get("limit"));
    const queryGrace = Number(request.nextUrl.searchParams.get("graceMinutes"));
    if (Number.isFinite(queryLimit) && queryLimit > 0) limit = queryLimit;
    if (Number.isFinite(queryGrace) && queryGrace > 0) graceMinutes = queryGrace;
  }

  const result = await processTimeoutBatch(limit, graceMinutes);
  const summary = result.results.reduce<Record<string, number>>((counts, item) => {
    counts[item.status] = (counts[item.status] ?? 0) + 1;
    return counts;
  }, {});

  return NextResponse.json(
    {
      ok: true,
      scanned: result.scanned,
      finalised: summary.finalised ?? 0,
      skipped: summary.skipped ?? 0,
      errors: summary.error ?? 0,
    },
    { status: 200, headers: NO_STORE },
  );
}

export async function GET(request: NextRequest) {
  return run(request);
}

export async function POST(request: NextRequest) {
  return run(request);
}
