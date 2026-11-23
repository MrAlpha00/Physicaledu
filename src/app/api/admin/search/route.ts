import { NextResponse, type NextRequest } from "next/server";
import { isCurrentUserPeAdmin } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store, max-age=0", "X-Content-Type-Options": "nosniff" };

/**
 * Scoped admin search. The RPC is PE-admin gated at the route and service-role
 * gated in SQL; results are bounded navigation identifiers only. No attendance,
 * visitors, payment proofs, private rooms, notifications or full records are
 * returned or cached.
 */
export async function GET(request: NextRequest) {
  if (!(await isCurrentUserPeAdmin())) {
    return NextResponse.json({ error: "PE Admin access required." }, { status: 403, headers: NO_STORE });
  }

  const q = (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 100);
  if (q.length < 2) {
    return NextResponse.json({ groups: [] }, { headers: NO_STORE });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("phase6_admin_search", { p_query: q });
  if (error) {
    return NextResponse.json(
      { error: "Search is temporarily unavailable." },
      { status: 500, headers: NO_STORE },
    );
  }

  return NextResponse.json({ groups: data ?? [] }, { headers: NO_STORE });
}
