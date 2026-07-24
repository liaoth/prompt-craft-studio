import { ApiError } from "@/lib/server/http";

type RateLimitState = {
  count: number;
  resetAt: number;
};

type RateLimitOptions = {
  maxAttempts: number;
  windowMs: number;
  code?: string;
  message?: string;
};

const buckets = new Map<string, RateLimitState>();
const DEFAULT_WINDOW_MS = 60_000;
const MAX_BUCKETS = 10_000;
let lastSweepAt = 0;

export const RATE_LIMIT_PRESET = {
  generate: { maxAttempts: 30, windowMs: DEFAULT_WINDOW_MS },
  translate: { maxAttempts: 60, windowMs: DEFAULT_WINDOW_MS },
  test: { maxAttempts: 20, windowMs: DEFAULT_WINDOW_MS },
  submission: { maxAttempts: 30, windowMs: DEFAULT_WINDOW_MS },
} as const;

export function rateLimitKey(...parts: string[]): string {
  return parts.join("|");
}

export function enforceRateLimit(
  key: string,
  options: Partial<RateLimitOptions> = {},
): void {
  const { maxAttempts, windowMs, code, message } = {
    ...RATE_LIMIT_PRESET.test,
    ...options,
  };
  const now = Date.now();

  if (buckets.size >= MAX_BUCKETS || now - lastSweepAt >= DEFAULT_WINDOW_MS) {
    for (const [bucketKey, bucket] of buckets) {
      if (now >= bucket.resetAt) buckets.delete(bucketKey);
    }
    lastSweepAt = now;
  }

  const current = buckets.get(key);
  if (!current || now >= current.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }

  if (current.count >= maxAttempts) {
    const waitSeconds = Math.max(
      1,
      Math.ceil((current.resetAt - now) / 1000),
    );
    throw new ApiError(
      429,
      message ?? `请求过于频繁，请在 ${waitSeconds} 秒后重试。`,
      code ?? "RATE_LIMIT_EXCEEDED",
    );
  }

  current.count += 1;
}

export function clearRateLimitForTest(): void {
  buckets.clear();
  lastSweepAt = 0;
}
