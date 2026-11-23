"use client";

import { ErrorPanel } from "@/components/shared/error-panel";

export default function StudentError({ reset }: { error: Error; reset: () => void }) {
  return (
    <ErrorPanel
      title="Your workspace could not load"
      description="Your saved records are safe. Try again, or return to your dashboard."
      reset={reset}
      homeHref="/dashboard"
    />
  );
}
