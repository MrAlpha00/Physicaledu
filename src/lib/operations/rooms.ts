import type { QrType } from "@/types/database";
import type { RoomOccupancyEntry } from "@/types/domain";

export const ROOM_QR_TYPES: QrType[] = ["playing_room", "gym_room", "mental_games_room"];

export function isRoomQrType(type: QrType): boolean {
  return ROOM_QR_TYPES.includes(type);
}

export function elapsedMinutes(startedAt: string, now: Date = new Date()): number {
  return Math.max(0, Math.floor((now.getTime() - new Date(startedAt).getTime()) / 60_000));
}

export function isStaleSession(
  startedAt: string,
  maxSessionMinutes: number,
  now: Date = new Date(),
): boolean {
  return elapsedMinutes(startedAt, now) > maxSessionMinutes;
}

export function annotateOccupancy<T extends { startedAt: string; roomId: string }>(
  entries: T[],
  maxSessionMinutesByRoom: Record<string, number>,
  now: Date = new Date(),
): Array<T & { elapsedMinutes: number; isStale: boolean }> {
  return entries.map((entry) => {
    const limit = maxSessionMinutesByRoom[entry.roomId] ?? 120;
    return {
      ...entry,
      elapsedMinutes: elapsedMinutes(entry.startedAt, now),
      isStale: isStaleSession(entry.startedAt, limit, now),
    };
  });
}

export function totalOccupancy(entries: RoomOccupancyEntry[]): number {
  return entries.filter((entry) => !entry.endedAt).length;
}

export function describeRoomError(message: string): string {
  const text = message.toLowerCase();
  if (text.includes("already have an active")) {
    return "You already have an active session in this room. Scan again to exit.";
  }
  if (text.includes("no active room session")) {
    return "No active session was found. Scan the room QR on entry first.";
  }
  if (text.includes("choose an activity")) return "Choose an activity before entering.";
  if (text.includes("active pe membership")) {
    return "Only active PE students can use room QR services.";
  }
  if (text.includes("invalid or inactive")) return "This QR code is invalid or has been deactivated.";
  return "The room session could not be updated. Please try again.";
}
