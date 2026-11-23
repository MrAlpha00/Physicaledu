"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/games", label: "Games" },
  { href: "/game-rules", label: "Game Rules" },
  { href: "/events", label: "Events" },
  { href: "/public-info", label: "Public Info" },
];

export function PublicNavLinks({
  orientation = "horizontal",
  onNavigate,
}: {
  orientation?: "horizontal" | "vertical";
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Public navigation"
      className={cn(
        orientation === "horizontal"
          ? "hidden items-center gap-6 md:flex"
          : "flex flex-col gap-1",
      )}
    >
      {LINKS.map(({ href, label }) => {
        const active = href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            onClick={onNavigate}
            className={cn(
              "text-xs font-bold uppercase tracking-[0.12em] transition-colors",
              orientation === "horizontal"
                ? "border-b-2 px-1 py-5"
                : "border-l-2 px-4 py-3 text-sm",
              active
                ? "border-cobalt text-cobalt"
                : "border-transparent text-navy/70 hover:text-navy",
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
