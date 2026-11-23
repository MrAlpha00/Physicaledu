import type { Metadata } from "next";
import Link from "next/link";
import { Flag, SlidersHorizontal, Trophy } from "lucide-react";
import { AdminGameEditor } from "@/components/games/admin-game-editor";
import { requirePeAdmin } from "@/lib/auth/session";
import { getAdminCatalog } from "@/lib/data/phase5";

export const metadata: Metadata = { title: "Game management" };

export default async function AdminGamesPage() {
  await requirePeAdmin();
  const catalog = await getAdminCatalog();

  return (
    <div className="space-y-8">
      <section className="border-b-4 border-navy bg-navy px-6 py-9 text-chalk sm:px-9">
        <p className="font-heading text-sm font-bold uppercase tracking-[0.3em] text-lime">Admin / Games</p>
        <h1 className="mt-3 font-heading text-5xl font-bold uppercase leading-none tracking-tight md:text-6xl">Game management</h1>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-chalk/75">
          Configure the six official games, their defaults, seasons and availability. Changes to catalog text appear on public pages immediately.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/admin/games/moderation" className="inline-flex items-center gap-2 border border-chalk/40 px-4 py-2 text-xs font-bold uppercase tracking-widest hover:border-lime hover:text-lime"><Flag className="size-4" /> Reports & moderation</Link>
          <Link href="/admin/games/ratings" className="inline-flex items-center gap-2 border border-chalk/40 px-4 py-2 text-xs font-bold uppercase tracking-widest hover:border-lime hover:text-lime"><Trophy className="size-4" /> Rating adjustments</Link>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2 border-b-2 border-navy pb-2">
          <SlidersHorizontal className="size-5 text-cobalt" />
          <h2 className="font-heading text-3xl font-bold uppercase tracking-tight text-navy">Catalog & settings</h2>
          <span className="text-xs text-ink-muted">({catalog.length} games)</span>
        </div>
        {catalog.length ? catalog.map(({ game, settings }) => (
          <AdminGameEditor key={game.slug} game={game} settings={settings} />
        )) : (
          <p className="border border-dashed border-navy/20 bg-white px-5 py-10 text-center text-sm text-ink-muted">
            No catalog rows are present yet. Apply the Phase 5 migration to seed the six games.
          </p>
        )}
      </section>
    </div>
  );
}
