import type { Metadata } from "next";
import Link from "next/link";
import { BookOpenText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GAME_LIST } from "@/lib/games/catalog";

export const metadata: Metadata = { title: "Game rules" };

export default function GamesRulesPage() {
  return (
    <div>
      <section className="border-b-4 border-navy bg-chalk px-5 py-12 md:px-10">
        <div className="mx-auto max-w-6xl">
          <p className="font-heading text-sm font-bold uppercase tracking-[0.3em] text-cobalt">Know before you play</p>
          <h1 className="mt-3 font-heading text-5xl font-bold uppercase leading-none tracking-tight text-navy md:text-6xl">Game rules</h1>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-ink-muted">
            The official VARSITY rules for all six games. Administrators can revise published instructions without changing the underlying engines.
          </p>
        </div>
      </section>
      <div className="mx-auto max-w-6xl space-y-5 px-5 py-12 md:px-8">
        {GAME_LIST.map((game) => (
          <section key={game.slug} className="border border-navy/10 bg-white p-6 md:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="font-heading text-3xl font-bold uppercase tracking-tight text-navy">{game.name}</h2>
                <p className="mt-1 text-xs font-bold uppercase tracking-widest text-cobalt">{game.category} · {game.players}</p>
              </div>
              <Button asChild variant="outline" size="sm"><Link href={`/games/${game.slug}`}>Open game</Link></Button>
            </div>
            <div className="mt-5 grid gap-6 md:grid-cols-2">
              <div>
                <h3 className="flex items-center gap-2 font-heading text-lg font-bold uppercase tracking-wide text-navy"><BookOpenText className="size-4" /> Rules</h3>
                <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-ink-muted">
                  {game.rules.map((rule) => <li key={rule}>{rule}</li>)}
                </ul>
              </div>
              <div>
                <h3 className="font-heading text-lg font-bold uppercase tracking-wide text-navy">Controls & format</h3>
                <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-ink-muted">
                  {game.controls.map((control) => <li key={control}>{control}</li>)}
                </ul>
                <p className="mt-3 border-l-2 border-l-lime pl-3 text-sm text-ink-muted">{game.matchFormat}</p>
              </div>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
