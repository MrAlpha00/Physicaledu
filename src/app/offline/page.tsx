import Link from "next/link";
import { WifiOff } from "lucide-react";
import { Brand } from "@/components/layout/brand";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Offline",
  description: "VARSITY is temporarily unavailable while your device is offline.",
  robots: { index: false, follow: false },
};

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col bg-chalk">
      <header className="border-b border-navy/10 px-5 py-5 sm:px-8">
        <Brand />
      </header>
      <main className="flex flex-1 items-center justify-center px-5 py-16">
        <div className="w-full max-w-lg border border-navy/10 bg-card p-8 text-center shadow-sm sm:p-12">
          <div className="mx-auto flex size-14 items-center justify-center bg-navy text-lime">
            <WifiOff className="size-6" aria-hidden />
          </div>
          <p className="eyebrow mt-6 text-cobalt">Connection required</p>
          <h1 className="mt-2 font-heading text-4xl font-bold uppercase tracking-tight text-navy">
            VARSITY is offline
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-ink-muted">
            Live attendance, registrations, room scans, payments, tournaments and matches need an
            internet connection. Nothing you were doing has been queued or submitted twice.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-ink-muted">
            Reconnect and return to continue. This page and the VARSITY app shell remain available
            offline; no private student data is stored on this device by the app shell.
          </p>
          <Button asChild className="mt-8" size="lg">
            <Link href="/">Try again</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
