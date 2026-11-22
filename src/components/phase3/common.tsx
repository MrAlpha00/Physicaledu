import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function Phase3Header({
  kicker,
  title,
  description,
  actions,
}: {
  kicker: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="relative overflow-hidden border-b border-navy/10 bg-navy px-6 py-10 text-chalk md:px-10">
      <div className="absolute -right-12 -top-16 size-56 rounded-full border-[28px] border-lime/10" aria-hidden="true" />
      <div className="relative flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div className="max-w-3xl">
          <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-lime">{kicker}</p>
          <h1 className="mt-2 font-barlow text-5xl leading-[0.92] tracking-tight md:text-6xl">{title}</h1>
          {description ? <p className="mt-4 max-w-2xl text-sm leading-relaxed text-chalk/70">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}

export function Phase3Metric({
  label,
  value,
  detail,
  icon: Icon,
  tone = "navy",
}: {
  label: string;
  value: string | number;
  detail?: string;
  icon: LucideIcon;
  tone?: "navy" | "lime" | "cobalt" | "coral";
}) {
  const tones = {
    navy: "border-l-navy text-navy",
    lime: "border-l-lime text-navy",
    cobalt: "border-l-cobalt text-cobalt",
    coral: "border-l-coral text-coral-dark",
  } as const;
  return (
    <article className={cn("border border-navy/10 border-l-4 bg-white px-5 py-4 shadow-sm", tones[tone])}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-ink-muted">{label}</p>
        <Icon className="size-4 opacity-70" />
      </div>
      <p className="mt-2 font-barlow text-4xl leading-none">{value}</p>
      {detail ? <p className="mt-2 text-xs text-ink-muted">{detail}</p> : null}
    </article>
  );
}

export function Phase3Notice({ children, tone = "info" }: { children: React.ReactNode; tone?: "info" | "warning" }) {
  return (
    <div
      className={cn(
        "border px-4 py-3 text-sm",
        tone === "warning"
          ? "border-coral/40 bg-coral/10 text-coral-dark"
          : "border-cobalt/30 bg-cobalt/5 text-navy",
      )}
    >
      {children}
    </div>
  );
}

export function Phase3StatusBadge({ label, tone = "neutral" }: { label: string; tone?: "neutral" | "good" | "warn" | "bad" | "info" }) {
  const variant = tone === "good" ? "lime" : tone === "bad" ? "coral" : tone === "warn" ? "coral" : tone === "info" ? "cobalt" : "muted";
  return <Badge variant={variant} className="capitalize">{label.replaceAll("_", " ")}</Badge>;
}
