import { cache } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { attendancePercentage, computeAttendanceOverview } from "@/lib/operations/attendance";
import type {
  AttendanceOverview,
  AttendanceRecordView,
  AttendanceSessionSummary,
  MyAttendanceSummary,
} from "@/types/domain";
import type { Database } from "@/types/database";

type SessionRow = Database["public"]["Tables"]["attendance_sessions"]["Row"];
type RecordRow = Database["public"]["Tables"]["attendance_records"]["Row"];

function toSessionSummary(
  session: SessionRow,
  eligibleCount: number,
): AttendanceSessionSummary {
  return {
    id: session.id,
    title: session.title,
    classDate: session.class_date,
    startsAt: session.starts_at,
    expectedEndsAt: session.expected_ends_at,
    status: session.status,
    instructions: session.instructions,
    openedAt: session.opened_at,
    closedAt: session.closed_at,
    finalisedAt: session.finalised_at,
    eligibleCount,
  };
}

export const getAttendanceSessions = cache(async (): Promise<AttendanceSessionSummary[]> => {
  const supabase = await createClient();
  const [{ data: sessions }, { data: records }] = await Promise.all([
    supabase
      .from("attendance_sessions")
      .select("*")
      .order("class_date", { ascending: false })
      .limit(100),
    supabase.from("attendance_records").select("session_id"),
  ]);

  const counts = new Map<string, number>();
  records?.forEach((record) => {
    counts.set(record.session_id, (counts.get(record.session_id) ?? 0) + 1);
  });

  return (sessions ?? []).map((session) =>
    toSessionSummary(session, counts.get(session.id) ?? 0),
  );
});

export const getAttendanceSessionDetail = cache(
  async (sessionId: string): Promise<{
    session: AttendanceSessionSummary | null;
    records: AttendanceRecordView[];
    overview: AttendanceOverview;
  } | null> => {
    const supabase = await createClient();
    const [{ data: session }, { data: records }] = await Promise.all([
      supabase.from("attendance_sessions").select("*").eq("id", sessionId).maybeSingle(),
      supabase.from("attendance_records").select("*").eq("session_id", sessionId),
    ]);
    if (!session || !records) return null;

    const directoryIds = [...new Set(records.map((record) => record.student_directory_id))];
    const directoryResult = directoryIds.length
      ? await supabase
          .from("student_directory")
          .select("id, usn, full_name, department_id, semester")
          .in("id", directoryIds)
      : { data: [] as Array<{
          id: string;
          usn: string;
          full_name: string;
          department_id: string;
          semester: number;
        }> };
    const departmentsResult = await supabase
      .from("departments")
      .select("id, department_code, department_name");

    const directoryMap = new Map(
      (directoryResult.data ?? []).map((row) => [row.id, row]),
    );
    const departmentMap = new Map(
      (departmentsResult.data ?? []).map((row) => [row.id, row]),
    );
    const now = Date.now();

    const views: AttendanceRecordView[] = records.flatMap((record) => {
      const student = directoryMap.get(record.student_directory_id);
      if (!student) return [];
      const department = departmentMap.get(student.department_id);
      return [
        {
          recordId: record.id,
          studentDirectoryId: student.id,
          fullName: student.full_name,
          usn: student.usn,
          departmentId: student.department_id,
          departmentCode: department?.department_code ?? "—",
          departmentName: department?.department_name ?? "Unknown department",
          semester: student.semester,
          membershipId: record.membership_id,
          status: record.status,
          submittedType: record.submitted_type,
          submittedAt: record.submitted_at,
          reviewedAt: record.reviewed_at,
          administrativeNote: record.administrative_note,
          isOverdue:
            record.status === "not_submitted" && now > new Date(session.expected_ends_at).getTime(),
        },
      ];
    });

    views.sort((a, b) => a.fullName.localeCompare(b.fullName));

    return {
      session: toSessionSummary(session, views.length),
      records: views,
      overview: computeAttendanceOverview(views),
    };
  },
);

export const getMyAttendance = cache(async (user: User): Promise<MyAttendanceSummary> => {
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("student_directory_id")
    .eq("id", user.id)
    .maybeSingle();

  const empty: MyAttendanceSummary = {
    session: null,
    status: null,
    submittedType: null,
    submittedAt: null,
    reviewedAt: null,
    history: [],
    present: 0,
    represented: 0,
    absent: 0,
    excused: 0,
    percentage: 0,
  };
  if (!profile?.student_directory_id) return empty;

  const [{ data: myRecords }, { data: sessions }] = await Promise.all([
    supabase
      .from("attendance_records")
      .select("*")
      .eq("student_directory_id", profile.student_directory_id),
    supabase
      .from("attendance_sessions")
      .select("*")
      .order("class_date", { ascending: false })
      .limit(100),
  ]);

  const sessionMap = new Map((sessions ?? []).map((session) => [session.id, session]));
  const recordById = new Map<string, RecordRow>(
    (myRecords ?? []).map((record) => [record.session_id, record]),
  );
  const openSession = (sessions ?? []).find(
    (session) => session.status === "open" && recordById.has(session.id),
  );

  const history = (myRecords ?? [])
    .map((record) => {
      const session = sessionMap.get(record.session_id);
      if (!session) return null;
      return {
        id: record.id,
        title: session.title,
        classDate: session.class_date,
        status: record.status,
        submittedType: record.submitted_type,
        reviewedAt: record.reviewed_at,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
    .sort((a, b) => b.classDate.localeCompare(a.classDate));

  const present = history.filter((entry) => entry.status === "present").length;
  const represented = history.filter((entry) => entry.status === "represented").length;
  const absent = history.filter((entry) => entry.status === "absent").length;
  const excused = history.filter((entry) => entry.status === "excused").length;
  const currentRecord = openSession ? recordById.get(openSession.id) : undefined;

  return {
    session: openSession ? toSessionSummary(openSession, recordById.size) : null,
    status: currentRecord?.status ?? null,
    submittedType: currentRecord?.submitted_type ?? null,
    submittedAt: currentRecord?.submitted_at ?? null,
    reviewedAt: currentRecord?.reviewed_at ?? null,
    history,
    present,
    represented,
    absent,
    excused,
    percentage: attendancePercentage({ present, represented, absent, excused }),
  };
});
