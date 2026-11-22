import { cache } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { displaySubmissionStatus } from "@/lib/operations/tasks";
import type { Database } from "@/types/database";
import type {
  ClassTaskView,
  MyTaskView,
  StoredFileView,
  TaskAudienceInput,
  TaskSubmissionView,
} from "@/types/domain";

type TaskRow = Database["public"]["Tables"]["class_tasks"]["Row"];
type AudienceRow = Database["public"]["Tables"]["task_audiences"]["Row"];
type SubmissionRow = Database["public"]["Tables"]["task_submissions"]["Row"];
type FileRow = Database["public"]["Tables"]["stored_files"]["Row"];

function toTaskView(
  task: TaskRow,
  audiences: TaskAudienceInput[],
  referenceCount: number,
): ClassTaskView {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    category: task.category,
    startsAt: task.starts_at,
    dueAt: task.due_at,
    priority: task.priority,
    instructions: task.instructions,
    submissionRequirements: task.submission_requirements,
    allowText: task.allow_text,
    allowFiles: task.allow_files,
    allowLinks: task.allow_links,
    maxFileSizeBytes: task.max_file_size_bytes,
    allowedFileTypes: task.allowed_file_types,
    maxFiles: task.max_files,
    status: task.status,
    publishedAt: task.published_at,
    audiences,
    referenceCount,
  };
}

function toAudienceInput(row: AudienceRow): TaskAudienceInput {
  return {
    audience_type: row.audience_type,
    department_id: row.department_id,
    semester: row.semester,
    student_directory_id: row.student_directory_id,
  };
}

export function toStoredFileView(file: FileRow): StoredFileView {
  return {
    id: file.id,
    objectKey: file.object_key,
    originalFilename: file.original_filename,
    contentType: file.content_type,
    byteSize: file.byte_size,
    parentType: file.parent_type,
    parentId: file.parent_id,
    uploadStatus: file.upload_status,
    createdAt: file.created_at,
  };
}

export const getAdminTasks = cache(async (): Promise<ClassTaskView[]> => {
  const supabase = await createClient();
  const [{ data: tasks }, { data: audiences }, { data: files }] = await Promise.all([
    supabase.from("class_tasks").select("*").order("created_at", { ascending: false }).limit(100),
    supabase.from("task_audiences").select("*"),
    supabase
      .from("stored_files")
      .select("parent_id")
      .eq("parent_type", "task_reference")
      .eq("upload_status", "confirmed"),
  ]);

  const audienceMap = new Map<string, TaskAudienceInput[]>();
  audiences?.forEach((row) => {
    audienceMap.set(row.task_id, [...(audienceMap.get(row.task_id) ?? []), toAudienceInput(row)]);
  });
  const fileCounts = new Map<string, number>();
  files?.forEach((file) => {
    fileCounts.set(file.parent_id, (fileCounts.get(file.parent_id) ?? 0) + 1);
  });

  return (tasks ?? []).map((task) =>
    toTaskView(task, audienceMap.get(task.id) ?? [], fileCounts.get(task.id) ?? 0),
  );
});

export const getAdminTask = cache(async (taskId: string): Promise<ClassTaskView | null> => {
  const supabase = await createClient();
  const [{ data: task }, { data: audiences }, { data: files }] = await Promise.all([
    supabase.from("class_tasks").select("*").eq("id", taskId).maybeSingle(),
    supabase.from("task_audiences").select("*").eq("task_id", taskId),
    supabase
      .from("stored_files")
      .select("id")
      .eq("parent_type", "task_reference")
      .eq("parent_id", taskId)
      .eq("upload_status", "confirmed"),
  ]);
  if (!task) return null;
  return toTaskView(
    task,
    (audiences ?? []).map(toAudienceInput),
    files?.length ?? 0,
  );
});

