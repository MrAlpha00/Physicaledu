import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ChallengeForm } from "@/components/games/challenge-form";
import { getGameView } from "@/lib/data/phase5";
import { isGameSlug } from "@/lib/games/catalog";

export const metadata: Metadata = { title: "Send challenge" };

export default async function ChallengeGamePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!isGameSlug(slug)) notFound();
  const game = await getGameView(slug);
  if (!game || !game.isEnabled || !game.challengeEnabled) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link href={`/games/${slug}`} className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-cobalt hover:underline">
        <ArrowLeft className="size-3" /> Back to {game.shortName}
      </Link>
      <div>
        <p className="font-heading text-sm font-bold uppercase tracking-[0.25em] text-lime">Rated match</p>
        <h1 className="mt-2 font-heading text-4xl font-bold uppercase leading-none tracking-tight text-navy md:text-5xl">Challenge for {game.name}</h1>
        <p className="mt-3 text-sm text-ink-muted">Only verified students with challenges enabled can be invited. Results update the {game.name} rating only.</p>
      </div>
      <ChallengeForm defaultSlug={slug} />
    </div>
  );
}
