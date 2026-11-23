import type { Metadata } from "next";
import Link from "next/link";
import { History } from "lucide-react";
import { GameResultBanner } from "@/components/games/common";
import { requireUser } from "@/lib/auth/session";
import { getRecentResults } from "@/lib/data/phase5";
import { GAME_DEFINITIONS } from "@/lib/games/catalog";
import type { GameSlug } from "@/lib/games/types";

export const metadata: Metadata = { title: "Game history" };

export default async function GamesHistoryPage() {
  const user = await requireUser();
  const results = await getRecentResults(user.id, 50);

  return (
    <div className="space-y-8">
      <section className="border-b-4 border-navy bg-navy px-6 py-9 text-chalk sm:px-9">
        <p className="font-heading text-sm font-bold uppercase tracking-[0.3em] text-lime">Games / History</p>
        <h1 className="mt-3 font-heading text-5xl font-bold uppercase leading-none tracking-tight md:text-6xl">Match history</h1>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-chalk/75">Completed ranked matches only. Guest, practice, cancelled and disputed games are intentionally excluded.</p>
      </section>

      {results.length ? (
        <div className="space-y-4">
          {results.map((match) => {
            const names: [string, string] = [
              match.players.find((player) => player.player_index === 0)?.display_name ?? "Player 1",
              match.players.find((player) => player.player_index === 1)?.display_name ?? "Player 2",
            ];
            const me = match.players.find((player) => player.user_id === user.id);
            return (
              <article key={match.id} className="border border-navy/10 bg-white p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-heading text-2xl font-bold uppercase text-navy">{GAME_DEFINITIONS[match.game_slug as GameSlug]?.name ?? match.game_slug}</p>
                    <p className="text-xs text-ink-muted">{new Date(match.ended_at ?? match.updated_at).toLocaleString()} · Room {match.public_id.slice(0, 8)}</p>
                  </div>
                  <Link href={`/games/match/${match.public_id}`} className="text-xs font-bold uppercase tracking-widest text-cobalt hover:underline">Open room →</Link>
                </div>
                <div className="mt-4"><GameResultBanner outcome={match.outcome as never} names={names} /></div>
                {me ? (
                  <p className="mt-3 text-xs text-ink-muted">
                    Your rating: {me.rating_before ?? "—"} → {me.rating_after ?? "—"} ({me.rating_delta !== null && me.rating_delta !== undefined ? `${me.rating_delta > 0 ? "+" : ""}${me.rating_delta}` : "no change"})
                  </p>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : (
        <div className="border border-dashed border-navy/20 bg-white px-6 py-16 text-center">
          <History className="mx-auto size-8 text-cobalt" />
          <h2 className="mt-4 font-heading text-2xl font-bold uppercase text-navy">No completed matches yet</h2>
          <p className="mt-2 text-sm text-ink-muted">Finish a rated match to see your result and rating change here.</p>
        </div>
      )}
    </div>
  );
}
