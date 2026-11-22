import { Webhook } from "svix";

/**
 * Server-only Resend integration. The API key and webhook secret are never
 * imported from client code or exposed through environment variables prefixed
 * with NEXT_PUBLIC_.
 */

const RESEND_API_URL = "https://api.resend.com/emails";

export interface ResendEmailInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
}

export interface ResendSendResult {
  ok: boolean;
  messageId: string | null;
  error: string | null;
  status: number | null;
}

export function isResendConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL);
}

export function getResendConfigurationWarning(): string | null {
  if (isResendConfigured()) return null;
  return "Email announcements are not configured. Add RESEND_API_KEY and RESEND_FROM_EMAIL on the server; in-app notifications still work.";
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function buildAnnouncementHtml(title: string, body: string, link: string | null): string {
  const linkHtml = link
    ? `<p><a href="${escapeHtml(link)}" style="background:#C8F169;color:#101D2C;padding:12px 20px;text-decoration:none;font-weight:700;">Open in VARSITY PE</a></p>`
    : "";
  return [
    '<!doctype html><html><body style="margin:0;background:#F4F2E9;font-family:Arial,sans-serif;color:#101D2C;">',
    '<div style="max-width:640px;margin:0 auto;padding:32px;">',
    '<p style="font-size:12px;letter-spacing:0.18em;color:#3564E9;font-weight:700;">VARSITY PE DEPARTMENT</p>',
    `<h1 style="font-size:32px;line-height:1.1;margin:8px 0 20px;">${escapeHtml(title)}</h1>`,
    `<div style="font-size:16px;line-height:1.7;white-space:pre-wrap;">${escapeHtml(body)}</div>`,
    linkHtml,
    '<hr style="border:none;border-top:1px solid #d8d5c8;margin:28px 0 12px;">',
    '<p style="font-size:12px;color:#5d6875;">Sent only to students selected by the PE department. Please do not reply to this address.</p>',
    "</div></body></html>",
  ].join("");
}

export async function sendResendEmail(input: ResendEmailInput): Promise<ResendSendResult> {
  if (!isResendConfigured()) {
    return { ok: false, messageId: null, error: "Resend is not configured on the server.", status: null };
  }

  const apiKey = process.env.RESEND_API_KEY as string;
  const from = process.env.RESEND_FROM_EMAIL as string;

  try {
    const response = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: input.subject,
        text: input.text,
        html: input.html ?? buildAnnouncementHtml(input.subject, input.text, null),
        ...(input.replyTo ? { reply_to: input.replyTo } : {}),
      }),
      cache: "no-store",
    });

    const payload = (await response.json().catch(() => ({}))) as {
      id?: string;
      message?: string;
      name?: string;
    };

    if (!response.ok) {
      return {
        ok: false,
        messageId: null,
        error: payload.message ?? payload.name ?? `Resend returned HTTP ${response.status}.`,
        status: response.status,
      };
    }

    return { ok: true, messageId: payload.id ?? null, error: null, status: response.status };
  } catch (error) {
    return {
      ok: false,
      messageId: null,
      error: error instanceof Error ? error.message : "Resend request failed.",
      status: null,
    };
  }
}

export interface ResendWebhookEvent {
  id: string;
  type: string;
  data: {
    email_id?: string;
    recipient?: string;
  };
}

/**
 * Resend signs webhooks with Svix. If no secret is configured, the webhook is
 * rejected rather than trusted; accepted API responses are never counted as
 * delivered without a verified webhook.
 */
export async function verifyResendWebhook(
  rawBody: string,
  headers: { id: string | null; timestamp: string | null; signature: string | null },
): Promise<ResendWebhookEvent | null> {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret || !headers.id || !headers.timestamp || !headers.signature) return null;

  try {
    const webhook = new Webhook(secret);
    const payload = webhook.verify(rawBody, {
      "svix-id": headers.id,
      "svix-timestamp": headers.timestamp,
      "svix-signature": headers.signature,
    }) as ResendWebhookEvent;
    return payload;
  } catch {
    return null;
  }
}
