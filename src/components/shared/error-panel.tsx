"use client";

import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { Brand } from "@/components/layout/brand";
import { Button } from "@/components/ui/button";

export function ErrorPanel({
  title = "Something went wrong",
  description = "This screen could not be loaded. Your previous saved work is unaffected.",
  reset,
  homeHref = "/",
}: {
  title?: string;
  description?: string;
  reset?: () => void;
  homeHref?: string;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-chalk">
      <header className="border-b border-navy/10 px-5 py-5 sm:px-8">
        <Brand />
      </header>
      <main className="flex flex-1 items-center justify-center px-5 py-16">
        <div className="w-full max-w-lg border border-navy/10 bg-card p-8 text-center shadow-sm sm:p-12">
          <p className="eyebrow text-coral">VARSITY error</p>
          <h1 className="mt-2 font-heading text-4xl font-bold uppercase tracking-tight text-navy">
            {title}
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-ink-muted">{description}</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            {reset ? (
              <Button onClick={reset} size="lg">
                <RotateCcw className="size-4" aria-hidden />
                Try again
              </Button>
            ) : null}
            <Button asChild variant="outline" size="lg">
              <Link href={homeHref}>Return to VARSITY</Link>
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
