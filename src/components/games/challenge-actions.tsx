"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cancelChallengeAction, respondChallengeAction } from "@/app/(student)/games/actions";

export function ChallengeActions({ id, incoming }: { id: string; incoming: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (action: () => Promise<{ ok: boolean; message: string; publicId?: string }>) => {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.message);
        return;
      }
      if (result.publicId) router.push(`/games/match/${result.publicId}`);
      else router.refresh();
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {incoming ? (
        <>
          <Button size="sm" variant="lime" disabled={pending} onClick={() => run(() => respondChallengeAction(id, true))}>Accept</Button>
          <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => respondChallengeAction(id, false))}>Decline</Button>
        </>
      ) : (
        <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => cancelChallengeAction(id))}>Cancel</Button>
      )}
      {error ? <span className="text-xs text-coral-dark">{error}</span> : null}
    </div>
  );
}
