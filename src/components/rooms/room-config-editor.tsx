"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Plus } from "lucide-react";
import {
  addRoomActivity,
  saveRoomConfig,
  setRoomActivityActive,
} from "@/app/(admin)/admin/rooms/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { RoomView } from "@/types/domain";

export function RoomConfigEditor({ room }: { room: RoomView }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [form, setForm] = useState({
    roomId: room.id,
    name: room.name,
    description: room.description ?? "",
    instructions: room.instructions ?? "",
    requiresActivity: room.requiresActivity,
    maxSessionMinutes: room.maxSessionMinutes,
    isActive: room.isActive,
  });
  const [activityName, setActivityName] = useState("");

  function run(action: () => Promise<{ status: string; message: string }>) {
    setNotice(null);
    startTransition(async () => {
      const result = await action();
      setNotice({ tone: result.status === "success" ? "ok" : "error", text: result.message });
      if (result.status === "success") {
        setActivityName("");
        router.refresh();
      }
    });
  }

  return (
    <article className="border border-border bg-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-navy pb-3">
        <h2 className="text-2xl font-bold">{room.name}</h2>
        <span className="eyebrow text-ink-muted">{room.code}</span>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor={`room-name-${room.id}`}>Display name</Label>
          <Input
            id={`room-name-${room.id}`}
            className="mt-2"
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
          />
        </div>
        <div>
          <Label htmlFor={`room-minutes-${room.id}`}>Stale after (minutes)</Label>
          <Input
            id={`room-minutes-${room.id}`}
            type="number"
            min={15}
            max={720}
            className="mt-2"
            value={form.maxSessionMinutes}
            onChange={(event) =>
              setForm((current) => ({ ...current, maxSessionMinutes: Number(event.target.value) }))
            }
          />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor={`room-description-${room.id}`}>Description</Label>
          <Textarea
            id={`room-description-${room.id}`}
            className="mt-2"
            rows={2}
            value={form.description}
            onChange={(event) =>
              setForm((current) => ({ ...current, description: event.target.value }))
            }
          />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor={`room-instructions-${room.id}`}>Poster instructions</Label>
          <Textarea
            id={`room-instructions-${room.id}`}
            className="mt-2"
            rows={2}
            value={form.instructions}
            onChange={(event) =>
              setForm((current) => ({ ...current, instructions: event.target.value }))
            }
          />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-6">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-4"
            checked={form.requiresActivity}
            onChange={(event) =>
              setForm((current) => ({ ...current, requiresActivity: event.target.checked }))
            }
          />
          Require activity selection
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-4"
            checked={form.isActive}
            onChange={(event) =>
              setForm((current) => ({ ...current, isActive: event.target.checked }))
            }
          />
          Room active
        </label>
      </div>

      <div className="mt-4">
        <Button
          size="sm"
          disabled={pending}
          onClick={() => run(() => saveRoomConfig(form))}
        >
          {pending ? <LoaderCircle className="animate-spin" /> : null}
          Save room
        </Button>
      </div>

      <div className="mt-6 border-t border-border pt-5">
        <h3 className="eyebrow text-ink-muted">Activities</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {room.activities.length ? (
            room.activities.map((activity) => (
              <Button
                key={activity.id}
                size="sm"
                variant={activity.isActive ? "lime" : "outline"}
                disabled={pending}
                onClick={() => run(() => setRoomActivityActive(activity.id, !activity.isActive))}
              >
                {activity.name}
                <span className="ml-1 text-[9px] uppercase">
                  {activity.isActive ? "· on" : "· off"}
                </span>
              </Button>
            ))
          ) : (
            <p className="text-xs text-ink-muted">No activities configured.</p>
          )}
        </div>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div className="min-w-48 flex-1">
            <Label htmlFor={`new-activity-${room.id}`}>New activity</Label>
            <Input
              id={`new-activity-${room.id}`}
              className="mt-2"
              maxLength={80}
              value={activityName}
              onChange={(event) => setActivityName(event.target.value)}
            />
          </div>
          <Button
            size="sm"
            disabled={pending || activityName.trim().length < 2}
            onClick={() => run(() => addRoomActivity({ roomId: room.id, name: activityName }))}
          >
            <Plus /> Add
          </Button>
        </div>
      </div>

      {notice ? (
        <p role="status" className={`mt-5 text-xs ${notice.tone === "ok" ? "text-[#4b711d]" : "text-coral-dark"}`}>
          {notice.text}
        </p>
      ) : null}
    </article>
  );
}
