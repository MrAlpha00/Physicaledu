import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Brand } from "@/components/layout/brand";
import { Button } from "@/components/ui/button";

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-screen flex-col bg-chalk">
      <header className="border-b border-navy/10 px-5 py-5 sm:px-8">
        <Brand />
      </header>
      <main className="flex flex-1 items-center justify-center px-5 py-16">
        <div className="w-full max-w-lg border-t-4 border-t-coral bg-card p-8 shadow-[8px_8px_0_rgba(16,29,44,0.08)]">
          <ShieldAlert className="size-9 text-coral-dark" />
          <p className="eyebrow mt-6 text-coral-dark">403 · Restricted area</p>
          <h1 className="mt-3 text-4xl font-bold">Admin access required</h1>
          <p className="mt-4 text-sm leading-relaxed text-ink-muted">
            This workspace is reserved for authorised PE administrators. Your account
            does not have the required role. If you believe this is a mistake, contact
            the PE office.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/dashboard">Back to my dashboard</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/">Return home</Link>
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
