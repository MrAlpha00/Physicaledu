"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { describeTaskError } from "@/lib/operations/tasks";
import { taskSubmissionSchema } from "@/lib/validations/phase2";
import type { ActionState } from "@/types/domain";

export async function saveTaskSubmission(input: {
  taskId: string;
  textContent: string;
  linkUrl: string;
  submit: boolean;
}): Promise<ActionState> {
  await requireUser();
  const parsed = taskSubmissionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Check your submission and try again.",
    };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("student_save_task_submission", {
    p_task_id: parsed.data.taskId,
    p_text_content: parsed.data.textContent || null,
    p_link_url: parsed.data.linkUrl || null,
    p_submit: parsed.data.submit,
  });
  if (error) return { status: "error", message: describeTaskError(error.message) };

  revalidatePath("/tasks");
  revalidatePath(`/tasks/${parsed.data.taskId}`);
  revalidatePath("/dashboard");
  revalidatePath("/admin/classroom/tasks");
  return {
    status: "success",
    message: parsed.data.submit ? "Submission recorded." : "Draft saved.",
  };
}
