/**
 * Small in-memory sliding-window limiter for public form abuse. Serverless
 * deployments have per-instance limits; the trusted database RPC and honeypot
 * remain the primary controls.
 */
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

export class SlidingWindowRateLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  check(key: string, now: number = Date.now()): RateLimitResult {
    const cutoff = now - this.windowMs;
    const existing = (this.hits.get(key) ?? []).filter((timestamp) => timestamp > cutoff);

    if (existing.length >= this.limit) {
      this.hits.set(key, existing);
      return {
        allowed: false,
        remaining: 0,
        retryAfterMs: Math.max(1, existing[0] + this.windowMs - now),
      };
    }

    existing.push(now);
    this.hits.set(key, existing);
    return { allowed: true, remaining: this.limit - existing.length, retryAfterMs: 0 };
  }
}

export const visitorRateLimiter = new SlidingWindowRateLimiter(6, 60_000);
