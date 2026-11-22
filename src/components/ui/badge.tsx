import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-sm border px-2.5 py-1 text-[0.65rem] font-extrabold uppercase tracking-[0.12em]",
  {
    variants: {
      variant: {
        default: "border-navy/20 bg-navy/5 text-navy",
        lime: "border-[#a9cf55] bg-lime/45 text-[#33521b]",
        cobalt: "border-cobalt/25 bg-cobalt/10 text-cobalt",
        coral: "border-coral/40 bg-coral/15 text-[#9c3f2b]",
        muted: "border-border bg-muted/60 text-ink-muted",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
