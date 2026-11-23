import {
  Phase3Header,
  Phase3Metric,
  Phase3Notice,
} from "@/components/phase3/common";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const Phase4Header = Phase3Header;
export const Phase4Metric = Phase3Metric;
export const Phase4Notice = Phase3Notice;

export function Phase4StatusBadge({
  label,
  tone,
}: {
  label: string;
  tone?: "neutral" | "good" | "warn" | "bad" | "info";
}) {
  const resolved = tone ?? phase4StatusTone(label);
  const variant = resolved === "good" ? "lime" : resolved === "bad" ? "coral" : resolved === "warn" ? "coral" : resolved === "info" ? "cobalt" : "muted";
  return <Badge variant={variant} className="capitalize">{label.replaceAll("_", " ")}</Badge>;
}

export function phase4StatusTone(status: string): "neutral" | "good" | "warn" | "bad" | "info" {
  if (["approved", "verified", "completed", "active", "accepted", "published"].includes(status)) return "good";
  if (["rejected", "cancelled", "withdrawn", "disputed", "failed", "expired"].includes(status)) return "bad";
  if (["pending", "pending_verification", "submitted", "under_review", "result_submitted", "ongoing", "draft"].includes(status)) return "warn";
  if (["registration_open", "ready", "scheduled", "qualified", "waitlisted", "postponed"].includes(status)) return "info";
  return "neutral";
}

export function Phase4Section({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-4", className)}>
      <div className="flex flex-wrap items-end justify-between gap-3 border-b-2 border-navy pb-3">
        <div>
          <h2 className="font-barlow text-2xl uppercase tracking-tight text-navy">{title}</h2>
          {description ? <p className="mt-1 text-xs text-ink-muted">{description}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Phase4Empty({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="border border-dashed border-navy/25 bg-white px-6 py-10 text-center">
      <p className="font-barlow text-xl uppercase text-navy">{title}</p>
      {description ? <p className="mx-auto mt-2 max-w-lg text-sm text-ink-muted">{description}</p> : null}
    </div>
  );
}
