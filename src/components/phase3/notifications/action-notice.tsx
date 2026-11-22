"use client";

import { CircleAlert, CircleCheck } from "lucide-react";
import type { ActionState } from "@/types/domain";

export function NotificationActionNotice({ state }: { state: ActionState | null }) {
  if (!state || !state.message) return null;
  const error = state.status === "error";
  return (
    <div
      role="status"
      aria-live="polite"
      className={
        error
          ? "flex items-start gap-2 border border-coral/40 bg-coral/10 px-4 py-3 text-sm text-coral-dark"
          : "flex items-start gap-2 border border-lime/60 bg-lime/10 px-4 py-3 text-sm text-navy"
      }
    >
      {error ? <CircleAlert className="mt-0.5 size-4 shrink-0" /> : <CircleCheck className="mt-0.5 size-4 shrink-0" />}
      <span>{state.message}</span>
    </div>
  );
}
