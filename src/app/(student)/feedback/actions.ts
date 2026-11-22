"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { feedbackReplySchema, feedbackRequestSchema } from "@/lib/validations/phase3";
import type { ActionState } from "@/types/domain";

function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Check the form and try again.";
}

export async function submitFeedback(input: {
  subject: string;
  category: "suggestion" | "complaint" | "equipment_request" | "equipment_damage" | "facility_issue" | "sports_activity_request" | "attendance_correction" | "other";
  description: string;
  preferredResponse: "in_app" | "email" | "either";
  attachmentFileId?: string;
}): Promise<ActionState & { requestId?: string }> {
  await requireUser();
  const parsed = feedbackRequestSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: firstIssue(parsed.error) };

  const data = parsed.data;
  const supabase = await createClient();
  const { data: created, error } = await supabase.rpc("student_submit_feedback", {
    p_data: {
      subject: data.subject,
      category: data.category,
      description: data.description,
      preferred_response: data.preferredResponse,
      attachment_file_id: data.attachmentFileId ?? "",
    },
  });
  if (error) return { status: "error", message: error.message || "Your request could not be submitted." };

  const requestId = created?.[0]?.id;
  revalidatePath("/feedback");
  revalidatePath("/my-feedback");
  revalidatePath("/dashboard");
  revalidatePath("/admin/feedback");
  return {
    status: "success",
    message: "Request submitted. The PE department will review it.",
    requestId,
  };
}

export async function attachFeedbackAttachment(requestId: string, fileId: string): Promise<ActionState> {
  await requireUser();
  if (!z.string().uuid().safeParse(requestId).success || !z.string().uuid().safeParse(fileId).success) {
    return { status: "error", message: "Choose a valid request and uploaded file." };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("student_attach_phase3_file", {
    p_parent_type: "feedback_attachment",
    p_parent_id: requestId,
    p_file_id: fileId,
  });
  if (error) return { status: "error", message: error.message || "The attachment could not be linked." };
  revalidatePath("/feedback");
  revalidatePath("/my-feedback");
  return { status: "success", message: "Attachment linked to your request." };
}

export async function replyFeedback(input: {
  requestId: string;
  body: string;
}): Promise<ActionState> {
  await requireUser();
  const parsed = feedbackReplySchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: firstIssue(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.rpc("student_reply_feedback", {
    p_request_id: parsed.data.requestId,
    p_body: parsed.data.body,
  });
  if (error) return { status: "error", message: error.message || "Your reply could not be sent." };

  revalidatePath(`/my-feedback/${parsed.data.requestId}`);
  revalidatePath("/my-feedback");
  revalidatePath(`/admin/feedback/${parsed.data.requestId}`);
  revalidatePath("/admin/feedback");
  return { status: "success", message: "Reply added to the thread." };
}
