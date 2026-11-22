"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, LogOut, RefreshCw } from "lucide-react";
import { closeRoomSession } from "@/app/(admin)/admin/rooms/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatIstTime } from "@/lib/time/india";
import type { RoomOccupancyEntry, RoomView } from "@/types/domain";

export function RoomOccupancyBoard({
  rooms,
  entries,
}: {
  rooms: RoomView[];
  entries: RoomOccupancyEntry[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [closing, setClosing] = useState<RoomOccupancyEntry | null>(null);
  const [reason, setReason] = useState("");
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  function close() {
    if (!closing) return;
    setNotice(null);
    startTransition(async () => {
      const result = await closeRoomSession(closing.sessionId, reason);
      setNotice({ tone: result.status === "success" ? "ok" : "error", text: result.message });
      if (result.status === "success") {
        setClosing(null);
        setReason("");
        router.refresh();
      }
    });
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="mb-1 border-b-2 border-navy pb-2 text-2xl font-bold">Live occupancy</h2>
          <p className="text-xs text-ink-muted">
            Counts include all currently open room sessions. Refresh for the latest state.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => router.refresh()}>
          <RefreshCw /> Refresh
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {rooms.map((room) => {
          const roomEntries = entries.filter((entry) => entry.roomId === room.id);
          return (
            <div key={room.id} className="border-l-4 border-l-cobalt bg-card p-5">
              <p className="eyebrow text-ink-muted">{room.code}</p>
              <p className="stat-number mt-2 text-5xl">{roomEntries.length}</p>
              <p className="mt-1 text-sm font-bold">{room.name}</p>
              {roomEntries.some((entry) => entry.isStale) ? (
                <p className="mt-2 text-xs font-bold text-coral-dark">Stale session present</p>
              ) : null}
            </div>
          );
        })}
      </div>

      {notice ? (
        <p role="status" className={`border-l-4 p-3 text-sm ${notice.tone === "ok" ? "border-l-[#8fb63c] bg-lime/40 text-[#33521b]" : "border-l-coral bg-coral/10 text-[#8b3725]"}`}>
          {notice.text}
        </p>
      ) : null}

      {entries.length === 0 ? (
        <p className="border border-dashed border-border p-8 text-center text-sm text-ink-muted">
          No students are currently signed into a PE room.
        </p>
      ) : (
        <div className="overflow-x-auto border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Room</TableHead>
                <TableHead>Student</TableHead>
                <TableHead>Activity</TableHead>
                <TableHead>Entered</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead aria-label="Actions" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => {
                const room = rooms.find((item) => item.id === entry.roomId);
                return (
                  <TableRow key={entry.sessionId} className={entry.isStale ? "bg-coral/5" : undefined}>
                    <TableCell className="text-xs font-bold">{room?.code ?? "—"}</TableCell>
                    <TableCell>
                      <p className="font-bold">{entry.fullName}</p>
                      <p className="font-mono text-xs text-ink-muted">
                        {entry.usn} · {entry.departmentCode}
                      </p>
                    </TableCell>
                    <TableCell className="text-xs">{entry.activityName ?? "—"}</TableCell>
                    <TableCell className="text-xs">{formatIstTime(entry.startedAt)}</TableCell>
                    <TableCell className="text-xs">
                      {entry.elapsedMinutes} min
                      {entry.isStale ? (
                        <span className="ml-2 font-bold text-coral-dark">STALE</span>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={pending}
                        onClick={() => {
                          setClosing(entry);
                          setReason("");
                        }}
                      >
                        <LogOut /> Force close
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {closing ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/60 p-4">
          <div className="w-full max-w-md border-2 border-navy bg-chalk p-6 shadow-xl">
            <h3 className="text-2xl font-bold">Close session</h3>
            <p className="mt-2 text-sm text-ink-muted">
              Force-close {closing.fullName}&apos;s session in{" "}
              {rooms.find((room) => room.id === closing.roomId)?.name ?? "the room"}. This is
              recorded in the audit log.
            </p>
            <div className="mt-4">
              <Label htmlFor="close-reason">Reason</Label>
              <Input
                id="close-reason"
                className="mt-2"
                maxLength={300}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <Button variant="outline" onClick={() => setClosing(null)}>Cancel</Button>
              <Button variant="destructive" disabled={pending || reason.trim().length < 4} onClick={close}>
                {pending ? <LoaderCircle className="animate-spin" /> : null}
                Close session
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
