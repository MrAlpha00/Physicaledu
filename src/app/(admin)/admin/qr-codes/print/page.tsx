import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getQrCodes } from "@/lib/data/qr";

export const metadata: Metadata = { title: "Print QR posters" };

export default async function PrintQrPage() {
  const codes = await getQrCodes();
  const active = codes.filter((code) => code.isActive);
  return (
    <div>
      <div data-no-print className="mx-auto max-w-4xl px-5 py-8">
        <Link
          href="/admin/qr-codes"
          className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.1em] text-ink-muted hover:text-cobalt"
        >
          <ArrowLeft className="size-3" /> QR management
        </Link>
        <h1 className="mt-5 text-4xl font-bold">Print QR posters</h1>
        <p className="mt-3 text-sm text-ink-muted">
          Each poster prints on its own A4 page. Print at 100% scale and keep the white QR margin
          clear. Only current active codes are shown. Use your browser&apos;s print dialog
          (Ctrl/Cmd + P).
        </p>
      </div>

      <div className="mx-auto max-w-5xl px-5 pb-12 print:max-w-none print:px-0 print:pb-0">
        {active.length === 0 ? (
          <p className="border border-dashed border-border p-10 text-center text-sm text-ink-muted">
            No active QR codes to print.
          </p>
        ) : (
          active.map((code) => (
            <section
              key={code.id}
              className="print-page mb-12 border border-border p-4 print:mb-0 print:border-0 print:p-0"
            >
              {/* Poster SVG is generated server-side from the admin-only token. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/qr/${code.id}?format=svg`}
                alt={`${code.name} QR poster`}
                className="print-poster mx-auto w-full max-w-[180mm]"
              />
            </section>
          ))
        )}
      </div>
    </div>
  );
}
