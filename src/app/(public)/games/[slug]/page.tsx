import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, BookOpenText, Gamepad2, Swords, Trophy, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/session";
import { getGameView, getLeaderboard } from "@/lib/data/phase5";
import { GAME_LIST, isGameSlug } from "@/lib/games/catalog";

export function generateStaticParams() {
  return GAME_LIST.map((game) => ({ slug: game.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const game = await getGameView(slug);
  return { title: game ? `${game.name} · VARSITY Games` : "Game" };
}

export default async function GameDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!isGameSlug(slug)) notFound();
  const [game, user] = await Promise.all([getGameView(slug), getCurrentUser()]);
  if (!game) notFound();
  const leaderboard = game.leaderboardVisible && game.isEnabled ? await getLeaderboard(slug, undefined, 5) : [];

  return (
    <div>
      <section className="relative overflow-hidden bg-navy px-5 py-14 text-chalk md:px-10 md:py-20">
        <div className="pointer-events-none absolute -right-24 -top-20 size-80 rounded-full border-[30px] border-lime/10" />
        <div className="relative mx-auto max-w-6xl">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="cobalt">{game.category}</Badge>
            <Badge variant="muted">{game.players}</Badge>
            {!game.isEnabled ? <Badge variant="coral">Maintenance</Badge> : null}
          </div>
          <h1 className="mt-4 font-heading text-5xl font-bold uppercase leading-none tracking-tight md:text-7xl">{game.name}</h1>
          <p className="mt-4 max-w-2xl text-lg font-semibold text-lime">{game.tagline}</p>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-chalk/75 md:text-base">{game.description}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            {game.isEnabled && game.guestEnabled ? (
              <Button asChild variant="lime" size="lg"><Link href={`/games/${slug}/guest`}><Gamepad2 className="size-4" /> Play as guest</Link></Button>
            ) : null}
            {game.isEnabled && game.practiceEnabled ? (
              <Button asChild variant="outline" size="lg" className="border-chalk/40 text-chalk hover:border-lime hover:bg-lime/10 hover:text-lime"><Link href={`/games/${slug}/guest?mode=practice`}>Practice</Link></Button>
            ) : null}
            {user && game.isEnabled && game.challengeEnabled ? (
              <Button asChild variant="cobalt" size="lg"><Link href={`/games/challenge/${slug}`}><Swords className="size-4" /> Challenge a student</Link></Button>
            ) : null}
            {!user ? <Button asChild variant="ghost" size="lg" className="text-chalk hover:bg-white/10 hover:text-lime"><Link href={`/login?next=/games/challenge/${slug}`}>Sign in to compete</Link></Button> : null}
          </div>
          {game.maintenanceMessage ? <p className="mt-5 border-l-4 border-l-coral pl-3 text-sm text-coral">{game.maintenanceMessage}</p> : null}
        </div>
      </section>

      <div className="mx-auto grid max-w-6xl gap-8 px-5 py-12 md:px-8 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <section className="border border-navy/10 bg-white p-6 md:p-8">
            <h2 className="flex items-center gap-2 font-heading text-3xl font-bold uppercase tracking-tight text-navy"><BookOpenText className="size-5 text-cobalt" /> How to play</h2>
            <ol className="mt-5 space-y-3">
              {game.rules.map((rule, index) => (
                <li key={rule} className="flex gap-3 border-b border-navy/8 pb-3 last:border-b-0">
                  <span className="flex size-7 shrink-0 items-center justify-center bg-navy font-heading text-sm font-bold text-lime">{index + 1}</span>
                  <span className="text-sm leading-relaxed text-ink-muted">{rule}</span>
                </li>
              ))}
            </ol>
          </section>
          <section className="border border-navy/10 bg-white p-6 md:p-8">
            <h2 className="font-heading text-3xl font-bold uppercase tracking-tight text-navy">Controls</h2>
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {game.controls.map((control) => (
                <li key={control} className="border-l-2 border-l-lime bg-chalk/50 px-3 py-2 text-sm text-ink-muted">{control}</li>
              ))}
            </ul>
            <p className="mt-4 text-xs font-bold uppercase tracking-widest text-cobalt">{game.matchFormat}</p>
          </section>
        </div>

        <aside className="space-y-5">
          {game.leaderboardVisible ? (
            <section className="border border-navy/10 bg-white p-6">
              <div className="flex items-center justify-between gap-3">
                <h2 className="flex items-center gap-2 font-heading text-2xl font-bold uppercase tracking-wide text-navy"><Trophy className="size-5 text-cobalt" /> Top players</h2>
                <Link href={`/games/${slug}/leaderboard`} className="text-xs font-bold uppercase tracking-widest text-cobalt hover:underline">Full board</Link>
              </div>
              {leaderboard.length ? (
                <ol className="mt-4 space-y-2">
                  {leaderboard.map((entry) => (
                    <li key={entry.userId} className="flex items-center justify-between gap-3 border-b border-navy/8 pb-2 text-sm">
                      <span className="flex min-w-0 items-center gap-2"><span className="font-heading text-xl font-bold text-navy/40">{entry.rank}</span><span className="truncate font-semibold text-navy">{entry.gamingName}</span></span>
                      <span className="font-heading text-xl font-bold text-cobalt">{entry.rating}</span>
                    </li>
                  ))}
                </ol>
              ) : <p className="mt-4 text-sm text-ink-muted">No ranked results yet. The first completed match sets the board.</p>}
            </section>
          ) : null}
          <section className="border border-navy/10 bg-chalk p-6">
            <h2 className="flex items-center gap-2 font-heading text-2xl font-bold uppercase tracking-wide text-navy"><Users className="size-5 text-cobalt" /> Ways to play</h2>
            <ul className="mt-4 space-y-3 text-sm text-ink-muted">
              <li><strong className="text-navy">Local two-player:</strong> share a screen and pass the device.</li>
              <li><strong className="text-navy">Practice:</strong> use the same rules with local state only.</li>
              <li><strong className="text-navy">Rated challenge:</strong> verified students only, with server-authoritative results.</li>
            </ul>
            <div className="mt-5">
              <Button asChild variant="outline" size="sm"><Link href="/games/rules">How to play <ArrowRight className="size-3" /></Link></Button>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
