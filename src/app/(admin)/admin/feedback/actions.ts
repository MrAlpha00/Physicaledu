"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePeAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { canFeedbackTransition } from "@/lib/operations/phase3";
import { feedbackUpdateSchema } from "@/lib/validations/phase3";
import type { ActionState } from "@/types/domain";

function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Check the form and try again.";
}

export async function updateFeedback(input: {
  requestId: string;
  status: "submitted" | "under_review" | "in_progress" | "waiting_for_student" | "resolved" | "rejected" | "closed";
  priority?: "low" | "normal" | "high" | "urgent";
  response?: string;
  internalNote?: string;
}): Promise<ActionState> {
  await requirePeAdmin();
  const parsed = feedbackUpdateSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: firstIssue(parsed.error) };

  const data = parsed.data;
  const supabase = await createClient();
  const { data: current } = await supabase
    .from("feedback_requests")
    .select("status")
    .eq("id", data.requestId)
    .maybeSingle();
  if (!current) return { status: "error", message: "Feedback request not found." };
  if (!canFeedbackTransition(current.status, data.status)) {
    return { status: "error", message: `Cannot change a ${current.status.replaceAll("_", " ")} request.` };
  }

  const { error } = await supabase.rpc("admin_update_feedback", {
    p_request_id: data.requestId,
    p_status: data.status,
    p_priority: data.priority ?? null,
    p_response: data.response || null,
    p_internal_note: data.internalNote || null,
  });
  if (error) return { status: "error", message: error.message || "The feedback request could not be updated." };

  revalidatePath("/admin/feedback");
  revalidatePath(`/admin/feedback/${data.requestId}`);
  revalidatePath("/my-feedback");
  revalidatePath(`/my-feedback/${data.requestId}`);
  revalidatePath("/dashboard");
  return { status: "success", message: "Status, response and notes saved." };
}
