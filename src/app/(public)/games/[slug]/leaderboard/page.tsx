import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Trophy } from "lucide-react";
import { LeaderboardTable } from "@/components/games/leaderboard-table";
import { getGameView, getLeaderboard } from "@/lib/data/phase5";
import { isGameSlug } from "@/lib/games/catalog";

export const metadata: Metadata = { title: "Game leaderboard" };
export const dynamic = "force-dynamic";

export default async function GameLeaderboardPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!isGameSlug(slug)) notFound();
  const game = await getGameView(slug);
  if (!game || !game.isEnabled || !game.leaderboardVisible) notFound();
  const entries = await getLeaderboard(slug, undefined, 100);

  return (
    <div className="min-h-screen bg-chalk px-5 py-10 md:px-8 md:py-14">
      <div className="mx-auto max-w-5xl space-y-6">
        <Link href={`/games/${slug}`} className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-cobalt hover:underline">
          <ArrowLeft className="size-3" /> Back to {game.shortName}
        </Link>
        <div>
          <p className="flex items-center gap-2 font-heading text-sm font-bold uppercase tracking-[0.25em] text-cobalt"><Trophy className="size-4" /> Ranked standings</p>
          <h1 className="mt-2 font-heading text-4xl font-bold uppercase leading-none tracking-tight text-navy md:text-6xl">{game.name} leaderboard</h1>
          <p className="mt-3 max-w-2xl text-sm text-ink-muted">
            Only completed rated matches between verified students affect these standings. Guest, practice, cancelled and disputed games are never included.
          </p>
        </div>
        <LeaderboardTable entries={entries} />
      </div>
    </div>
  );
}
