/**
 * Server-only Cloudflare Turnstile verification. The widget is optional: when
 * keys are absent the public forms fall back to a honeypot and rate limiting.
 */
const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export function isTurnstileConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && process.env.TURNSTILE_SECRET_KEY,
  );
}

export async function verifyTurnstileToken(
  token: string | null | undefined,
  remoteIp?: string,
): Promise<boolean> {
  if (!isTurnstileConfigured()) return true;
  if (!token) return false;

  try {
    const body = new URLSearchParams({
      secret: process.env.TURNSTILE_SECRET_KEY ?? "",
      response: token,
    });
    if (remoteIp) body.set("remoteip", remoteIp);

    const response = await fetch(VERIFY_URL, {
      method: "POST",
      body,
      signal: AbortSignal.timeout(6_000),
      cache: "no-store",
    });
    if (!response.ok) return false;
    const result = (await response.json()) as { success?: boolean };
    return result.success === true;
  } catch {
    return false;
  }
}
