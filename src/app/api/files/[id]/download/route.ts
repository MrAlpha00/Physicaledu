import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createPresignedDownload } from "@/lib/storage/r2-service";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  // RLS allows admins, the uploader, and eligible students with task references.
  const { data: file } = await supabase
    .from("stored_files")
    .select("id, object_key, original_filename, upload_status")
    .eq("id", id)
    .maybeSingle();

  if (!file || file.upload_status !== "confirmed") {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  try {
    const signed = await createPresignedDownload(file.object_key, file.original_filename);
    return NextResponse.redirect(signed.url, { status: 302 });
  } catch {
    return NextResponse.json(
      { error: "File storage is unavailable. Please try again." },
      { status: 503 },
    );
  }
}
