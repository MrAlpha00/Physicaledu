"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { PublicNavLinks } from "@/components/layout/public-nav-links";
import { Button } from "@/components/ui/button";

export function PublicMobileNav({ isAuthenticated }: { isAuthenticated: boolean }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <div className="md:hidden">
      <button
        type="button"
        className="flex size-10 items-center justify-center border border-navy/20 text-navy"
        aria-label={open ? "Close navigation" : "Open navigation"}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? <X className="size-4" /> : <Menu className="size-4" />}
      </button>

      {open ? (
        <div className="absolute inset-x-0 top-full border-b border-navy/10 bg-chalk shadow-xl">
          <div className="mx-auto max-w-7xl px-5 py-4 sm:px-8">
            <PublicNavLinks orientation="vertical" onNavigate={close} />
            <div className="mt-4 flex flex-col gap-2 border-t border-navy/10 pt-4">
              <Button asChild variant="outline" size="sm">
                <Link href={isAuthenticated ? "/dashboard" : "/login"} onClick={close}>
                  {isAuthenticated ? "My dashboard" : "Sign in"}
                </Link>
              </Button>
              {!isAuthenticated ? (
                <Button asChild variant="lime" size="sm">
                  <Link href="/register" onClick={close}>Register</Link>
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
