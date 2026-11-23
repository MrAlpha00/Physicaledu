import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { GuestSetup } from "@/components/games/guest-setup";
import { getGameView } from "@/lib/data/phase5";
import { isGameSlug } from "@/lib/games/catalog";

export const metadata: Metadata = { title: "Guest play" };

export default async function GuestGamePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ mode?: string }>;
}) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  if (!isGameSlug(slug)) notFound();
  const game = await getGameView(slug);
  if (!game || !game.isEnabled || !game.guestEnabled) notFound();
  const initialMode = query.mode === "practice" ? "practice" : "local";

  return (
    <div className="min-h-screen bg-chalk px-5 py-10 md:px-8 md:py-14">
      <div className="mx-auto max-w-6xl space-y-6">
        <Link href={`/games/${slug}`} className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-cobalt hover:underline">
          <ArrowLeft className="size-3" /> Back to {game.shortName}
        </Link>
        <div>
          <p className="font-heading text-sm font-bold uppercase tracking-[0.3em] text-lime">Guest arena</p>
          <h1 className="mt-2 font-heading text-4xl font-bold uppercase leading-none tracking-tight text-navy md:text-6xl">{game.name}</h1>
          <p className="mt-3 max-w-2xl text-sm text-ink-muted md:text-base">{game.description}</p>
        </div>
        <GuestSetup
          slug={slug}
          gameName={game.shortName}
          initialMode={initialMode as "local" | "practice"}
          timeControls={game.chessTimeControls}
        />
      </div>
    </div>
  );
}
