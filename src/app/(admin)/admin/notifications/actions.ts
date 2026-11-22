"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePeAdmin } from "@/lib/auth/session";
import { dispatchEmailBatch } from "@/lib/email/dispatch";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/types/domain";

const emailBatchSchema = z.object({ emailAnnouncementId: z.string().uuid() });

function refreshQueue() {
  revalidatePath("/admin/notifications");
  revalidatePath("/admin/announcements");
  revalidatePath("/dashboard");
}

export async function sendNextEmailBatch(input: z.infer<typeof emailBatchSchema>): Promise<ActionState> {
  await requirePeAdmin();
  const parsed = emailBatchSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: "Choose a valid email queue." };

  // dispatchEmailBatch clamps the batch size to 25 and handles claim, per-recipient
  // results and completion through the typed RPCs.
  const result = await dispatchEmailBatch(parsed.data.emailAnnouncementId, 25);
  refreshQueue();
  return {
    status: result.ok ? "success" : "error",
    message: result.message,
  };
}

export async function retryFailedEmails(input: z.infer<typeof emailBatchSchema>): Promise<ActionState> {
  await requirePeAdmin();
  const parsed = emailBatchSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: "Choose a valid email queue." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_requeue_failed_emails", {
    p_email_announcement_id: parsed.data.emailAnnouncementId,
  });
  if (error) return { status: "error", message: error.message || "Failed messages could not be requeued." };

  refreshQueue();
  const count = typeof data === "number" ? data : 0;
  return {
    status: "success",
    message: count > 0 ? `${count} failed message${count === 1 ? "" : "s"} requeued (max three attempts).` : "No retryable failures in this queue.",
  };
}
