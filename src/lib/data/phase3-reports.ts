import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { aggregateReportRows } from "@/lib/operations/phase3";
import { getEquipmentItems, getMaintenanceRecords, getEquipmentTransactions } from "@/lib/data/phase3-equipment";
import { getAdminFeedbackRequests } from "@/lib/data/phase3-feedback";
import { getAdminAchievements } from "@/lib/data/phase3-sports";
import { getAdminCalendarEvents } from "@/lib/data/phase3-calendar";
import type { ExportDataset } from "@/lib/validations/phase3";
import type { Phase3DashboardMetrics, Phase3ReportRow } from "@/types/domain";

export interface ReportWindow {
  from: Date;
  to: Date;
}

export interface Phase3ReportData {
  attendance: Phase3ReportRow[];
  tasks: Phase3ReportRow[];
  visitors: Phase3ReportRow[];
  equipment: Phase3ReportRow[];
  maintenance: Phase3ReportRow[];
  feedback: Phase3ReportRow[];
  achievements: Phase3ReportRow[];
  calendar: Phase3ReportRow[];
  participationByDepartment: Phase3ReportRow[];
}

export const getPhase3ReportData = cache(async ({ from, to }: ReportWindow): Promise<Phase3ReportData> => {
  const supabase = await createClient();
  const [attendanceResult, submissionsResult, submissionsTasksResult, visitorsResult, purposesResult] = await Promise.all([
    supabase
      .from("attendance_records")
      .select("status, created_at")
      .gte("created_at", from.toISOString())
      .lte("created_at", to.toISOString())
      .limit(20000),
    supabase
      .from("task_submissions")
      .select("status, created_at")
      .gte("created_at", from.toISOString())
      .lte("created_at", to.toISOString())
      .limit(20000),
    supabase.from("class_tasks").select("id, status"),
    supabase
      .from("visitor_records")
      .select("purpose_id, visited_at")
      .gte("visited_at", from.toISOString())
      .lte("visited_at", to.toISOString())
      .limit(20000),
    supabase.from("visitor_purposes").select("id, label"),
  ]);

  const [items, maintenance, transactions, feedback, achievements, events] = await Promise.all([
    getEquipmentItems(),
    getMaintenanceRecords(),
    getEquipmentTransactions(),
    getAdminFeedbackRequests(),
    getAdminAchievements(),
    getAdminCalendarEvents(),
  ]);

  const purposeNames = new Map((purposesResult.data ?? []).map((row) => [row.id, row.label]));
  const taskStatusById = new Map((submissionsTasksResult.data ?? []).map((row) => [row.id, row.status]));

  const attendance = aggregateReportRows(
    (attendanceResult.data ?? []).map((row) => ({ label: row.status.replaceAll("_", " "), value: 1 })),
  );
  const tasks = aggregateReportRows(
    (submissionsResult.data ?? []).map((row) => ({ label: row.status.replaceAll("_", " "), value: 1 })),
  );
  const visitors = aggregateReportRows(
    (visitorsResult.data ?? []).map((row) => ({
      label: purposeNames.get(row.purpose_id) ?? "Other",
      value: 1,
    })),
  );
  const equipment = aggregateReportRows(
    items.map((item) => ({
      label: item.categoryName,
      value: item.quantity,
      detail: `${item.availableQuantity} available · ${item.borrowedQuantity} issued`,
    })),
  );
  const maintenanceRows = aggregateReportRows(
    maintenance.map((row) => ({ label: row.status.replaceAll("_", " "), value: 1 })),
  );
  const feedbackRows = aggregateReportRows(
    feedback.map((row) => ({ label: row.category.replaceAll("_", " "), value: 1 })),
  );
  const achievementRows = aggregateReportRows(
    achievements.map((row) => ({ label: row.sport, value: 1 })),
  );
  const calendarRows = aggregateReportRows(
    events
      .filter((event) => new Date(event.startsAt) >= from && new Date(event.startsAt) <= to)
      .map((event) => ({ label: event.category.replaceAll("_", " "), value: 1 })),
  );

  const studentIds = [...new Set(transactions.map((row) => row.studentDirectoryId))];
  const { data: students } = studentIds.length
    ? await supabase.from("student_directory").select("id, department_id").in("id", studentIds)
    : { data: [] };
  const { data: departments } = await supabase.from("departments").select("id, department_name");
  const departmentNames = new Map((departments ?? []).map((row) => [row.id, row.department_name]));
  const studentDepartments = new Map((students ?? []).map((row) => [row.id, row.department_id]));
  const participationByDepartment = aggregateReportRows(
    transactions.map((row) => {
      const departmentId = studentDepartments.get(row.studentDirectoryId);
      return {
        label: departmentId ? departmentNames.get(departmentId) ?? "Unknown" : "Unknown",
        value: row.quantityIssued,
      };
    }),
  );

  void taskStatusById;

  return {
    attendance,
    tasks,
    visitors,
    equipment,
    maintenance: maintenanceRows,
    feedback: feedbackRows,
    achievements: achievementRows,
    calendar: calendarRows,
    participationByDepartment,
  };
});

