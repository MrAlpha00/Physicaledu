import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowUpRight,
  BarChart3,
  BellRing,
  BookOpen,
  Building2,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  DoorOpen,
  GraduationCap,
  IdCard,
  Mail,
  MessageSquareText,
  Package,
  QrCode,
  Trophy,
  Timer,
  UserCheck,
  UserRoundCheck,
  UsersRound,
  Wrench,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { VerificationBadge } from "@/components/shared/status-badge";
import {
  getAdminMetrics,
  getDepartmentOptions,
  getRecentRegistrations,
} from "@/lib/data/admin";
import { getPhase2AdminMetrics } from "@/lib/data/phase2-dashboard";
import { getPhase3DashboardMetrics } from "@/lib/data/phase3-reports";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Admin dashboard" };

const quickLinks = [
  {
    href: "/admin/students",
    title: "Student management",
    description: "Registered accounts, verification and the official directory.",
    icon: UsersRound,
  },
  {
    href: "/admin/pe-roster",
    title: "PE Roster",
    description: "Add, remove and reactivate PE classroom participants.",
    icon: ClipboardList,
  },
  {
    href: "/admin/departments",
    title: "Departments",
    description: "Configure the college department list used across the platform.",
    icon: Building2,
  },
  {
    href: "/admin/classroom/attendance",
    title: "PE attendance",
    description: "Run live classroom attendance sessions and review submissions.",
    icon: ClipboardCheck,
  },
  {
    href: "/admin/visitors",
    title: "Visitor register",
    description: "Full PE Block visitor records and genuine .xlsx exports.",
    icon: UserRoundCheck,
  },
  {
    href: "/admin/rooms",
    title: "Room management",
    description: "Live occupancy, forced closures and activity history.",
    icon: DoorOpen,
  },
  {
    href: "/admin/qr-codes",
    title: "QR management",
    description: "Download, print and rotate all official PE QR posters.",
    icon: QrCode,
  },
  {
    href: "/admin/equipment",
    title: "Equipment store",
    description: "Inventory, issue/return ledger, maintenance and equipment QR labels.",
    icon: Package,
  },
  {
    href: "/admin/calendar",
    title: "PE calendar",
    description: "Published events, recurring schedules and audience targeting.",
    icon: CalendarDays,
  },
  {
    href: "/admin/feedback",
    title: "Student feedback",
    description: "Requests, replies, internal notes and resolution tracking.",
    icon: MessageSquareText,
  },
  {
    href: "/admin/game-rules",
    title: "Game rules CMS",
    description: "Publish structured rules and guides for students and guests.",
    icon: BookOpen,
  },
  {
    href: "/admin/sports-profiles",
    title: "Sports achievements",
    description: "Verify student suggestions and record official achievements.",
    icon: Trophy,
  },
  {
    href: "/admin/reports",
    title: "Reports & exports",
    description: "Attendance, equipment, feedback and achievement reporting with real .xlsx exports.",
    icon: BarChart3,
  },
];

