import type { Metadata } from "next";
import Link from "next/link";
import { SlidersHorizontal } from "lucide-react";
import { getRoomHistory, getRoomOccupancy, getRooms } from "@/lib/data/rooms";
import { RoomOccupancyBoard } from "@/components/rooms/room-occupancy-board";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  formatIstDateTime,
  VISITOR_DATE_PRESETS,
  type VisitorDatePreset,
} from "@/lib/time/india";

export const metadata: Metadata = { title: "Room management" };

type SearchParams = Promise<{
  preset?: string;
  from?: string;
  to?: string;
  room?: string;
  search?: string;
}>;

export default async function AdminRoomsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const preset = (VISITOR_DATE_PRESETS.some((item) => item.value === params.preset)
    ? params.preset
    : "today") as VisitorDatePreset;
  const [rooms, occupancy, history] = await Promise.all([
    getRooms(),
    getRoomOccupancy(),
    getRoomHistory({
      preset,
      from: params.from,
      to: params.to,
      roomId: params.room,
      search: params.search,
    }),
  ]);

  return (
    <div className="space-y-9">
      <section className="flex flex-col gap-4 border-b-2 border-navy pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow text-cobalt">Daily operations / Rooms</p>
          <h1 className="mt-3 text-5xl font-bold leading-none sm:text-6xl">Room management</h1>
          <p className="mt-3 text-sm text-ink-muted">
            Monitor live room usage, close stale sessions and review entry history.
          </p>
        </div>
        <Link href="/admin/rooms/config">
          <Button variant="outline"><SlidersHorizontal /> Configure rooms</Button>
        </Link>
      </section>

      <RoomOccupancyBoard rooms={rooms} entries={occupancy} />

      <section className="space-y-4">
        <h2 className="border-b-2 border-navy pb-2 text-2xl font-bold">Session history</h2>
        <form method="get" className="grid gap-3 border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <label htmlFor="preset" className="eyebrow text-ink-muted">Period</label>
            <select
              id="preset"
              name="preset"
              defaultValue={preset}
              className="mt-2 h-10 w-full border border-input bg-card px-3 text-sm"
            >
              {VISITOR_DATE_PRESETS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="from" className="eyebrow text-ink-muted">From</label>
            <Input id="from" name="from" type="date" defaultValue={params.from ?? ""} className="mt-2" />
          </div>
          <div>
            <label htmlFor="to" className="eyebrow text-ink-muted">To</label>
            <Input id="to" name="to" type="date" defaultValue={params.to ?? ""} className="mt-2" />
          </div>
          <div>
            <label htmlFor="room" className="eyebrow text-ink-muted">Room</label>
            <select
              id="room"
              name="room"
              defaultValue={params.room ?? ""}
              className="mt-2 h-10 w-full border border-input bg-card px-3 text-sm"
            >
              <option value="">All</option>
              {rooms.map((room) => (
                <option key={room.id} value={room.id}>{room.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="search" className="eyebrow text-ink-muted">Student / USN</label>
            <Input id="search" name="search" defaultValue={params.search ?? ""} className="mt-2" />
          </div>
          <div className="lg:col-span-5">
            <Button type="submit" size="sm">Apply filters</Button>
            <Link href="/admin/rooms" className="ml-3 text-xs font-bold text-cobalt hover:underline">
              Reset
            </Link>
          </div>
        </form>

        <div className="overflow-x-auto border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Entered (IST)</TableHead>
                <TableHead>Exited</TableHead>
                <TableHead>Room</TableHead>
                <TableHead>Student</TableHead>
                <TableHead>Activity</TableHead>
                <TableHead>Note</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="p-8 text-center text-sm text-ink-muted">
                    No room sessions match the current filters.
                  </TableCell>
                </TableRow>
              ) : (
                history.map((entry) => (
                  <TableRow key={entry.sessionId}>
                    <TableCell className="whitespace-nowrap text-xs">{formatIstDateTime(entry.startedAt)}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-ink-muted">
                      {entry.endedAt ? formatIstDateTime(entry.endedAt) : "Open"}
                    </TableCell>
                    <TableCell className="text-xs font-bold">
                      {rooms.find((room) => room.id === entry.roomId)?.code ?? "—"}
                    </TableCell>
                    <TableCell>
                      <p className="text-sm font-bold">{entry.fullName}</p>
                      <p className="font-mono text-xs text-ink-muted">{entry.usn}</p>
                    </TableCell>
                    <TableCell className="text-xs">{entry.activityName ?? "—"}</TableCell>
                    <TableCell className="text-xs text-coral-dark">
                      {entry.forceClosedReason ?? (entry.isStale ? "Stale (still open)" : "—")}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}
