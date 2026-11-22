import type { Metadata } from "next";
import Link from "next/link";
import { Download, Printer, QrCode } from "lucide-react";
import { getQrCodes } from "@/lib/data/qr";
import { QrAdminTools } from "@/components/qr/qr-admin-tools";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";

export const metadata: Metadata = { title: "QR management" };

export default async function QrCodesPage() {
  const codes = await getQrCodes();
  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-4 border-b-2 border-navy pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow text-cobalt">Daily operations / QR</p>
          <h1 className="mt-3 text-5xl font-bold leading-none sm:text-6xl">QR management</h1>
          <p className="mt-3 text-sm text-ink-muted">
            Download, print and rotate the official PE QR posters. Regenerating a code immediately
            invalidates the previous version.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/admin/qr-codes/print">
            <Button variant="outline"><Printer /> Print posters</Button>
          </Link>
          <Link href="/api/qr/bundle" prefetch={false}>
            <Button variant="lime"><Download /> Download all</Button>
          </Link>
        </div>
      </section>

      <div className="border-l-4 border-l-cobalt bg-cobalt/5 p-5 text-sm">
        <p className="font-bold">Display before printing</p>
        <p className="mt-1 text-ink-muted">
          Posters encode the live public site URL. Confirm <code>NEXT_PUBLIC_SITE_URL</code> points
          to the deployed origin before printing for public use. QR modules are always dark on
          white with a clear quiet zone.
        </p>
      </div>

      {codes.length === 0 ? (
        <EmptyState
          icon={QrCode}
          title="No QR codes found"
          description="Apply migration 0002 with its QR seeds to create the official PE QR codes."
        />
      ) : (
        <QrAdminTools codes={codes} />
      )}
    </div>
  );
}
