import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getRoomOccupancy } from "@/lib/data/rooms";
import { istDateString, istDayEnd, istDayStart } from "@/lib/time/india";

export interface Phase2AdminMetrics {
  openSessionTitle: string | null;
  presentCount: number;
  pendingApprovals: number;
  notSubmittedCount: number;
  todayVisitors: number;
  playingOccupancy: number;
  gymOccupancy: number;
  mentalOccupancy: number;
  pendingTaskSubmissions: number;
  overdueTasks: number;
}

export const getPhase2AdminMetrics = cache(async (): Promise<Phase2AdminMetrics> => {
  const supabase = await createClient();
  const today = istDateString();
  const [{ data: session }, { data: records }, visitors, occupancy, tasks, submissions] =
    await Promise.all([
      supabase
        .from("attendance_sessions")
        .select("id, title")
        .eq("status", "open")
        .maybeSingle(),
      supabase
        .from("attendance_records")
        .select("status, session_id, submitted_at")
        .limit(5000),
      supabase
        .from("visitor_records")
        .select("id", { count: "exact", head: true })
        .gte("visited_at", istDayStart(today).toISOString())
        .lt("visited_at", istDayEnd(today).toISOString()),
      getRoomOccupancy(),
      supabase.from("class_tasks").select("id, due_at, status"),
      supabase.from("task_submissions").select("id, status"),
    ]);

  const sessionRecords = session
    ? (records ?? []).filter((record) => record.session_id === session.id)
    : [];
  const roomCodeCounts = new Map<string, number>();
  occupancy.forEach((entry) => {
    // Occupancy entries carry room ids; names are resolved by the dashboard
    // shell from the stable room order below.
    roomCodeCounts.set(entry.roomId, (roomCodeCounts.get(entry.roomId) ?? 0) + 1);
  });
  const { data: rooms } = await supabase.from("pe_rooms").select("id, code");
  const countForCode = (code: string) => {
    const room = (rooms ?? []).find((item) => item.code === code);
    return room ? (roomCodeCounts.get(room.id) ?? 0) : 0;
  };

  return {
    openSessionTitle: session?.title ?? null,
    presentCount: sessionRecords.filter((record) => record.status === "present").length,
    pendingApprovals: sessionRecords.filter((record) => record.status === "pending").length,
    notSubmittedCount: sessionRecords.filter((record) => record.status === "not_submitted").length,
    todayVisitors: visitors.count ?? 0,
    playingOccupancy: countForCode("playing_room"),
    gymOccupancy: countForCode("gym_room"),
    mentalOccupancy: countForCode("mental_games_room"),
    pendingTaskSubmissions: (submissions ?? []).filter((submission) => submission.status === "submitted").length,
    overdueTasks: (tasks ?? []).filter(
      (task) => task.status === "published" && new Date(task.due_at).getTime() < Date.now(),
    ).length,
  };
});
