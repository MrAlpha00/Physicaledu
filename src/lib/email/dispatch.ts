import { createClient } from "@/lib/supabase/server";
import { buildAnnouncementHtml, getResendConfigurationWarning, sendResendEmail } from "@/lib/email/resend";

export interface DispatchResult {
  ok: boolean;
  message: string;
  claimed: number;
  accepted: number;
  failed: number;
  capacityReached: boolean;
}

/**
 * Sends at most `batchSize` individually addressed messages. The database RPC
 * claims recipients with row locks and enforces the Asia/Kolkata daily cap, so
 * repeated clicks cannot double-send or exceed the configured limit.
 */
export async function dispatchEmailBatch(
  emailAnnouncementId: string,
  batchSize = 25,
): Promise<DispatchResult> {
  const warning = getResendConfigurationWarning();
  if (warning) {
    return { ok: false, message: warning, claimed: 0, accepted: 0, failed: 0, capacityReached: false };
  }

  const supabase = await createClient();
  const { data: batch, error } = await supabase.rpc("admin_claim_email_batch", {
    p_email_announcement_id: emailAnnouncementId,
    p_batch_size: Math.min(Math.max(batchSize, 1), 25),
  });
  if (error) {
    return { ok: false, message: error.message, claimed: 0, accepted: 0, failed: 0, capacityReached: false };
  }

  const recipients = batch ?? [];
  if (recipients.length === 0) {
    await supabase.rpc("admin_complete_email_announcement", { p_email_announcement_id: emailAnnouncementId });
    return {
      ok: true,
      message: "No recipients are eligible right now. The daily cap may have been reached or the queue is empty.",
      claimed: 0,
      accepted: 0,
      failed: 0,
      capacityReached: true,
    };
  }

  let accepted = 0;
  let failed = 0;

  for (const recipient of recipients) {
    const result = await sendResendEmail({
      to: recipient.email,
      subject: recipient.title,
      text: recipient.body,
      html: buildAnnouncementHtml(recipient.title, recipient.body, recipient.link),
    });

    await supabase.rpc("admin_record_email_result", {
      p_recipient_id: recipient.recipient_id,
      p_provider_status: result.ok ? "accepted" : "failed",
      p_provider_message_id: result.messageId,
      p_error: result.error,
    });

    if (result.ok) accepted += 1;
    else failed += 1;
  }

  await supabase.rpc("admin_complete_email_announcement", { p_email_announcement_id: emailAnnouncementId });

  return {
    ok: failed === 0,
    message:
      failed === 0
        ? `${accepted} message${accepted === 1 ? "" : "s"} accepted by Resend. Delivery is tracked separately by webhook.`
        : `${accepted} accepted, ${failed} failed. Failed messages can be retried up to three attempts.`,
    claimed: recipients.length,
    accepted,
    failed,
    capacityReached: recipients.length < batchSize,
  };
}
