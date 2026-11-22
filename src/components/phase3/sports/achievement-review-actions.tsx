"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { reviewAchievement } from "@/app/(admin)/admin/sports-profiles/actions";
import { Phase3StatusBadge } from "@/components/phase3/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SportsActionNotice } from "./action-notice";
import type { ActionState } from "@/types/domain";
import type { AchievementVerificationStatus } from "@/types/database";

export function AchievementReviewActions({
  achievementId,
  status,
}: {
  achievementId: string;
  status: AchievementVerificationStatus;
}) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [notice, setNotice] = useState<ActionState | null>(null);
  const [pending, startTransition] = useTransition();

  function decide(next: AchievementVerificationStatus) {
    setNotice(null);
    startTransition(async () => {
      const result = await reviewAchievement({ achievementId, status: next, note });
      setNotice(result);
      if (result.status === "success") {
        setNote("");
        router.refresh();
      }
    });
  }

  return (
    <div className="min-w-56 space-y-2">
      <div className="flex flex-wrap items-center gap-1">
        <Button type="button" size="sm" variant="lime" disabled={pending || status === "verified"} onClick={() => decide("verified")}>
          Verify
        </Button>
        <Button type="button" size="sm" variant="coral" disabled={pending || status === "rejected"} onClick={() => decide("rejected")}>
          Reject
        </Button>
        {status !== "pending" ? (
          <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => decide("pending")}>
            Reset
          </Button>
        ) : null}
      </div>
      <Input
        aria-label="Review note"
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder="Optional review note"
        maxLength={500}
        className="h-8 text-xs"
      />
      <Phase3StatusBadge label={`Current: ${status}`} />
      <SportsActionNotice state={notice} />
    </div>
  );
}
