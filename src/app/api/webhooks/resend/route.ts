import { NextResponse, type NextRequest } from "next/server";
import { verifyResendWebhook } from "@/lib/email/resend";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const EVENT_TYPES: Record<string, string> = {
  "email.delivered": "delivered",
  "email.bounced": "bounced",
  "email.complained": "complained",
  "email.failed": "failed",
};

/** Resend signs webhooks with Svix; only verified events change delivery state. */
export async function POST(request: NextRequest) {
  if (!process.env.RESEND_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Webhook is not configured." }, { status: 503 });
  }

  const rawBody = await request.text();
  const event = await verifyResendWebhook(rawBody, {
    id: request.headers.get("svix-id"),
    timestamp: request.headers.get("svix-timestamp"),
    signature: request.headers.get("svix-signature"),
  });
  if (!event || !event.id || !event.type) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  const eventType = EVENT_TYPES[event.type];
  if (!eventType) {
    return NextResponse.json({ received: true, ignored: true });
  }

  const providerMessageId = event.data?.email_id;
  if (!providerMessageId) {
    return NextResponse.json({ error: "Missing provider message id." }, { status: 400 });
  }

  // Service role is required here: the webhook is unauthenticated and must not
  // expose or log recipient addresses. Only the message id and event metadata
  // are persisted through the typed RPC.
  try {
    const admin = createAdminClient();
    const { error } = await admin.rpc("record_email_provider_event", {
      p_provider_message_id: providerMessageId,
      p_event_type: eventType,
      p_provider_event_id: event.id,
      p_payload: { type: event.type, email_id: providerMessageId },
    });
    if (error) return NextResponse.json({ error: "Event could not be recorded." }, { status: 500 });
    return NextResponse.json({ received: true });
  } catch {
    return NextResponse.json({ error: "Event could not be recorded." }, { status: 500 });
  }
}