export const getPhase3DashboardMetrics = cache(async (): Promise<Phase3DashboardMetrics> => {
  const supabase = await createClient();
  const [items, transactions, maintenance, feedback, events, notifications, achievements, recipients, drafts] = await Promise.all([
    getEquipmentItems(),
    getEquipmentTransactions(),
    getMaintenanceRecords(),
    getAdminFeedbackRequests(),
    getAdminCalendarEvents(),
    supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null),
    getAdminAchievements(),
    supabase.from("email_recipients").select("status"),
    supabase.from("game_rule_posts").select("id", { count: "exact", head: true }).eq("status", "draft"),
  ]);

  const today = new Date();
  return {
    equipmentItems: items.length,
    equipmentIssued: items.reduce((sum, item) => sum + item.borrowedQuantity, 0),
    equipmentOverdue: transactions.filter((row) => row.displayStatus === "overdue").length,
    maintenanceOpen: maintenance.filter((row) => !["completed", "unrepairable", "cancelled"].includes(row.status)).length,
    upcomingEvents: events.filter((event) => new Date(event.startsAt) >= today).length,
    pendingFeedback: feedback.filter((row) => !["resolved", "rejected", "closed"].includes(row.status)).length,
    draftGameRules: drafts.count ?? 0,
    unreadNotifications: notifications.count ?? 0,
    pendingAchievements: achievements.filter((row) => row.verificationStatus === "pending").length,
    emailAcceptedToday: (recipients.data ?? []).filter((row) => ["accepted", "delivered", "bounced"].includes(row.status)).length,
    emailDeliveredCount: (recipients.data ?? []).filter((row) => row.status === "delivered").length,
    emailFailedCount: (recipients.data ?? []).filter((row) => row.status === "failed").length,
  };
});

export interface ExportRow {
  [key: string]: string | number | boolean | null;
}

export async function getExportRows(dataset: ExportDataset, from: Date, to: Date): Promise<ExportRow[]> {
  const supabase = await createClient();
  switch (dataset) {
    case "equipment": {
      const items = await getEquipmentItems();
      return items.map((item) => ({
        Category: item.categoryName,
        Name: item.name,
        Identification: item.identificationNumber,
        Tracking: item.trackingMode,
        Quantity: item.quantity,
        Available: item.availableQuantity,
        Issued: item.borrowedQuantity,
        Maintenance: item.maintenanceQuantity,
        Damaged: item.damagedQuantity,
        Condition: item.condition,
        Location: item.storageLocation,
        Status: item.inventoryStatus,
      }));
    }
    case "maintenance": {
      const records = await getMaintenanceRecords();
      return records.map((row) => ({
        Equipment: row.itemName,
        Issue: row.issueDescription,
        Type: row.maintenanceType,
        Quantity: row.quantityAffected,
        Status: row.status,
        Reported: row.reportedAt,
        Assigned: row.assignedPerson,
        Completed: row.completedAt,
        Resolution: row.resolutionNotes,
        Cost: row.cost,
      }));
    }
    case "feedback": {
      const rows = await getAdminFeedbackRequests();
      return rows.map((row) => ({
        Subject: row.subject,
        Category: row.category,
        Status: row.status,
        Priority: row.priority,
        Student: row.studentName,
        Department: row.departmentName,
        Created: row.createdAt,
        Replies: row.replyCount,
        Description: row.description,
      }));
    }
    case "achievements": {
      const rows = await getAdminAchievements();
      return rows.map((row) => ({
        Student: row.studentName,
        Title: row.title,
        Sport: row.sport,
        Event: row.eventName,
        Date: row.achievementDate,
        Result: row.positionResult,
        Verification: row.verificationStatus,
        Source: row.sourceType,
      }));
    }
    case "calendar": {
      const rows = await getAdminCalendarEvents();
      return rows.map((row) => ({
        Title: row.title,
        Category: row.category,
        Starts: row.startsAt,
        Ends: row.endsAt,
        Venue: row.venue,
        Visibility: row.visibility,
        Status: row.status,
      }));
    }
    case "attendance": {
      const { data } = await supabase
        .from("attendance_records")
        .select("id, status, student_directory_id, session_id, submitted_at, reviewed_at")
        .gte("created_at", from.toISOString())
        .lte("created_at", to.toISOString())
        .limit(20000);
      return (data ?? []).map((row) => ({
        Record: row.id,
        Status: row.status,
        Student: row.student_directory_id,
        Session: row.session_id,
        Submitted: row.submitted_at,
        Reviewed: row.reviewed_at,
      }));
    }
    case "tasks": {
      const [tasksResult, submissionsResult] = await Promise.all([
        supabase.from("class_tasks").select("id, title, status, due_at, created_at"),
        supabase.from("task_submissions").select("task_id, student_directory_id, status, submitted_at, reviewed_at"),
      ]);
      const titles = new Map((tasksResult.data ?? []).map((row) => [row.id, row.title]));
      return (submissionsResult.data ?? []).map((row) => ({
        Task: titles.get(row.task_id) ?? row.task_id,
        Student: row.student_directory_id,
        Status: row.status,
        Submitted: row.submitted_at,
        Reviewed: row.reviewed_at,
      }));
    }
    case "visitors": {
      const [visitorsResult, purposesResult] = await Promise.all([
        supabase
          .from("visitor_records")
          .select("id, full_name, usn, purpose_id, purpose_detail, visited_at")
          .gte("visited_at", from.toISOString())
          .lte("visited_at", to.toISOString())
          .limit(20000),
        supabase.from("visitor_purposes").select("id, label"),
      ]);
      const purposes = new Map((purposesResult.data ?? []).map((row) => [row.id, row.label]));
      return (visitorsResult.data ?? []).map((row) => ({
        Name: row.full_name,
        USN: row.usn,
        Purpose: purposes.get(row.purpose_id) ?? "Other",
        Detail: row.purpose_detail,
        Visited: row.visited_at,
      }));
    }
    case "rooms": {
      const { data } = await supabase
        .from("room_sessions")
        .select("id, room_id, student_directory_id, started_at, ended_at, force_closed_reason");
      return (data ?? []).map((row) => ({
        Session: row.id,
        Room: row.room_id,
        Student: row.student_directory_id,
        Started: row.started_at,
        Ended: row.ended_at,
        ForceClosedReason: row.force_closed_reason,
      }));
    }
    default:
      return [];
  }
}
