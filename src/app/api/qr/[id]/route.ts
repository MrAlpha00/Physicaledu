import { NextResponse, type NextRequest } from "next/server";
import { getSiteUrl } from "@/lib/env/public";
import { getAdminQrCode } from "@/lib/data/qr";
import { buildQrDestination } from "@/lib/qr/qr-config";
import { renderQrPosterPng, renderQrPosterSvg } from "@/lib/qr/qr-image";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase() || "qr";
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const qr = await getAdminQrCode((await params).id);
  if (!qr) {
    return NextResponse.json({ error: "QR code not found" }, { status: 404 });
  }

  const format = request.nextUrl.searchParams.get("format") === "png" ? "png" : "svg";
  let siteUrl: string;
  try {
    siteUrl = getSiteUrl();
  } catch {
    return NextResponse.json(
      { error: "QR destination is not configured (NEXT_PUBLIC_SITE_URL)." },
      { status: 503 },
    );
  }
  const destination = buildQrDestination(siteUrl, qr.destination_path, qr.token);
  const options = { destination, title: qr.name, theme: qr.theme };
  const filename = `${safeFilename(qr.name)}-${qr.qr_type}.${format}`;

  try {
    if (format === "png") {
      const png = await renderQrPosterPng(options);
      return new NextResponse(new Uint8Array(png), {
        headers: {
          "Content-Type": "image/png",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
    return new NextResponse(renderQrPosterSvg(options), {
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "QR poster could not be generated." }, { status: 500 });
  }
}
