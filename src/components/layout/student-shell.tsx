"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  BookOpenCheck,
  CalendarCheck,
  CalendarDays,
  ClipboardList,
  Gamepad2,
  LayoutDashboard,
  LogOut,
  MessageSquareText,
  Package,
  QrCode,
  Trophy,
  UserRound,
  UsersRound,
} from "lucide-react";
import { Brand } from "@/components/layout/brand";
import { signOutAction } from "@/app/auth/actions";
import { VerificationBadge } from "@/components/shared/status-badge";
import { isPeAdminRole } from "@/lib/permissions/roles";
import type { ProfileRow } from "@/types/domain";
import { cn } from "@/lib/utils";

export function StudentShell({
  profile,
  isPeStudent,
  unreadNotifications = 0,
  children,
}: {
  profile: ProfileRow;
  isPeStudent: boolean;
  unreadNotifications?: number;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isAdmin = isPeAdminRole(profile.roles);
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const links = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    ...(isPeStudent
      ? [
          { href: "/classroom", label: "Classroom", icon: BookOpenCheck },
          { href: "/classroom/attendance", label: "Attendance", icon: CalendarCheck },
        ]
      : []),
    { href: "/tasks", label: "Tasks", icon: BookOpenCheck },
    { href: "/my-events", label: "My events", icon: Trophy },
    { href: "/games/dashboard", label: "Games", icon: Gamepad2 },
    { href: "/organizer", label: "Organiser", icon: ClipboardList },
    { href: "/equipment", label: "Equipment", icon: Package },
    { href: "/calendar", label: "Calendar", icon: CalendarDays },
    { href: "/feedback", label: "Feedback", icon: MessageSquareText },
    { href: "/my-sports-profile", label: "My sport", icon: Trophy },
    { href: "/scan", label: "Scan QR", icon: QrCode },
    { href: "/profile", label: "Profile", icon: UserRound },
  ];

  return (
    <div className="min-h-screen bg-chalk pb-20 lg:pb-0">
      <header className="sticky top-0 z-40 border-b border-navy/10 bg-card/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-5 sm:px-8">
          <div className="flex items-center gap-8">
            <Brand href="/dashboard" compact />
            <nav className="hidden items-center gap-1 md:flex" aria-label="Student navigation">
              {links.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex items-center gap-2 border-b-2 px-3 py-5 text-xs font-bold uppercase tracking-[0.1em] transition-colors",
                    isActive(href)
                      ? "border-cobalt text-cobalt"
                      : "border-transparent text-ink-muted hover:text-navy",
                  )}
                >
                  <Icon className="size-4" />
                  {label}
                </Link>
              ))}
              {isAdmin ? (
                <Link
                  href="/admin/dashboard"
                  className="flex items-center gap-2 border-b-2 border-transparent px-3 py-5 text-xs font-bold uppercase tracking-[0.1em] text-ink-muted transition-colors hover:text-navy"
                >
                  <UsersRound className="size-4" />
                  Admin
                </Link>
              ) : null}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/notifications"
              aria-label={`Notifications${unreadNotifications > 0 ? `, ${unreadNotifications} unread` : ""}`}
              className="relative flex size-9 items-center justify-center border border-navy/15 text-navy transition-colors hover:border-navy hover:bg-navy/5"
            >
              <Bell className="size-4" />
              {unreadNotifications > 0 ? (
                <span className="absolute -right-1.5 -top-1.5 flex min-w-4 items-center justify-center rounded-full bg-coral px-1 text-[0.6rem] font-bold text-white">
                  {unreadNotifications > 9 ? "9+" : unreadNotifications}
                </span>
              ) : null}
            </Link>
            <div className="hidden text-right sm:block">
              <p className="text-xs font-bold text-navy">{profile.fullName}</p>
              <div className="mt-0.5">
                <VerificationBadge status={profile.verificationStatus} />
              </div>
            </div>
            <form action={signOutAction}>
              <button
                type="submit"
                className="flex size-9 items-center justify-center rounded-md border border-navy/15 text-navy transition-colors hover:border-navy hover:bg-navy/5"
                aria-label="Sign out"
                title="Sign out"
              >
                <LogOut className="size-4" />
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-10">{children}</main>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 flex overflow-x-auto border-t border-navy/15 bg-card lg:hidden"
        aria-label="Mobile student navigation"
      >
        {links.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex min-w-[4.5rem] flex-1 flex-col items-center gap-1 px-2 py-3 text-[0.62rem] font-bold uppercase tracking-[0.08em]",
              isActive(href) ? "text-cobalt" : "text-ink-muted",
            )}
          >
            <Icon className="size-5" />
            {label}
          </Link>
        ))}
        {isAdmin ? (
          <Link
            href="/admin/dashboard"
            className="flex min-w-[4.5rem] flex-1 flex-col items-center gap-1 px-2 py-3 text-[0.62rem] font-bold uppercase tracking-[0.08em] text-ink-muted"
          >
            <UsersRound className="size-5" />
            Admin
          </Link>
        ) : null}
      </nav>
    </div>
  );
}
