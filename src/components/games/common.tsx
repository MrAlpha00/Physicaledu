import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { MODE_LABELS, type MatchMode, type PlayerIndex } from "@/lib/games/types";
import { cn } from "@/lib/utils";

export function GameHero({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <section className="relative overflow-hidden bg-navy px-5 py-12 text-chalk md:px-10 md:py-16">
      <div className="pointer-events-none absolute -right-16 -top-20 size-72 rounded-full border-[28px] border-lime/10" />
      <div className="pointer-events-none absolute -bottom-24 left-1/3 size-56 rounded-full border-[18px] border-cobalt/20" />
      <div className="relative mx-auto max-w-6xl">
        <p className="font-heading text-sm font-bold uppercase tracking-[0.3em] text-lime">{eyebrow}</p>
        <h1 className="mt-3 font-heading text-4xl font-bold uppercase leading-none tracking-tight md:text-6xl">{title}</h1>
        {description ? <p className="mt-4 max-w-2xl text-sm leading-relaxed text-chalk/75 md:text-base">{description}</p> : null}
        {children ? <div className="mt-7 flex flex-wrap gap-3">{children}</div> : null}
      </div>
    </section>
  );
}

export function ModeBadge({ mode, className }: { mode: MatchMode; className?: string }) {
  const variant = mode === "ranked" ? "lime" : mode === "practice" ? "cobalt" : "muted";
  return <Badge variant={variant} className={className}>{MODE_LABELS[mode]}</Badge>;
}

export function PlayerStrip({
  names,
  active,
  score,
  ready,
  connected,
  compact = false,
}: {
  names: [string, string];
  active?: PlayerIndex | null;
  score?: [number, number];
  ready?: [boolean, boolean];
  connected?: [boolean, boolean];
  compact?: boolean;
}) {
  return (
    <div className={cn("grid grid-cols-2 gap-2", compact ? "text-xs" : "text-sm")}>
      {([0, 1] as PlayerIndex[]).map((index) => {
        const isActive = active === index;
        return (
          <div
            key={index}
            className={cn(
              "flex min-w-0 items-center justify-between gap-2 border px-3 py-2 transition-colors",
              isActive ? "border-lime bg-lime/15 text-navy" : "border-border bg-white/60 text-ink-muted",
            )}
          >
            <div className="min-w-0">
              <p className="truncate font-heading text-base font-bold uppercase tracking-wide text-navy">
                {names[index]}
              </p>
              <p className="text-[0.65rem] font-bold uppercase tracking-widest text-ink-muted">
                {index === 0 ? "Player 1" : "Player 2"}
                {ready ? ` · ${ready[index] ? "Ready" : "Not ready"}` : ""}
                {connected && !connected[index] ? " · Reconnecting…" : ""}
              </p>
            </div>
            {score ? (
              <span className={cn("font-heading text-2xl font-bold leading-none", isActive ? "text-navy" : "text-ink-muted")}>
                {score[index]}
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export function GameNotice({
  kind = "info",
  title,
  children,
}: {
  kind?: "info" | "warn" | "success" | "danger";
  title?: string;
  children: ReactNode;
}) {
  const palette = {
    info: "border-cobalt/30 bg-cobalt/8 text-cobalt",
    warn: "border-coral/40 bg-coral/10 text-[#9c3f2b]",
    success: "border-lime/60 bg-lime/20 text-[#33521b]",
    danger: "border-coral bg-coral/15 text-coral-dark",
  }[kind];
  return (
    <div className={cn("border-l-4 px-4 py-3 text-sm", palette)}>
      {title ? <p className="font-heading text-base font-bold uppercase tracking-wide">{title}</p> : null}
      <div className="mt-0.5 leading-relaxed">{children}</div>
    </div>
  );
}

export function StatTile({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="border border-border bg-white/70 px-4 py-3">
      <p className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-ink-muted">{label}</p>
      <p className="mt-1 font-heading text-3xl font-bold leading-none text-navy">{value}</p>
      {sub ? <p className="mt-1 text-xs text-ink-muted">{sub}</p> : null}
    </div>
  );
}

export function CountdownOverlay({ seconds }: { seconds: number }) {
  return (
    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-navy/85 text-chalk backdrop-blur-sm">
      <p className="font-heading text-sm font-bold uppercase tracking-[0.3em] text-lime">Get ready</p>
      <p className="font-heading text-7xl font-bold leading-none md:text-9xl">{Math.max(0, seconds)}</p>
      <p className="mt-3 text-sm text-chalk/70">The match starts automatically.</p>
    </div>
  );
}

export function GameResultBanner({
  outcome,
  names,
  onRematch,
  busy,
}: {
  outcome: { kind: "win" | "draw"; winner: number | null; reason: string } | null;
  names: [string, string];
  onRematch?: () => void;
  busy?: boolean;
}) {
  if (!outcome) return null;
  const title = outcome.kind === "draw" ? "Draw" : `${names[outcome.winner ?? 0]} wins`;
  return (
    <div className="border-l-4 border-l-lime bg-lime/20 px-5 py-4">
      <p className="font-heading text-2xl font-bold uppercase tracking-wide text-navy">{title}</p>
      <p className="mt-1 text-sm text-ink-muted">{outcome.reason}</p>
      {onRematch ? (
        <button
          type="button"
          onClick={onRematch}
          disabled={busy}
          className="mt-3 border border-navy bg-navy px-4 py-2 text-xs font-bold uppercase tracking-widest text-chalk transition hover:bg-navy-deep disabled:opacity-50"
        >
          {busy ? "Preparing…" : "Request rematch"}
        </button>
      ) : null}
    </div>
  );
}

export function BoardShell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("relative w-full overflow-hidden border-2 border-navy bg-navy shadow-[6px_6px_0_0_rgba(16,29,44,0.15)]", className)}>
      {children}
    </div>
  );
}