export const getAdminTaskSubmissions = cache(
  async (taskId?: string): Promise<TaskSubmissionView[]> => {
    const supabase = await createClient();
    let submissionQuery = supabase.from("task_submissions").select("*");
    if (taskId) submissionQuery = submissionQuery.eq("task_id", taskId);
    const { data: submissions } = await submissionQuery.order("created_at", { ascending: false }).limit(300);
    if (!submissions?.length) return [];

    const taskIds = [...new Set(submissions.map((row) => row.task_id))];
    const directoryIds = [...new Set(submissions.map((row) => row.student_directory_id))];
    const { data: tasks } = await supabase
      .from("class_tasks")
      .select("id, title, due_at")
      .in("id", taskIds);
    const { data: directory } = await supabase
      .from("student_directory")
      .select("id, full_name, usn, department_id")
      .in("id", directoryIds);
    const { data: departments } = await supabase
      .from("departments")
      .select("id, department_code");
    const { data: files } = await supabase
      .from("stored_files")
      .select("parent_id")
      .eq("parent_type", "task_submission")
      .eq("upload_status", "confirmed");

    const taskMap = new Map((tasks ?? []).map((row) => [row.id, row]));
    const directoryMap = new Map((directory ?? []).map((row) => [row.id, row]));
    const departmentMap = new Map((departments ?? []).map((row) => [row.id, row.department_code]));
    const fileCounts = new Map<string, number>();
    files?.forEach((file) => {
      fileCounts.set(file.parent_id, (fileCounts.get(file.parent_id) ?? 0) + 1);
    });

    return submissions.flatMap((submission) => {
      const task = taskMap.get(submission.task_id);
      const student = directoryMap.get(submission.student_directory_id);
      if (!task || !student) return [];
      return [
        {
          id: submission.id,
          taskId: submission.task_id,
          taskTitle: task.title,
          dueAt: task.due_at,
          studentDirectoryId: submission.student_directory_id,
          fullName: student.full_name,
          usn: student.usn,
          departmentCode: departmentMap.get(student.department_id) ?? "—",
          status: submission.status,
          displayStatus: displaySubmissionStatus(submission.status, task.due_at),
          textContent: submission.text_content,
          linkUrl: submission.link_url,
          submittedAt: submission.submitted_at,
          reviewedAt: submission.reviewed_at,
          feedback: submission.feedback,
          fileCount: fileCounts.get(submission.id) ?? 0,
        },
      ];
    });
  },
);

export const getMyTasks = cache(async (user: User): Promise<MyTaskView[]> => {
  const supabase = await createClient();
  const [{ data: tasks }, { data: submissions }] = await Promise.all([
    supabase
      .from("class_tasks")
      .select("*")
      .eq("status", "published")
      .order("due_at", { ascending: true })
      .limit(100),
    supabase.from("task_submissions").select("*").eq("user_id", user.id),
  ]);

  const submissionMap = new Map<string, SubmissionRow>(
    (submissions ?? []).map((row) => [row.task_id, row]),
  );

  return (tasks ?? []).map((task) => {
    const submission = submissionMap.get(task.id);
    return {
      ...toTaskView(task, [], 0),
      submission: submission
        ? {
            status: submission.status,
            displayStatus: displaySubmissionStatus(submission.status, task.due_at),
            textContent: submission.text_content,
            linkUrl: submission.link_url,
            submittedAt: submission.submitted_at,
            reviewedAt: submission.reviewed_at,
            feedback: submission.feedback,
          }
        : null,
    };
  });
});

export const getMyTask = cache(async (taskId: string): Promise<MyTaskView | null> => {
  const supabase = await createClient();
  const { data: task } = await supabase
    .from("class_tasks")
    .select("*")
    .eq("id", taskId)
    .eq("status", "published")
    .maybeSingle();
  if (!task) return null;

  const [{ data: submission }, { data: files }] = await Promise.all([
    supabase.from("task_submissions").select("*").eq("task_id", taskId).maybeSingle(),
    supabase
      .from("stored_files")
      .select("*")
      .eq("parent_type", "task_reference")
      .eq("parent_id", taskId)
      .eq("upload_status", "confirmed"),
  ]);

  return {
    ...toTaskView(task, [], files?.length ?? 0),
    submission: submission
      ? {
          status: submission.status,
          displayStatus: displaySubmissionStatus(submission.status, task.due_at),
          textContent: submission.text_content,
          linkUrl: submission.link_url,
          submittedAt: submission.submitted_at,
          reviewedAt: submission.reviewed_at,
          feedback: submission.feedback,
        }
      : null,
  };
});

export const getFilesForParent = cache(
  async (parentType: "task_reference" | "task_submission", parentId: string): Promise<StoredFileView[]> => {
    const supabase = await createClient();
    const { data } = await supabase
      .from("stored_files")
      .select("*")
      .eq("parent_type", parentType)
      .eq("parent_id", parentId)
      .eq("upload_status", "confirmed")
      .order("created_at", { ascending: true });
    return (data ?? []).map(toStoredFileView);
  },
);
