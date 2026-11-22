"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, LogIn, LogOut } from "lucide-react";
import { enterRoom, exitRoom } from "@/app/(public)/room/[token]/actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export function RoomScanPanel({
  token,
  roomId,
  roomName,
  requiresActivity,
  activities,
  activeSessionId,
  activeSessionRoomId,
  isAuthenticated,
}: {
  token: string;
  roomId: string;
  roomName: string;
  requiresActivity: boolean;
  activities: Array<{ id: string; name: string }>;
  activeSessionId: string | null;
  activeSessionRoomId: string | null;
  isAuthenticated: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [activityId, setActivityId] = useState("");
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const activeHere = activeSessionId !== null && activeSessionRoomId === roomId;
  const activeElsewhere = activeSessionId !== null && !activeHere;

  function run(isExit: boolean) {
    setNotice(null);
    startTransition(async () => {
      const result = isExit
        ? await exitRoom(token)
        : await enterRoom(token, activityId || undefined);
      setNotice({ tone: result.status === "success" ? "ok" : "error", text: result.message });
      if (result.status === "success") router.refresh();
    });
  }

  if (!isAuthenticated) {
    return (
      <div className="border-l-4 border-l-cobalt bg-cobalt/5 p-5">
        <h2 className="text-xl font-bold">Sign in to continue</h2>
        <p className="mt-2 text-sm text-ink-muted">
          Room entry and exit are recorded against your verified student account. Sign in, then
          scan this QR again.
        </p>
        <a
          href={`/login?next=/room/${encodeURIComponent(token)}`}
          className="mt-4 inline-flex h-10 items-center bg-navy px-5 text-xs font-bold uppercase tracking-[0.08em] text-chalk"
        >
          Sign in
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <p className="border-l-4 border-l-lime bg-lime/30 p-4 text-sm">
        You are scanning <span className="font-bold">{roomName}</span>. Entry and exit are
        timestamped in Asia/Kolkata.
      </p>

      {notice ? (
        <p role="status" className={`border-l-4 p-4 text-sm ${notice.tone === "ok" ? "border-l-[#8fb63c] bg-lime/40 text-[#33521b]" : "border-l-coral bg-coral/10 text-[#8b3725]"}`}>
          {notice.text}
        </p>
      ) : null}

      {activeHere ? (
        <div className="border-2 border-navy bg-card p-6">
          <h2 className="text-2xl font-bold">You are currently in {roomName}</h2>
          <p className="mt-2 text-sm text-ink-muted">
            Scan the exit QR on the notice board again, or use the button below to close this
            session.
          </p>
          <Button
            variant="destructive"
            size="lg"
            className="mt-5"
            disabled={pending}
            onClick={() => run(true)}
          >
            {pending ? <LoaderCircle className="animate-spin" /> : <LogOut />}
            Record exit now
          </Button>
        </div>
      ) : activeElsewhere ? (
        <div className="border-l-4 border-l-coral bg-coral/10 p-6">
          <h2 className="text-2xl font-bold">Close your other room session first</h2>
          <p className="mt-2 text-sm text-ink-muted">
            You have an open session in a different PE room. Scan that room&apos;s QR to record
            your exit before entering {roomName}.
          </p>
        </div>
      ) : (
        <div className="border-2 border-navy bg-card p-6">
          <h2 className="text-2xl font-bold">Scan to enter</h2>
          {requiresActivity ? (
            <div className="mt-5">
              <Label htmlFor="room-activity">Activity</Label>
              <select
                id="room-activity"
                className="mt-2 h-11 w-full border border-input bg-card px-3 text-sm"
                value={activityId}
                onChange={(event) => setActivityId(event.target.value)}
              >
                <option value="">Select an activity</option>
                {activities.map((activity) => (
                  <option key={activity.id} value={activity.id}>{activity.name}</option>
                ))}
              </select>
            </div>
          ) : null}
          <Button
            variant="lime"
            size="lg"
            className="mt-5"
            disabled={pending || activeElsewhere || (requiresActivity && !activityId)}
            onClick={() => run(false)}
          >
            {pending ? <LoaderCircle className="animate-spin" /> : <LogIn />}
            Record entry
          </Button>
        </div>
      )}
    </div>
  );
}
