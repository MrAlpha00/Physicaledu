import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, CalendarDays, ClipboardList, Gamepad2, Trophy, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Public information",
  description:
    "Approved public information from the college Physical Education Department: events, rules, calendar, games and the daily visitor register.",
};

const cards = [
  {
    href: "/events",
    title: "Sports events",
    text: "Published annual events, competitions, schedules and results.",
    icon: Trophy,
  },
  {
    href: "/game-rules",
    title: "Published rules",
    text: "Official sports rules approved by the PE Department.",
    icon: ClipboardList,
  },
  {
    href: "/calendar",
    title: "Activity calendar",
    text: "Public PE activities and department notices.",
    icon: CalendarDays,
  },
  {
    href: "/games",
    title: "Play VARSITY",
    text: "Six first-party games with guest play and student challenges.",
    icon: Gamepad2,
  },
  {
    href: "/visitors/today",
    title: "Today's visitors",
    text: "The limited public visitor list for the current day.",
    icon: UsersRound,
  },
];

export default function PublicInfoPage() {
  return (
    <div>
      <section className="border-b-4 border-navy bg-navy px-5 py-14 text-chalk md:px-10">
        <div className="mx-auto max-w-6xl">
          <p className="font-heading text-sm font-bold uppercase tracking-[0.3em] text-lime">Welcome</p>
          <h1 className="mt-3 font-heading text-5xl font-bold uppercase leading-none tracking-tight md:text-6xl">
            Public information
          </h1>
          <p className="mt-5 max-w-2xl text-sm leading-relaxed text-chalk/80">
            Everything on this page is intentionally public. Student records, attendance, payment proofs,
            private match rooms and administrative information are never listed here.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-5 py-12 md:px-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map(({ href, title, text, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="group border border-navy/10 bg-card p-6 transition-all hover:-translate-y-0.5 hover:border-cobalt/40 hover:shadow-lg"
            >
              <Icon className="size-6 text-cobalt" aria-hidden />
              <h2 className="mt-5 flex items-center gap-2 font-heading text-2xl font-bold uppercase text-navy">
                {title}
                <ArrowUpRight className="size-4 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">{text}</p>
            </Link>
          ))}
        </div>

        <section className="mt-12 border-l-4 border-lime bg-chalk p-6 md:p-8">
          <h2 className="font-heading text-3xl font-bold uppercase text-navy">Visiting the department?</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-muted">
            Use the entrance QR code displayed at the PE office to register your visit. Visitors are asked
            only for the details needed for the daily register.
          </p>
          <Button asChild className="mt-6" variant="outline">
            <Link href="/visitors/today">View today&rsquo;s public register</Link>
          </Button>
        </section>
      </div>
    </div>
  );
}
