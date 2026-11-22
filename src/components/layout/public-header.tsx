import Link from "next/link";
import { Brand } from "@/components/layout/brand";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/session";

export async function PublicHeader() {
  const user = await getCurrentUser();

  return (
    <header className="sticky top-0 z-40 border-b border-navy/10 bg-chalk/95 backdrop-blur">
      <div className="mx-auto flex h-18 max-w-7xl items-center justify-between gap-4 px-5 sm:px-8">
        <Brand />
        <nav className="hidden items-center gap-8 md:flex" aria-label="Main navigation">
          <Link
            href="/#platform"
            className="text-xs font-bold uppercase tracking-[0.14em] text-navy/70 transition-colors hover:text-navy"
          >
            Platform
          </Link>
          <Link
            href="/#for-students"
            className="text-xs font-bold uppercase tracking-[0.14em] text-navy/70 transition-colors hover:text-navy"
          >
            For students
          </Link>
          <Link
            href="/#for-staff"
            className="text-xs font-bold uppercase tracking-[0.14em] text-navy/70 transition-colors hover:text-navy"
          >
            For PE staff
          </Link>
        </nav>
        <div className="flex items-center gap-2 sm:gap-3">
          {user ? (
            <Button asChild size="sm" variant="default">
              <Link href="/dashboard">My dashboard</Link>
            </Button>
          ) : (
            <>
              <Button asChild size="sm" variant="ghost" className="hidden sm:inline-flex">
                <Link href="/login">Sign in</Link>
              </Button>
              <Button asChild size="sm" variant="lime">
                <Link href="/register">Register</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
