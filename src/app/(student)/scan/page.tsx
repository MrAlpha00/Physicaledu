import type { Metadata } from "next";
import { ScanLine } from "lucide-react";
import { QrScanner } from "@/components/qr/qr-scanner";

export const metadata: Metadata = { title: "Scan PE QR" };

export default function ScanPage() {
  return (
    <div className="space-y-8">
      <section className="border-b-2 border-navy pb-5">
        <p className="eyebrow flex items-center gap-2 text-cobalt">
          <ScanLine className="size-3" /> PE QR scanner
        </p>
        <h1 className="mt-3 text-5xl font-bold leading-none sm:text-6xl">Scan a PE code</h1>
        <p className="mt-3 text-sm text-ink-muted">
          Scan the visitor register poster at the PE block entrance, or a room poster to record
          entry and exit. Only VARSITY PE codes are accepted.
        </p>
      </section>
      <QrScanner />
    </div>
  );
}
