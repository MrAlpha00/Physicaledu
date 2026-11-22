import Link from "next/link";
import { cn } from "@/lib/utils";

export function Brand({
  inverse = false,
  href = "/",
  compact = false,
  className,
}: {
  inverse?: boolean;
  href?: string;
  compact?: boolean;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group inline-flex items-center gap-3 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cobalt",
        className,
      )}
      aria-label="VARSITY — Physical Education Department platform"
    >
      <span
        className={cn(
          "relative flex size-9 shrink-0 items-center justify-center overflow-hidden border-2",
          inverse ? "border-lime" : "border-navy",
        )}
        aria-hidden="true"
      >
        <span
          className={cn(
            "absolute inset-y-0 left-1 w-[3px] -skew-x-12",
            inverse ? "bg-lime" : "bg-coral",
          )}
        />
        <span
          className={cn(
            "absolute inset-y-0 left-3 w-[3px] -skew-x-12",
            inverse ? "bg-lime/70" : "bg-cobalt",
          )}
        />
      </span>
      <span className="flex flex-col leading-none">
        <span
          className={cn(
            "font-heading text-2xl font-bold leading-none tracking-[0.02em]",
            inverse ? "text-chalk" : "text-navy",
          )}
        >
          VARSITY
        </span>
        {!compact ? (
          <span
            className={cn(
              "mt-1 text-[0.58rem] font-bold uppercase tracking-[0.2em]",
              inverse ? "text-lime" : "text-ink-muted",
            )}
          >
            PE Department
          </span>
        ) : null}
      </span>
    </Link>
  );
}
