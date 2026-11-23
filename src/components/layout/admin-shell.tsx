"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpenCheck,
  ChevronDown,
  ClipboardList,
  DoorOpen,
  Gamepad2,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  QrCode,
  Trophy,
  UserRoundCheck,
  UsersRound,
  Wrench,
  X,
} from "lucide-react";
import { Brand } from "@/components/layout/brand";
import { signOutAction } from "@/app/auth/actions";
import { cn, initials } from "@/lib/utils";

const navigation = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  {
    label: "Students",
    icon: UsersRound,
    children: [
      { href: "/admin/students", label: "All students" },
      { href: "/admin/pe-roster", label: "PE Roster" },
    ],
  },
  { href: "/admin/departments", label: "Departments", icon: GraduationCap },
  {
    label: "Classroom",
    icon: BookOpenCheck,
    children: [
      { href: "/admin/classroom/attendance", label: "Attendance" },
      { href: "/admin/classroom/tasks", label: "Tasks" },
    ],
  },
  { href: "/admin/visitors", label: "Visitor Register", icon: UserRoundCheck },
  {
    label: "Room Monitoring",
    icon: DoorOpen,
    children: [
      { href: "/admin/rooms", label: "Live occupancy" },
      { href: "/admin/rooms/config", label: "Room configuration" },
    ],
  },
  {
    label: "Department (Phase 3)",
    icon: Wrench,
    children: [
      { href: "/admin/equipment", label: "Equipment & maintenance" },
      { href: "/admin/calendar", label: "PE calendar" },
      { href: "/admin/feedback", label: "Student feedback" },
      { href: "/admin/game-rules", label: "Game rules CMS" },
      { href: "/admin/sports-profiles", label: "Sports profiles" },
      { href: "/admin/reports", label: "Reports & exports" },
    ],
  },
  {
    label: "Sports (Phase 4)",
    icon: Trophy,
    children: [
      { href: "/admin/events/dashboard", label: "Events dashboard" },
      { href: "/admin/events", label: "Events & competitions" },
    ],
  },
  {
    label: "Games (Phase 5)",
    icon: Gamepad2,
    children: [
      { href: "/admin/games", label: "Game management" },
      { href: "/admin/games/moderation", label: "Reports & moderation" },
      { href: "/admin/games/ratings", label: "Rating adjustments" },
    ],
  },
  {
    label: "Communications",
    icon: Megaphone,
    children: [
      { href: "/admin/announcements", label: "Announcements" },
      { href: "/admin/notifications", label: "Notifications & email" },
    ],
  },
  { href: "/admin/qr-codes", label: "QR Manager", icon: QrCode },
];

export function AdminShell({
  userName,
  children,
}: {
  userName: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  const sidebarContent = (
    <div className="flex h-full flex-col">
      <div className="border-b border-chalk/15 px-6 py-6">
        <Brand inverse href="/admin/dashboard" />
        <p className="eyebrow mt-5 text-chalk/45">Administration</p>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-5" aria-label="Admin navigation">
        {navigation.map((item) =>
          "children" in item && item.children ? (
            <div key={item.label}>
              <p className="flex items-center gap-3 px-3 py-3 text-[0.68rem] font-extrabold uppercase tracking-[0.16em] text-chalk/45">
                <item.icon className="size-4" />
                {item.label}
              </p>
              <div className="ml-5 border-l border-chalk/15 pl-3">
                {item.children.map((child) => (
                  <Link
                    key={child.href}
                    href={child.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "block border-l-2 px-3 py-2.5 text-sm transition-colors",
                      isActive(child.href)
                        ? "border-l-lime bg-chalk/10 font-bold text-lime"
                        : "border-l-transparent text-chalk/65 hover:text-chalk",
                    )}
                  >
                    {child.label}
                  </Link>
                ))}
              </div>
            </div>
          ) : (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 border-l-2 px-3 py-3 text-sm transition-colors",
                isActive(item.href)
                  ? "border-l-lime bg-chalk/10 font-bold text-lime"
                  : "border-l-transparent text-chalk/65 hover:text-chalk",
              )}
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          ),
        )}
      </nav>
      <div className="border-t border-chalk/15 p-4">
        <Link
          href="/dashboard"
          className="flex items-center justify-between px-2 py-2 text-xs font-bold uppercase tracking-[0.1em] text-chalk/60 hover:text-lime"
        >
          Student view <ChevronDown className="size-3.5 rotate-[-90deg]" />
        </Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-chalk">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 bg-navy lg:block">
        {sidebarContent}
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-navy-deep/70"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-72 bg-navy">{sidebarContent}</aside>
        </div>
      ) : null}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-navy/10 bg-card/95 px-4 backdrop-blur sm:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="flex size-9 items-center justify-center border border-navy/20 lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
            >
              {mobileOpen ? <X className="size-4" /> : <Menu className="size-4" />}
            </button>
            <div className="hidden items-center gap-2 sm:flex">
              <ClipboardList className="size-4 text-cobalt" />
              <span className="eyebrow text-ink-muted">PE Department Operations</span>
            </div>
            <span className="eyebrow text-ink-muted sm:hidden">Admin</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-xs font-bold">{userName}</p>
              <p className="text-[0.65rem] uppercase tracking-[0.1em] text-ink-muted">PE Admin</p>
            </div>
            <div className="flex size-9 items-center justify-center bg-navy font-heading text-sm font-bold text-lime">
              {initials(userName)}
            </div>
            <form action={signOutAction}>
              <button
                type="submit"
                className="flex size-9 items-center justify-center border border-navy/15 text-navy hover:bg-navy/5"
                aria-label="Sign out"
                title="Sign out"
              >
                <LogOut className="size-4" />
              </button>
            </form>
          </div>
        </header>
        <main className="mx-auto max-w-[1500px] px-4 py-7 sm:px-8 sm:py-9">{children}</main>
      </div>
    </div>
  );
}
