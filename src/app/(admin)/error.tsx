"use client";

import { ErrorPanel } from "@/components/shared/error-panel";

export default function AdminError({ reset }: { error: Error; reset: () => void }) {
  return (
    <ErrorPanel
      title="Administration could not load"
      description="No records were changed. Try again, or return to the admin overview."
      reset={reset}
      homeHref="/admin/dashboard"
    />
  );
}
