import Link from "next/link";
import { Brand } from "@/components/layout/brand";
import { Button } from "@/components/ui/button";
import { PublicMobileNav } from "@/components/layout/public-mobile-nav";
import { PublicNavLinks } from "@/components/layout/public-nav-links";
import { getCurrentUser } from "@/lib/auth/session";

export async function PublicHeader() {
  const user = await getCurrentUser();

  return (
    <header className="sticky top-0 z-40 border-b border-navy/10 bg-chalk/95 backdrop-blur">
      <div className="mx-auto flex h-18 max-w-7xl items-center justify-between gap-4 px-5 sm:px-8">
        <Brand />
        <PublicNavLinks />
        <div className="flex items-center gap-2 sm:gap-3">
          {user ? (
            <Button asChild size="sm" variant="default" className="hidden sm:inline-flex">
              <Link href="/dashboard">My dashboard</Link>
            </Button>
          ) : (
            <>
              <Button asChild size="sm" variant="ghost" className="hidden sm:inline-flex">
                <Link href="/login">Sign in</Link>
              </Button>
              <Button asChild size="sm" variant="lime" className="hidden sm:inline-flex">
                <Link href="/register">Register</Link>
              </Button>
            </>
          )}
          <PublicMobileNav isAuthenticated={Boolean(user)} />
        </div>
      </div>
    </header>
  );
}
