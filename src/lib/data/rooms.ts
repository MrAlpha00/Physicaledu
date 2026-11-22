import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { resolveDateRange, type VisitorDatePreset } from "@/lib/time/india";
import type { Database } from "@/types/database";
import type { RoomHistoryEntry, RoomOccupancyEntry, RoomView } from "@/types/domain";

type RoomRow = Database["public"]["Tables"]["pe_rooms"]["Row"];
type ActivityRow = Database["public"]["Tables"]["room_activities"]["Row"];
type SessionRow = Database["public"]["Tables"]["room_sessions"]["Row"];

function roomView(room: RoomRow, activities: ActivityRow[]): RoomView {
  return {
    id: room.id,
    code: room.code,
    name: room.name,
    description: room.description,
    instructions: room.instructions,
    requiresActivity: room.requires_activity,
    maxSessionMinutes: room.max_session_minutes,
    isActive: room.is_active,
    activities: activities.map((activity) => ({
      id: activity.id,
      name: activity.name,
      isActive: activity.is_active,
    })),
  };
}

export const getRooms = cache(async (): Promise<RoomView[]> => {
  const supabase = await createClient();
  const [{ data: rooms }, { data: activities }] = await Promise.all([
    supabase.from("pe_rooms").select("*").order("name"),
    supabase.from("room_activities").select("*").order("sort_order"),
  ]);
  return (rooms ?? []).map((room) =>
    roomView(
      room,
      (activities ?? []).filter((activity) => activity.room_id === room.id),
    ),
  );
});

interface StudentContext {
  id: string;
  full_name: string;
  usn: string;
  department_id: string;
}

async function buildSessionViews(
  sessions: SessionRow[],
): Promise<Array<{ session: SessionRow; student: StudentContext; departmentCode: string }>> {
  if (!sessions.length) return [];
  const supabase = await createClient();
  const directoryIds = [...new Set(sessions.map((session) => session.student_directory_id))];
  const [{ data: directory }, { data: departments }] = await Promise.all([
    supabase
      .from("student_directory")
      .select("id, full_name, usn, department_id")
      .in("id", directoryIds),
    supabase.from("departments").select("id, department_code"),
  ]);
  const directoryMap = new Map((directory ?? []).map((row) => [row.id, row]));
  const departmentMap = new Map((departments ?? []).map((row) => [row.id, row.department_code]));

  return sessions.flatMap((session) => {
    const student = directoryMap.get(session.student_directory_id);
    if (!student) return [];
    return [
      {
        session,
        student,
        departmentCode: departmentMap.get(student.department_id) ?? "—",
      },
    ];
  });
}

function occupancyFrom(
  entries: Array<{ session: SessionRow; student: StudentContext; departmentCode: string }>,
  maxMinutesByRoom: Record<string, number>,
  now: Date,
): RoomOccupancyEntry[] {
  return entries.map(({ session, student, departmentCode }) => {
    const elapsedMinutes = Math.max(
      0,
      Math.floor((now.getTime() - new Date(session.started_at).getTime()) / 60_000),
    );
    return {
      sessionId: session.id,
      roomId: session.room_id,
      fullName: student.full_name,
      usn: student.usn,
      departmentCode,
      activityName: session.activity_name,
      startedAt: session.started_at,
      elapsedMinutes,
      isStale: elapsedMinutes > (maxMinutesByRoom[session.room_id] ?? 120),
    };
  });
}

export const getRoomOccupancy = cache(async (): Promise<RoomOccupancyEntry[]> => {
  const supabase = await createClient();
  const [{ data: rooms }, { data: sessions }] = await Promise.all([
    supabase.from("pe_rooms").select("*"),
    supabase
      .from("room_sessions")
      .select("*")
      .is("ended_at", null)
      .order("started_at", { ascending: true }),
  ]);
  const maxMinutesByRoom = Object.fromEntries(
    (rooms ?? []).map((room) => [room.id, room.max_session_minutes]),
  );
  const views = await buildSessionViews(sessions ?? []);
  return occupancyFrom(views, maxMinutesByRoom, new Date());
});

export interface RoomHistoryFilters {
  preset: VisitorDatePreset;
  from?: string;
  to?: string;
  search?: string;
  roomId?: string;
}

export const getRoomHistory = cache(
  async (filters: RoomHistoryFilters): Promise<RoomHistoryEntry[]> => {
    const supabase = await createClient();
    const range = resolveDateRange(filters.preset, new Date(), {
      from: filters.from,
      to: filters.to,
    });
    let query = supabase
      .from("room_sessions")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(500);
    if (range.start) query = query.gte("started_at", range.start.toISOString());
    if (range.end) query = query.lt("started_at", range.end.toISOString());
    if (filters.roomId) query = query.eq("room_id", filters.roomId);
    const { data: sessions } = await query;
    if (!sessions?.length) return [];

    const views = await buildSessionViews(sessions);
    const supabase2 = await createClient();
    const { data: rooms } = await supabase2.from("pe_rooms").select("id, max_session_minutes");
    const maxMinutesByRoom = Object.fromEntries(
      (rooms ?? []).map((room) => [room.id, room.max_session_minutes]),
    );
    const term = filters.search?.trim().toLowerCase();
    return occupancyFrom(views, maxMinutesByRoom, new Date())
      .map((entry) => {
        const session = views.find((view) => view.session.id === entry.sessionId)!.session;
        return {
          ...entry,
          endedAt: session.ended_at,
          forceClosedReason: session.force_closed_reason,
        };
      })
      .filter((entry) =>
        term
          ? entry.fullName.toLowerCase().includes(term) || entry.usn.toLowerCase().includes(term)
          : true,
      );
  },
);
