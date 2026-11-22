import type { Metadata } from "next";
import { getRooms } from "@/lib/data/rooms";
import { RoomConfigEditor } from "@/components/rooms/room-config-editor";

export const metadata: Metadata = { title: "Room configuration" };

export default async function RoomConfigPage() {
  const rooms = await getRooms();
  return (
    <div className="space-y-8">
      <section className="border-b-2 border-navy pb-6">
        <p className="eyebrow text-cobalt">Daily operations / Rooms</p>
        <h1 className="mt-3 text-5xl font-bold leading-none sm:text-6xl">Room configuration</h1>
        <p className="mt-3 text-sm text-ink-muted">
          Configure each PE room, its activity options and the stale-session threshold used by
          the live occupancy board.
        </p>
      </section>
      <div className="grid gap-8">
        {rooms.map((room) => (
          <RoomConfigEditor key={room.id} room={room} />
        ))}
      </div>
    </div>
  );
}
