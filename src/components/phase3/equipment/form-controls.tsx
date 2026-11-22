import type { ReactNode, SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const selectClass =
  "mt-2 h-11 w-full rounded-md border border-input bg-white px-3 text-sm text-foreground focus-visible:border-cobalt focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-cobalt/40 disabled:cursor-not-allowed disabled:opacity-50";

export function Field({
  label,
  htmlFor,
  children,
  hint,
}: {
  label: string;
  htmlFor?: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="eyebrow text-ink-muted">
        {label}
      </label>
      {children}
      {hint ? <p className="mt-1 text-[11px] leading-snug text-ink-muted">{hint}</p> : null}
    </div>
  );
}

export function FormSelect({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(selectClass, className)} {...props}>
      {children}
    </select>
  );
}

export const EQUIPMENT_CONDITION_OPTIONS = [
  "excellent",
  "good",
  "fair",
  "poor",
  "unusable",
] as const;
