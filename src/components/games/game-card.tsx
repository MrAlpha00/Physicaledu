import Link from "next/link";
import {
  Crown, Disc3, Grid3X3, Columns3, Goal, CircleDot, Lock, Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { GameView } from "@/lib/data/phase5";

const ICONS: Record<string, LucideIcon> = {
  crown: Crown,
  disc: Disc3,
  grid: Grid3X3,
  columns: Columns3,
  goal: Goal,
  hoop: CircleDot,
};

export function GameCard({ game }: { game: GameView }) {
  const Icon = ICONS[game.icon] ?? Grid3X3;
  const unavailable = !game.isEnabled;
  const href = unavailable ? "#" : `/games/${game.slug}`;

  return (
    <Link
      href={href}
      aria-disabled={unavailable}
      className={`group relative flex h-full flex-col overflow-hidden border border-navy/10 bg-white p-6 shadow-sm transition-all ${
        unavailable ? "cursor-not-allowed opacity-60" : "hover:-translate-y-1 hover:border-navy hover:shadow-lg"
      }`}
    >
      <div className="absolute right-0 top-0 size-24 translate-x-8 -translate-y-8 rounded-full" style={{ background: game.accentSoft }} />
      <div className="relative flex items-start justify-between gap-3">
        <div
          className="flex size-12 shrink-0 items-center justify-center border-2 text-white"
          style={{ borderColor: game.accent, background: game.accent }}
        >
          <Icon className="size-6" />
        </div>
        <div className="flex flex-wrap justify-end gap-1">
          {unavailable ? <Badge variant="muted"><Wrench className="size-3" /> Maintenance</Badge> : <Badge variant="cobalt">{game.category}</Badge>}
          {!game.guestEnabled ? <Badge variant="muted"><Lock className="size-3" /> Students</Badge> : null}
        </div>
      </div>
      <h3 className="relative mt-5 font-heading text-3xl font-bold uppercase leading-none tracking-tight text-navy group-hover:text-cobalt">
        {game.shortName}
      </h3>
      <p className="relative mt-2 text-sm font-semibold text-navy/70">{game.tagline}</p>
      <p className="relative mt-3 line-clamp-3 flex-1 text-sm leading-relaxed text-ink-muted">{game.description}</p>
      <div className="relative mt-5 flex items-center justify-between border-t border-navy/10 pt-4 text-[0.65rem] font-bold uppercase tracking-[0.14em] text-ink-muted">
        <span>{game.players}</span>
        <span className={unavailable ? "" : "text-cobalt"}>{unavailable ? "Unavailable" : "Open game →"}</span>
      </div>
    </Link>
  );
}
