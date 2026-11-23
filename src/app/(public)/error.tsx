"use client";

import { ErrorPanel } from "@/components/shared/error-panel";

export default function PublicError({ reset }: { error: Error; reset: () => void }) {
  return <ErrorPanel reset={reset} homeHref="/" />;
}
