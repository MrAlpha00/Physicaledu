import { afterEach, describe, expect, it, vi } from "vitest";
import { isTurnstileConfigured, verifyTurnstileToken } from "@/lib/security/turnstile";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Turnstile verification", () => {
  it("is optional and fails closed when configured without a token", async () => {
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "");
    vi.stubEnv("TURNSTILE_SECRET_KEY", "");
    expect(isTurnstileConfigured()).toBe(false);
    await expect(verifyTurnstileToken(null)).resolves.toBe(true);

    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "site-key");
    vi.stubEnv("TURNSTILE_SECRET_KEY", "secret-key");
    expect(isTurnstileConfigured()).toBe(true);
    await expect(verifyTurnstileToken(null)).resolves.toBe(false);
  });

  it("accepts only a successful siteverify response", async () => {
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "site-key");
    vi.stubEnv("TURNSTILE_SECRET_KEY", "secret-key");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });
    vi.stubGlobal("fetch", fetchMock);
    await expect(verifyTurnstileToken("token", "127.0.0.1")).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledOnce();

    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ success: false }) });
    await expect(verifyTurnstileToken("token")).resolves.toBe(false);
  });
});
