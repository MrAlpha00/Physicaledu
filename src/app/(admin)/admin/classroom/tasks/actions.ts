"use server";

import { revalidatePath } from "next/cache";
import { requirePeAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { classTaskSchema, type ClassTaskInput } from "@/lib/validations/phase2";
import type { ActionState } from "@/types/domain";
import type { TaskSubmissionStatus } from "@/types/database";


function refreshTasks() {
  revalidatePath("/admin/classroom/tasks");
  revalidatePath("/admin/dashboard");
  revalidatePath("/tasks");
  revalidatePath("/dashboard");
}

export async function saveClassTask(input: ClassTaskInput): Promise<ActionState> {
  await requirePeAdmin();
  const parsed = classTaskSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Check the task details and try again.",
    };
  }
  const values = parsed.data;
  if (new Date(values.dueAt) <= new Date(values.startsAt)) {
    return { status: "error", message: "The deadline must be after the start date." };
  }
  if (!values.allowText && !values.allowFiles && !values.allowLinks) {
    return { status: "error", message: "Enable at least one submission method." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_save_class_task", {
    p_task_id: values.id || "00000000-0000-0000-0000-000000000000",
    p_title: values.title,
    p_description: values.description || "",
    p_category: values.category || "general",
    p_starts_at: new Date(values.startsAt).toISOString(),
    p_due_at: new Date(values.dueAt).toISOString(),
    p_priority: values.priority,
    p_instructions: values.instructions || null,
    p_submission_requirements: values.submissionRequirements || null,
    p_allow_text: values.allowText,
    p_allow_files: values.allowFiles,
    p_allow_links: values.allowLinks,
    p_max_file_size_bytes: values.maxFileSizeBytes,
    p_allowed_file_types: values.allowedFileTypes,
    p_max_files: values.maxFiles,
    p_status: values.status,
    p_audiences: values.audiences.map((audience) => ({
      audience_type: audience.audience_type,
      department_id: audience.department_id || null,
      semester: audience.semester ?? null,
      student_directory_id: audience.student_directory_id || null,
    })),
  });

  if (error) {
    return { status: "error", message: error.message || "Task could not be saved." };
  }
  refreshTasks();
  return {
    status: "success",
    message: values.status === "published" ? "Task published." : "Task saved.",
  };
}

export async function reviewTaskSubmission(
  submissionId: string,
  status: TaskSubmissionStatus,
  feedback: string,
): Promise<ActionState> {
  await requirePeAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_review_task_submission", {
    p_submission_id: submissionId,
    p_status: status,
    p_feedback: feedback || null,
  });
  if (error) {
    return { status: "error", message: error.message || "Review could not be saved." };
  }
  refreshTasks();
  return { status: "success", message: "Submission review saved." };
}
