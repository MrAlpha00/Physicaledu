import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { FeedbackReplyView, FeedbackRequestView } from "@/types/domain";

async function mapRequests(
  rows: Array<{
    id: string;
    student_directory_id: string;
    subject: string;
    category: FeedbackRequestView["category"];
    description: string;
    status: FeedbackRequestView["status"];
    priority: FeedbackRequestView["priority"];
    preferred_response: FeedbackRequestView["preferredResponse"];
    created_at: string;
    updated_at: string;
    resolved_at: string | null;
  }>,
): Promise<FeedbackRequestView[]> {
  if (rows.length === 0) return [];
  const supabase = await createClient();
  const studentIds = [...new Set(rows.map((row) => row.student_directory_id))];
  const [studentsResult, repliesResult, rolesResult] = await Promise.all([
    supabase.from("student_directory").select("id, full_name, department_id").in("id", studentIds),
    supabase.from("feedback_replies").select("id, request_id, author_id, created_at").in(
      "request_id",
      rows.map((row) => row.id),
    ),
    supabase.from("user_roles").select("user_id").eq("role", "pe_admin"),
  ]);

  const studentNames = new Map((studentsResult.data ?? []).map((row) => [row.id, row.full_name]));
  const departmentIds = [...new Set((studentsResult.data ?? []).map((row) => row.department_id))];
  const { data: departments } = departmentIds.length
    ? await supabase.from("departments").select("id, department_name").in("id", departmentIds)
    : { data: [] };
  const departmentNames = new Map((departments ?? []).map((row) => [row.id, row.department_name]));
  const adminIds = new Set((rolesResult.data ?? []).map((row) => row.user_id));

  const replyCounts = new Map<string, number>();
  const latestAuthor = new Map<string, string | null>();
  (repliesResult.data ?? []).forEach((reply) => {
    replyCounts.set(reply.request_id, (replyCounts.get(reply.request_id) ?? 0) + 1);
    const current = latestAuthor.get(reply.request_id);
    if (!current || new Date(reply.created_at) > new Date(current)) {
      latestAuthor.set(reply.request_id, reply.author_id);
    }
  });

  return rows.map((row) => {
    const departmentId = (studentsResult.data ?? []).find((student) => student.id === row.student_directory_id)?.department_id;
    const latest = latestAuthor.get(row.id) ?? null;
    return {
      id: row.id,
      subject: row.subject,
      category: row.category,
      description: row.description,
      status: row.status,
      priority: row.priority,
      preferredResponse: row.preferred_response,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      resolvedAt: row.resolved_at,
      studentName: studentNames.get(row.student_directory_id) ?? "Student",
      departmentName: departmentId ? departmentNames.get(departmentId) ?? null : null,
      replyCount: replyCounts.get(row.id) ?? 0,
      unreadForAdmin: Boolean(latest && !adminIds.has(latest)),
    };
  });
}

export const getAdminFeedbackRequests = cache(async (): Promise<FeedbackRequestView[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("feedback_requests")
    .select("id, student_directory_id, subject, category, description, status, priority, preferred_response, created_at, updated_at, resolved_at")
    .order("updated_at", { ascending: false })
    .limit(500);
  return mapRequests(data ?? []);
});

export const getMyFeedbackRequests = cache(async (): Promise<FeedbackRequestView[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("feedback_requests")
    .select("id, student_directory_id, subject, category, description, status, priority, preferred_response, created_at, updated_at, resolved_at")
    .order("created_at", { ascending: false })
    .limit(200);
  return mapRequests(data ?? []);
});

export async function getFeedbackThread(requestId: string, currentUserId: string | null): Promise<FeedbackReplyView[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("feedback_replies")
    .select("id, body, is_internal, created_at, author_id, request_id")
    .eq("request_id", requestId)
    .order("created_at", { ascending: true });
  if (!data?.length) return [];

  const authorIds = [...new Set(data.map((row) => row.author_id).filter((value): value is string => Boolean(value)))];
  const { data: authors } = authorIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", authorIds)
    : { data: [] };
  const names = new Map((authors ?? []).map((row) => [row.id, row.full_name]));

  return data.map((row) => ({
    id: row.id,
    body: row.body,
    isInternal: row.is_internal,
    createdAt: row.created_at,
    authorName: row.author_id ? names.get(row.author_id) ?? "PE Department" : "PE Department",
    isMine: Boolean(currentUserId && row.author_id === currentUserId),
  }));
}

export const getPendingFeedbackCount = cache(async (): Promise<number> => {
  const requests = await getAdminFeedbackRequests();
  return requests.filter((request) => !["resolved", "rejected", "closed"].includes(request.status)).length;
});
