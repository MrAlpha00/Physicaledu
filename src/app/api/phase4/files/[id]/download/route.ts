import { NextResponse, type NextRequest } from "next/server";
import { createPhase4DownloadUrl } from "@/lib/actions/phase4-files";

export const dynamic = "force-dynamic";

/** All Phase 4 files, including private payment proofs, pass through RLS-aware RPC authorization. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const result = await createPhase4DownloadUrl(id);
  if (result.status !== "success" || !result.url) {
    return NextResponse.json(
      { error: result.message || "Download not available." },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }
  return NextResponse.redirect(result.url, { status: 302 });
}
