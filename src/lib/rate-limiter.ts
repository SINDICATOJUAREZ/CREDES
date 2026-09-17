/**
 * In-memory sliding window rate limiter for protecting endpoints against brute force attacks.
 */

interface RateLimitRecord {
  count: number;
  firstAttemptTime: number;
  blockedUntil: number;
}

class RateLimiter {
  private records = new Map<string, RateLimitRecord>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Periodically clean up expired entries every 5 minutes
    if (typeof setInterval !== 'undefined') {
      this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
      if (this.cleanupInterval.unref) {
        this.cleanupInterval.unref();
      }
    }
  }

  /**
   * Checks if a request for the given key is allowed.
   * @param key Unique identifier (e.g. IP or IP+email)
   * @param maxAttempts Maximum failed attempts before blocking
   * @param windowSeconds Duration of the tracking window in seconds
   * @param blockDurationSeconds Duration to block if limit is exceeded
   */
  public check(
    key: string,
    maxAttempts = 5,
    windowSeconds = 15 * 60,
    blockDurationSeconds = 15 * 60
  ): { allowed: boolean; remainingAttempts: number; retryAfterSeconds: number } {
    const now = Date.now();
    const record = this.records.get(key);

    if (!record) {
      return { allowed: true, remainingAttempts: maxAttempts, retryAfterSeconds: 0 };
    }

    // If currently blocked
    if (record.blockedUntil > now) {
      const retryAfterSeconds = Math.ceil((record.blockedUntil - now) / 1000);
      return { allowed: false, remainingAttempts: 0, retryAfterSeconds };
    }

    // If window expired, reset
    if (now - record.firstAttemptTime > windowSeconds * 1000) {
      this.records.delete(key);
      return { allowed: true, remainingAttempts: maxAttempts, retryAfterSeconds: 0 };
    }

    // Check if limit exceeded
    if (record.count >= maxAttempts) {
      record.blockedUntil = now + blockDurationSeconds * 1000;
      const retryAfterSeconds = Math.ceil(blockDurationSeconds);
      return { allowed: false, remainingAttempts: 0, retryAfterSeconds };
    }

    return {
      allowed: true,
      remainingAttempts: Math.max(0, maxAttempts - record.count),
      retryAfterSeconds: 0,
    };
  }

  /**
   * Records a failed attempt for the given key.
   */
  public recordFailure(
    key: string,
    maxAttempts = 5,
    windowSeconds = 15 * 60,
    blockDurationSeconds = 15 * 60
  ): { allowed: boolean; remainingAttempts: number; retryAfterSeconds: number } {
    const now = Date.now();
    let record = this.records.get(key);

    if (!record || now - record.firstAttemptTime > windowSeconds * 1000) {
      record = {
        count: 1,
        firstAttemptTime: now,
        blockedUntil: 0,
      };
      this.records.set(key, record);
    } else {
      record.count += 1;
      if (record.count >= maxAttempts) {
        record.blockedUntil = now + blockDurationSeconds * 1000;
      }
    }

    const isBlocked = record.blockedUntil > now;
    const retryAfterSeconds = isBlocked ? Math.ceil((record.blockedUntil - now) / 1000) : 0;

    return {
      allowed: !isBlocked,
      remainingAttempts: Math.max(0, maxAttempts - record.count),
      retryAfterSeconds,
    };
  }

  /**
   * Resets counter on successful authentication.
   */
  public reset(key: string): void {
    this.records.delete(key);
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, record] of this.records.entries()) {
      if (record.blockedUntil < now && now - record.firstAttemptTime > 30 * 60 * 1000) {
        this.records.delete(key);
      }
    }
  }
}

// Global rate limiter instance for auth
export const loginRateLimiter = new RateLimiter();
