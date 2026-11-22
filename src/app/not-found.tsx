import Link from "next/link";
import { Brand } from "@/components/layout/brand";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col bg-chalk">
      <header className="border-b border-navy/10 px-5 py-5 sm:px-8">
        <Brand />
      </header>
      <main className="flex flex-1 items-center justify-center px-5 py-16 text-center">
        <div>
          <p className="font-heading text-8xl font-bold text-navy/15">404</p>
          <h1 className="mt-2 text-4xl font-bold">Page not found</h1>
          <p className="mt-3 text-sm text-ink-muted">That page is not part of the PE platform.</p>
          <Button asChild className="mt-7">
            <Link href="/">Return home</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
