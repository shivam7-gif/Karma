export interface RateLimiter {
  checkLimit(key: string, limit: number, windowSeconds: number): Promise<{ allowed: boolean; remaining: number; resetMs: number }>;
}

interface WindowBucket {
  timestamps: number[];
}

/**
 * Sliding-window in-memory rate limiter.
 * NOTE: For distributed or multi-instance deployments, implement a Postgres- or Redis-backed
 * RateLimiter adapter before scaling horizontally.
 */
export class InMemoryRateLimiter implements RateLimiter {
  private buckets = new Map<string, WindowBucket>();

  async checkLimit(
    key: string,
    limit: number,
    windowSeconds: number
  ): Promise<{ allowed: boolean; remaining: number; resetMs: number }> {
    const now = Date.now();
    const windowMs = windowSeconds * 1000;
    const windowStart = now - windowMs;

    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = { timestamps: [] };
      this.buckets.set(key, bucket);
    }

    // Filter out timestamps outside the sliding window
    bucket.timestamps = bucket.timestamps.filter((ts) => ts > windowStart);

    if (bucket.timestamps.length >= limit) {
      const oldest = bucket.timestamps[0] ?? now;
      const resetMs = Math.max(0, oldest + windowMs - now);
      return {
        allowed: false,
        remaining: 0,
        resetMs,
      };
    }

    bucket.timestamps.push(now);
    return {
      allowed: true,
      remaining: limit - bucket.timestamps.length,
      resetMs: windowMs,
    };
  }

  // Cleanup old inactive buckets to prevent memory leak
  cleanup(): void {
    const now = Date.now();
    for (const [key, bucket] of this.buckets.entries()) {
      bucket.timestamps = bucket.timestamps.filter((ts) => now - ts < 3600000);
      if (bucket.timestamps.length === 0) {
        this.buckets.delete(key);
      }
    }
  }
}

export const defaultRateLimiter = new InMemoryRateLimiter();