export default async function AdminDashboardPage() {
  const [metrics, recent, departments, phase2, phase3Result] = await Promise.all([
    getAdminMetrics(),
    getRecentRegistrations(),
    getDepartmentOptions(),
    getPhase2AdminMetrics(),
    getPhase3DashboardMetrics().then(
      (value) => ({ value }),
      () => ({ value: null }),
    ),
  ]);
  const phase3 = phase3Result.value;

  const cards = [
    { label: "Registered accounts", value: metrics.registeredAccounts, icon: UsersRound, accent: "bg-cobalt" },
    { label: "Official directory", value: metrics.directoryRecords, icon: IdCard, accent: "bg-navy" },
    { label: "Active PE students", value: metrics.peStudents, icon: GraduationCap, accent: "bg-[#8fb63c]" },
    { label: "Pending verification", value: metrics.pendingVerifications, icon: Timer, accent: "bg-coral" },
    { label: "Active departments", value: metrics.activeDepartments, icon: Building2, accent: "bg-navy" },
  ];

  return (
    <div className="space-y-9">
      <section className="flex flex-col gap-4 border-b-2 border-navy pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="eyebrow text-cobalt">PE administration / Overview</p>
          <h1 className="mt-3 text-5xl font-bold leading-none sm:text-6xl">Department board</h1>
          <p className="mt-3 text-sm text-ink-muted">
            All figures below are live database counts. No placeholder data.
          </p>
        </div>
        <Badge variant="lime" className="self-start">
          <span className="size-1.5 rounded-full bg-[#5d8b1d]" /> Live records
        </Badge>
      </section>

      <section aria-label="Key metrics">
        <div className="grid gap-px border border-border bg-border sm:grid-cols-2 xl:grid-cols-5">
          {cards.map(({ label, value, icon: Icon, accent }) => (
            <div key={label} className="relative bg-card p-5">
              <div className={`absolute inset-x-0 top-0 h-1 ${accent}`} />
              <div className="flex items-start justify-between">
                <span className="eyebrow text-ink-muted">{label}</span>
                <Icon className="size-4 text-ink-muted" />
              </div>
              <p className="stat-number mt-4 text-5xl">{value}</p>
              <p className="mt-2 text-[0.65rem] uppercase tracking-[0.12em] text-ink-muted">
                Current total
              </p>
            </div>
          ))}
        </div>
      </section>

      <section aria-label="Daily PE operations">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b-2 border-navy pb-3">
          <div>
            <p className="eyebrow text-cobalt">Phase 2 · Daily operations</p>
            <h2 className="mt-2 text-2xl font-bold">Today on campus</h2>
          </div>
          <p className="text-xs text-ink-muted">
            {phase2.openSessionTitle ? `Open session: ${phase2.openSessionTitle}` : "No open attendance session"}
          </p>
        </div>
        <div className="grid gap-px border border-border bg-border sm:grid-cols-2 xl:grid-cols-5">
          {[
            { label: "Present now", value: phase2.presentCount, href: "/admin/classroom/attendance" },
            { label: "Pending approvals", value: phase2.pendingApprovals, href: "/admin/classroom/attendance" },
            { label: "Not submitted", value: phase2.notSubmittedCount, href: "/admin/classroom/attendance" },
            { label: "Today's visitors", value: phase2.todayVisitors, href: "/admin/visitors" },
            { label: "Submissions to review", value: phase2.pendingTaskSubmissions, href: "/admin/classroom/tasks" },
          ].map((item) => (
            <Link key={item.label} href={item.href} className="bg-card p-5 transition-colors hover:bg-lime/20">
              <span className="eyebrow text-ink-muted">{item.label}</span>
              <p className="stat-number mt-3 text-4xl">{item.value}</p>
              <p className="mt-2 text-[0.65rem] uppercase tracking-[0.12em] text-cobalt">Open board →</p>
            </Link>
          ))}
        </div>
        <div className="mt-px grid gap-px border border-border bg-border sm:grid-cols-3">
          {[
            { label: "Playing room occupancy", value: phase2.playingOccupancy },
            { label: "Gym occupancy", value: phase2.gymOccupancy },
            { label: "Mental games occupancy", value: phase2.mentalOccupancy },
          ].map((item) => (
            <div key={item.label} className="bg-card p-5">
              <span className="eyebrow text-ink-muted">{item.label}</span>
              <p className="stat-number mt-3 text-4xl">{item.value}</p>
            </div>
          ))}
        </div>
      </section>

      {phase3 ? (
        <section aria-label="Phase 3 department metrics">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b-2 border-navy pb-3">
            <div>
              <p className="eyebrow text-cobalt">Phase 3 · Department management</p>
              <h2 className="mt-2 text-2xl font-bold">Equipment, calendar & communications</h2>
            </div>
            <Link href="/admin/reports" className="eyebrow text-cobalt hover:underline">
              Full reports <ArrowUpRight className="inline size-3" />
            </Link>
          </div>
          <div className="grid gap-px border border-border bg-border sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: "Equipment items", value: phase3.equipmentItems, href: "/admin/equipment", icon: Package },
              { label: "Currently issued", value: phase3.equipmentIssued, href: "/admin/equipment/transactions", icon: Wrench },
              { label: "Overdue returns", value: phase3.equipmentOverdue, href: "/admin/equipment/transactions", icon: Timer },
              { label: "Open maintenance", value: phase3.maintenanceOpen, href: "/admin/equipment/maintenance", icon: Wrench },
              { label: "Upcoming events", value: phase3.upcomingEvents, href: "/admin/calendar", icon: CalendarDays },
              { label: "Open feedback", value: phase3.pendingFeedback, href: "/admin/feedback", icon: MessageSquareText },
              { label: "Pending achievements", value: phase3.pendingAchievements, href: "/admin/sports-profiles", icon: Trophy },
              { label: "Unread notifications", value: phase3.unreadNotifications, href: "/admin/notifications", icon: BellRing },
            ].map((item) => (
              <Link key={item.label} href={item.href} className="bg-card p-5 transition-colors hover:bg-lime/20">
                <div className="flex items-start justify-between">
                  <span className="eyebrow text-ink-muted">{item.label}</span>
                  <item.icon className="size-4 text-ink-muted" />
                </div>
                <p className="stat-number mt-3 text-4xl">{item.value}</p>
                <p className="mt-2 text-[0.65rem] uppercase tracking-[0.12em] text-cobalt">Open board →</p>
              </Link>
            ))}
          </div>
          <div className="mt-px grid gap-px border border-border bg-border sm:grid-cols-3">
            {[
              { label: "Game-rule drafts", value: phase3.draftGameRules },
              { label: "Email accepted today", value: phase3.emailAcceptedToday },
              { label: "Email delivered (webhook)", value: phase3.emailDeliveredCount },
            ].map((item) => (
              <div key={item.label} className="bg-card p-5">
                <span className="eyebrow text-ink-muted">{item.label}</span>
                <p className="stat-number mt-3 text-4xl">{item.value}</p>
              </div>
            ))}
          </div>
          <p className="mt-2 flex items-center gap-2 text-[0.65rem] uppercase tracking-[0.1em] text-ink-muted">
            <Mail className="size-3" /> Accepted by Resend is not the same as delivered; delivery is recorded by signed webhook.
          </p>
        </section>
      ) : null}

      <div className="grid gap-8 xl:grid-cols-[1.4fr_0.6fr]">
        <section>
          <div className="mb-4 flex items-center justify-between border-b-2 border-navy pb-3">
            <h2 className="text-2xl font-bold">Recent registrations</h2>
            <Link href="/admin/students" className="eyebrow text-cobalt hover:underline">
              View all <ArrowUpRight className="inline size-3" />
            </Link>
          </div>
          {recent.length === 0 ? (
            <EmptyState
              icon={UserCheck}
              title="No student accounts yet"
              description="When students register, their accounts and verification status will appear here."
            />
          ) : (
            <div className="border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>USN</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Registered</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recent.map((student) => (
                    <TableRow key={student.id}>
                      <TableCell>
                        <p className="font-bold">{student.fullName}</p>
                        <p className="text-xs text-ink-muted">{student.email}</p>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{student.usn}</TableCell>
                      <TableCell>
                        <VerificationBadge status={student.verificationStatus} />
                      </TableCell>
                      <TableCell className="text-xs text-ink-muted">
                        {formatDate(student.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </section>

        <section>
          <div className="mb-4 flex items-center justify-between border-b-2 border-navy pb-3">
            <h2 className="text-2xl font-bold">Quick access</h2>
          </div>
          <div className="space-y-3">
            {quickLinks.map(({ href, title, description, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="group flex items-start gap-4 border border-border bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-cobalt/50 hover:shadow-md"
              >
                <div className="flex size-10 shrink-0 items-center justify-center bg-navy/5 text-navy group-hover:bg-cobalt group-hover:text-white">
                  <Icon className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-heading text-xl font-semibold uppercase leading-none">{title}</p>
                  <p className="mt-2 text-xs leading-relaxed text-ink-muted">{description}</p>
                </div>
                <ArrowUpRight className="size-4 shrink-0 text-ink-muted group-hover:text-cobalt" />
              </Link>
            ))}
          </div>

          {departments.length === 0 ? (
            <div className="mt-5 border-l-4 border-l-coral bg-coral/10 p-4">
              <p className="text-sm font-bold text-[#8b3725]">Setup needed</p>
              <p className="mt-1 text-xs leading-relaxed text-[#8b3725]/80">
                No departments are configured yet. Students cannot register until at
                least one department is active.
              </p>
              <Link href="/admin/departments" className="mt-3 inline-block text-xs font-bold text-cobalt underline">
                Configure departments
              </Link>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
