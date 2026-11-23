import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REQUIRED_CONFIG = [
  "NEXT_PUBLIC_SITE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
] as const;

/**
 * Basic readiness probe. Reports variable NAMES only — never values, database
 * strings, stack traces or internal diagnostics. Distinct from detailed logs.
 */
export async function GET() {
  const missing = REQUIRED_CONFIG.filter((name) => !process.env[name]);
  const ready = missing.length === 0;

  return NextResponse.json(
    {
      status: ready ? "ok" : "configuration_required",
      service: "varsity",
      timestamp: new Date().toISOString(),
      checks: { configuration: ready ? "ok" : "missing_required" },
      missingConfiguration: missing,
    },
    {
      status: ready ? 200 : 503,
      headers: {
        "Cache-Control": "no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}
