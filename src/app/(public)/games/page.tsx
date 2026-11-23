import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Gamepad2, ShieldCheck, Trophy, Users } from "lucide-react";
import { GameCard } from "@/components/games/game-card";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/session";
import { getPublicGames } from "@/lib/data/phase5";

export const metadata: Metadata = { title: "Games" };
export const dynamic = "force-dynamic";

export default async function GamesPage() {
  const [games, user] = await Promise.all([getPublicGames(), getCurrentUser()]);
  const active = games.filter((game) => game.isEnabled);

  return (
    <div>
      <section className="relative overflow-hidden bg-navy px-5 py-14 text-chalk md:px-10 md:py-20">
        <div className="pointer-events-none absolute -right-20 -top-24 size-96 rounded-full border-[36px] border-lime/10" />
        <div className="pointer-events-none absolute -bottom-32 left-1/4 size-80 rounded-full border-[24px] border-cobalt/20" />
        <div className="relative mx-auto max-w-6xl">
          <p className="font-heading text-sm font-bold uppercase tracking-[0.3em] text-lime">VARSITY arcade</p>
          <h1 className="mt-3 max-w-3xl font-heading text-5xl font-bold uppercase leading-[0.95] tracking-tight md:text-7xl">
            Six games. One campus.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-chalk/75">
            Play instantly as a guest, sharpen your skills in practice, or challenge another verified student in a rated match. Every ranked result is validated on the server.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild variant="lime" size="lg"><Link href="#library">Browse games <ArrowRight className="size-4" /></Link></Button>
            <Button asChild variant="outline" size="lg" className="border-chalk/40 text-chalk hover:border-lime hover:bg-lime/10 hover:text-lime"><Link href="/game-rules">Game rules</Link></Button>
            {user ? (
              <Button asChild variant="ghost" size="lg" className="text-chalk hover:bg-white/10 hover:text-lime"><Link href="/games/dashboard">My game dashboard</Link></Button>
            ) : null}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl space-y-14 px-5 py-14 md:px-8">
        <section id="library" className="scroll-mt-24 space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b-2 border-navy pb-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-cobalt">The lineup</p>
              <h2 className="mt-1 font-heading text-4xl font-bold uppercase tracking-tight text-navy">Pick your game</h2>
            </div>
            <p className="text-sm text-ink-muted">{active.length} of {games.length} games available</p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {games.map((game) => <GameCard key={game.slug} game={game} />)}
          </div>
        </section>

        <section className="grid gap-5 md:grid-cols-3">
          {[
            { icon: Gamepad2, title: "Play as a guest", text: "Enter a name and start instantly. Guest games stay on this device and never touch ratings or student records." },
            { icon: Users, title: "Challenge a student", text: "Verified students can search for opponents, set match options and play in a protected, server-authoritative room." },
            { icon: Trophy, title: "Climb the board", text: "Each game has its own rating and leaderboard. Only completed, unrated-free matches count toward standings." },
          ].map((item) => (
            <div key={item.title} className="border border-navy/10 bg-white p-6">
              <item.icon className="size-7 text-cobalt" />
              <h3 className="mt-4 font-heading text-2xl font-bold uppercase tracking-wide text-navy">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">{item.text}</p>
            </div>
          ))}
        </section>

        <section className="flex flex-col gap-4 border-l-4 border-l-lime bg-lime/15 p-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 size-6 shrink-0 text-navy" />
            <div>
              <h3 className="font-heading text-2xl font-bold uppercase tracking-wide text-navy">Fair play by design</h3>
              <p className="mt-1 max-w-2xl text-sm text-ink-muted">
                Realtime messages only refresh views. The server validates every move, turn, timeout and final score before anything is stored or ranked.
              </p>
            </div>
          </div>
          {!user ? <Button asChild variant="default"><Link href="/login?next=/games/dashboard">Student sign in</Link></Button> : null}
        </section>
      </div>
    </div>
  );
}
