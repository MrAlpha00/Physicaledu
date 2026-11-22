import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildAnnouncementHtml,
  getResendConfigurationWarning,
  isResendConfigured,
  sendResendEmail,
  verifyResendWebhook,
} from "@/lib/email/resend";
import { toCsv } from "@/lib/export/phase3";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Resend configuration", () => {
  it("works in-app and fails closed when email is not configured", () => {
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("RESEND_FROM_EMAIL", "");
    expect(isResendConfigured()).toBe(false);
    expect(getResendConfigurationWarning()).toContain("in-app notifications still work");
  });

  it("sends one individually addressed message with no CC field", async () => {
    vi.stubEnv("RESEND_API_KEY", "test-key");
    vi.stubEnv("RESEND_FROM_EMAIL", "pe@example.edu");
    expect(isResendConfigured()).toBe(true);
    expect(getResendConfigurationWarning()).toBeNull();

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: "msg_123" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendResendEmail({
      to: "student@example.edu",
      subject: "PE notice",
      text: "Practice starts at 4 PM.",
    });
    expect(result).toEqual({ ok: true, messageId: "msg_123", error: null, status: 200 });

    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    const payload = JSON.parse(String(options.body)) as Record<string, unknown>;
    expect(payload.to).toEqual(["student@example.edu"]);
    expect(payload.from).toBe("pe@example.edu");
    expect(payload).not.toHaveProperty("cc");
    expect(payload).not.toHaveProperty("bcc");
  });

  it("reports provider rejection without claiming delivery", async () => {
    vi.stubEnv("RESEND_API_KEY", "test-key");
    vi.stubEnv("RESEND_FROM_EMAIL", "pe@example.edu");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        json: async () => ({ message: "Rate limit exceeded" }),
      }),
    );
    const result = await sendResendEmail({ to: "student@example.edu", subject: "PE notice", text: "Hello" });
    expect(result.ok).toBe(false);
    expect(result.messageId).toBeNull();
    expect(result.error).toContain("Rate limit");
  });

  it("escapes announcement content in generated HTML", () => {
    const html = buildAnnouncementHtml("<script>x</script>", "Meet at & greet", "https://example.com/a?b=1&c=2");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&amp;");
  });
});

describe("Resend webhook verification", () => {
  it("rejects unconfigured or incomplete signatures", async () => {
    vi.stubEnv("RESEND_WEBHOOK_SECRET", "");
    await expect(
      verifyResendWebhook("{}", { id: "id", timestamp: "1", signature: "sig" }),
    ).resolves.toBeNull();

    vi.stubEnv("RESEND_WEBHOOK_SECRET", "test-secret");
    await expect(
      verifyResendWebhook("{}", { id: null, timestamp: "1", signature: "sig" }),
    ).resolves.toBeNull();
    await expect(
      verifyResendWebhook("{}", { id: "id", timestamp: "bad", signature: "sig" }),
    ).resolves.toBeNull();
  });
});

describe("Phase 3 delivery privacy", () => {
  it("keeps every required server secret out of the public environment template", () => {
    const example = readFileSync(resolve(process.cwd(), ".env.example"), "utf8");
    expect(example).toContain("RESEND_API_KEY=");
    expect(example).toContain("RESEND_FROM_EMAIL=");
    expect(example).toContain("RESEND_WEBHOOK_SECRET=");
    expect(example).toContain("SUPABASE_SECRET_KEY=");
    expect(example).not.toContain("NEXT_PUBLIC_RESEND_API_KEY");
  });

  it("maps provider events to accepted versus delivered in the webhook route", () => {
    const route = readFileSync(
      resolve(process.cwd(), "src/app/api/webhooks/resend/route.ts"),
      "utf8",
    );
    for (const type of ["email.delivered", "email.bounced", "email.complained", "email.failed"]) {
      expect(route).toContain(`"${type}"`);
    }
    expect(route).toContain("status: 503");
    expect(route).toContain("status: 400");
    expect(route).toContain("createAdminClient()");
  });
});

describe("Phase 3 CSV export", () => {
  it("escapes commas, quotes and newlines", () => {
    const csv = toCsv([
      { Name: 'Doe, Jane', Note: 'Said "yes"\nagain', Count: 2 },
      { Name: "Single", Note: null, Count: 0 },
    ]);
    expect(csv).toContain('"Doe, Jane"');
    expect(csv).toContain('"Said ""yes""\nagain"');
    expect(csv.split("\r\n")).toHaveLength(3);
  });
});
