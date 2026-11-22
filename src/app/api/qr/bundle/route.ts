import { NextResponse } from "next/server";
import JSZip from "jszip";
import { getAdminQrCodes } from "@/lib/data/qr";
import { getSiteUrl } from "@/lib/env/public";
import { buildQrDestination } from "@/lib/qr/qr-config";
import { renderQrPosterPng } from "@/lib/qr/qr-image";
import { istDateString } from "@/lib/time/india";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase() || "qr";
}

export async function GET() {
  const codes = (await getAdminQrCodes()).filter((qr) => qr.is_active);
  if (!codes.length) {
    return NextResponse.json({ error: "No active QR codes to download." }, { status: 404 });
  }
  let siteUrl: string;
  try {
    siteUrl = getSiteUrl();
  } catch {
    return NextResponse.json(
      { error: "QR destination is not configured (NEXT_PUBLIC_SITE_URL)." },
      { status: 503 },
    );
  }

  try {
    const zip = new JSZip();
    for (const qr of codes) {
      const png = await renderQrPosterPng({
        destination: buildQrDestination(siteUrl, qr.destination_path, qr.token),
        title: qr.name,
        theme: qr.theme,
      });
      zip.file(`${safeFilename(qr.name)}-${qr.qr_type}.png`, png);
    }
    const archive = await zip.generateAsync({ type: "uint8array" });
    const body = archive.buffer.slice(
      archive.byteOffset,
      archive.byteOffset + archive.byteLength,
    ) as ArrayBuffer;
    return new NextResponse(body, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="varsity-pe-qr-posters-${istDateString()}.zip"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "QR bundle could not be generated." }, { status: 500 });
  }
}
