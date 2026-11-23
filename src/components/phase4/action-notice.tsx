"use client";

import type { ActionState } from "@/types/domain";
import { cn } from "@/lib/utils";

export function Phase4ActionNotice({
  state,
  className,
}: {
  state: ActionState | null;
  className?: string;
}) {
  if (!state || !state.message) return null;
  return (
    <div
      role={state.status === "error" ? "alert" : "status"}
      className={cn(
        "border px-4 py-3 text-sm font-semibold",
        state.status === "error"
          ? "border-coral/40 bg-coral/10 text-coral-dark"
          : "border-lime/60 bg-lime/15 text-navy",
        className,
      )}
    >
      {state.message}
    </div>
  );
}
