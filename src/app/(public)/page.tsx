import Link from "next/link";
import {
  ArrowRight,
  ClipboardCheck,
  Fingerprint,
  LayoutDashboard,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const pillars = [
  {
    number: "01",
    title: "One student identity",
    copy: "A single college account links the official student directory to a secure login — no duplicate records, no guesswork.",
    icon: Fingerprint,
  },
  {
    number: "02",
    title: "PE membership, separate",
    copy: "Every student can register. Only students added by the PE department become classroom participants.",
    icon: ClipboardCheck,
  },
  {
    number: "03",
    title: "Built for the department",
    copy: "Departments, official records and membership are managed in one place with role-based access at the database level.",
    icon: LayoutDashboard,
  },
];

export default function HomePage() {
  return (
    <>
      {/* HERO */}
      <section className="relative overflow-hidden bg-navy text-chalk">
        <div className="track-lines absolute inset-0 opacity-60" aria-hidden="true" />
        <div className="scoreboard-grid absolute inset-0 opacity-40" aria-hidden="true" />
        <div className="absolute -right-24 top-1/2 hidden size-[30rem] -translate-y-1/2 rotate-12 border-[24px] border-lime/10 lg:block" aria-hidden="true" />
        <div className="relative mx-auto grid max-w-7xl gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center lg:py-28">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="lime">Phase 1 online</Badge>
              <span className="eyebrow text-chalk/60">College Physical Education Department</span>
            </div>
            <h1 className="mt-7 max-w-3xl text-[clamp(3.5rem,9vw,7.5rem)] font-bold leading-[0.85] text-chalk">
              The department.
              <br />
              <span className="text-lime">Connected.</span>
            </h1>
            <p className="mt-8 max-w-xl text-base leading-relaxed text-chalk/75 sm:text-lg">
              VARSITY is the digital home of college physical education — student
              accounts, official records and PE class membership in one secure,
              purpose-built platform.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Button asChild variant="lime" size="lg">
                <Link href="/register">
                  Register as a student <ArrowRight />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                className="border-chalk/30 bg-transparent text-chalk hover:bg-chalk/10"
              >
                <Link href="/login">Sign in</Link>
              </Button>
            </div>
            <p className="mt-6 text-xs text-chalk/45">
              Eligible college students only · PE classroom access is granted by the PE department
            </p>
          </div>

          <div className="relative border-l-4 border-lime bg-navy-deep/80 p-6 shadow-2xl sm:p-8">
            <div className="flex items-center justify-between border-b border-chalk/15 pb-5">
              <span className="eyebrow text-chalk/50">System board</span>
              <span className="flex items-center gap-2 text-[0.65rem] font-bold uppercase tracking-[0.16em] text-lime">
                <span className="size-2 rounded-full bg-lime" /> Live
              </span>
            </div>
            <div className="divide-y divide-chalk/10">
              {[
                ["Student accounts", "01", "Secure sign-in & profiles"],
                ["Official directory", "02", "Verified college records"],
                ["PE roster", "03", "Department-managed membership"],
              ].map(([label, index, note]) => (
                <div key={index} className="flex items-center justify-between gap-4 py-5">
                  <div>
                    <p className="font-heading text-2xl font-semibold uppercase tracking-wide text-chalk">
                      {label}
                    </p>
                    <p className="mt-1 text-xs text-chalk/50">{note}</p>
                  </div>
                  <span className="font-heading text-4xl font-semibold text-lime/80 tabular-nums">
                    {index}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-2 border-t border-chalk/15 pt-5 text-xs leading-relaxed text-chalk/50">
              A foundation built to grow with the department — classroom, events,
              equipment and more.
            </div>
          </div>
        </div>
      </section>

      {/* PILLARS */}
      <section id="platform" className="border-b border-navy/10 bg-card">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:py-20">
          <div className="flex flex-col gap-4 border-b-2 border-navy pb-8 md:flex-row md:items-end md:justify-between">
            <h2 className="text-4xl font-bold sm:text-5xl">Built around the way PE works</h2>
            <p className="max-w-md text-sm leading-relaxed text-ink-muted">
              Clear separation between being a college student and being a PE class
              participant — reflected in the platform from day one.
            </p>
          </div>
          <div className="grid gap-px bg-border md:grid-cols-3">
            {pillars.map(({ number, title, copy, icon: Icon }) => (
              <div key={number} className="group bg-card p-7 transition-colors hover:bg-lime/10">
                <div className="flex items-start justify-between">
                  <Icon className="size-7 text-cobalt" strokeWidth={1.7} />
                  <span className="font-heading text-3xl font-semibold text-navy/20">{number}</span>
                </div>
                <h3 className="mt-8 text-2xl font-bold">{title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-ink-muted">{copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* STUDENTS */}
      <section id="for-students" className="bg-chalk">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 py-20 sm:px-8 lg:grid-cols-2 lg:items-center lg:py-28">
          <div>
            <p className="eyebrow text-cobalt">For students</p>
            <h2 className="mt-4 text-4xl font-bold leading-[0.95] sm:text-6xl">
              Your record.
              <br />
              Your status.
              <br />
              <span className="text-cobalt">Straight up.</span>
            </h2>
            <p className="mt-6 max-w-lg text-sm leading-relaxed text-ink-muted sm:text-base">
              Register with your USN and college email, see whether your account is
              linked to the official directory, and check your PE membership status —
              all from a dashboard built for real student information.
            </p>
            <Button asChild className="mt-8" size="lg">
              <Link href="/register">
                Create your account <ArrowRight />
              </Link>
            </Button>
          </div>
          <div className="relative">
            <div className="absolute -left-4 top-6 hidden h-full w-full border-l-4 border-t-4 border-cobalt/25 sm:block" aria-hidden="true" />
            <div className="relative border border-navy/15 bg-card p-6 shadow-[8px_8px_0_rgba(53,100,233,0.12)] sm:p-8">
              <div className="flex items-center justify-between border-b border-border pb-5">
                <span className="eyebrow text-ink-muted">Student dashboard</span>
                <UsersRound className="size-5 text-navy" />
              </div>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div className="border-l-4 border-l-cobalt bg-chalk/70 p-4">
                  <p className="eyebrow text-ink-muted">Account status</p>
                  <p className="mt-2 font-heading text-2xl font-bold">Linked or pending</p>
                </div>
                <div className="border-l-4 border-l-lime bg-chalk/70 p-4">
                  <p className="eyebrow text-ink-muted">PE membership</p>
                  <p className="mt-2 font-heading text-2xl font-bold">Shown as it is</p>
                </div>
              </div>
              <p className="mt-6 text-sm leading-relaxed text-ink-muted">
                No invented attendance numbers. No pretend fixtures. If you have not
                been added to the PE roster, the platform says so clearly.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* STAFF */}
      <section id="for-staff" className="bg-navy text-chalk">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 py-20 sm:px-8 lg:grid-cols-2 lg:items-center lg:py-28">
          <div className="order-2 lg:order-1">
            <div className="relative border border-chalk/20 bg-navy-deep/70 p-6 sm:p-8">
              <div className="flex items-center gap-3 border-b border-chalk/15 pb-5">
                <ShieldCheck className="size-6 text-lime" />
                <span className="eyebrow text-lime">Database-level permissions</span>
              </div>
              <ul className="mt-5 divide-y divide-chalk/10">
                {[
                  "Departments configured by the PE office",
                  "Official directory import with row-by-row validation",
                  "PE roster managed by authorised administrators",
                  "Administrative actions recorded in an audit log",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 py-4 text-sm text-chalk/80">
                    <span className="mt-1 size-1.5 shrink-0 rotate-45 bg-coral" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="order-1 lg:order-2">
            <p className="eyebrow text-lime">For PE administration</p>
            <h2 className="mt-4 text-4xl font-bold leading-[0.95] sm:text-6xl">
              Run the roster.
              <br />
              <span className="text-lime">Not the spreadsheet.</span>
            </h2>
            <p className="mt-6 max-w-lg text-sm leading-relaxed text-chalk/70 sm:text-base">
              A dedicated admin workspace with genuine counts and records: registered
              accounts, official students, pending verifications and the active PE
              roster — ready to expand as the department does.
            </p>
            <Button asChild variant="lime" size="lg" className="mt-8">
              <Link href="/login">
                PE staff sign in <ArrowRight />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* CLOSING */}
      <section className="bg-lime text-navy">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-12 sm:px-8 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="eyebrow">Ready when you are</p>
            <h2 className="mt-2 text-3xl font-bold sm:text-4xl">Join the PE department platform.</h2>
          </div>
          <Button asChild size="lg" className="self-start md:self-auto">
            <Link href="/register">Student registration <ArrowRight /></Link>
          </Button>
        </div>
      </section>
    </>
  );
}
