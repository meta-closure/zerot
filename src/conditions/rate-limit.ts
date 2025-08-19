import { ContractError, ErrorCategory } from "@/core/errors";
import { AuthContext } from "@/core/types";

/**
 * Rate limit entry interface
 */
interface RateLimitEntry {
  count: number;
  lastReset: number;
  maxPerWindow: number;
  windowMs: number;
}

/**
 * Creates a rate limiting condition.
 * This condition limits the number of times a specific operation can be performed by a user within a defined window.
 *
 * @template T - The input type (not used in rate limiting logic)
 * @param operation - A string identifying the operation being rate-limited (e.g., "login", "create_post").
 * @param maxPerWindow - The maximum number of times the operation can be performed per window.
 * @param windowMs - Optional. The time window in milliseconds. Defaults to 60000ms (1 minute).
 * @returns A condition function that takes input and authentication context, and returns a Promise resolving to a boolean.
 * @throws {ContractError} If the user ID is not available for rate limiting, or if the rate limit is exceeded.
 *
 * @example
 * ```typescript
 * class CommentService {
 *   @contract({
 *     requires: [rateLimit("post_comment", 5)], // Max 5 comments per minute per user (default window)
 *   })
 *   async addComment(comment: { postId: string; text: string }, context: AuthContext) {
 *     // Logic to add comment
 *     logger.debug(`User ${context.user?.id} added comment to post ${comment.postId}`);
 *   }
 * }
 *
 * class AuthService {
 *   @contract({
 *     requires: [rateLimit("login_attempt", 3, 5 * 60 * 1000)], // Max 3 login attempts per 5 minutes
 *   })
 *   async login(credentials: any, context: AuthContext) {
 *     // Logic to login
 *   }
 * }
 * ```
 */

// シンプルなインメモリストア
const rateStore = new Map<string, RateLimitEntry>();

/**
 * Rate limit condition function
 */
export function rateLimit<T = unknown>(
  operation: string,
  maxPerWindow: number,
  windowMs: number = 60000
) {
  return async (_input: T, context: AuthContext): Promise<boolean> => {
    console.log(`[RATE_LIMIT] Checking rate limit for operation: ${operation}`);
    console.log(`[RATE_LIMIT] Context user:`, {
      hasUser: !!context.user,
      userId: context.user?.id,
    });

    if (!context.user?.id) {
      console.error(`[RATE_LIMIT] No user ID available for rate limiting`);
      throw new ContractError("User ID required for rate limiting", {
        code: "RATE_LIMIT_ERROR",
        category: ErrorCategory.AUTHENTICATION,
        details: { operation, maxPerWindow, windowMs },
      });
    }

    const key = `rateLimit:${context.user.id}:${operation}`;
    const entry = rateStore.get(key);
    const now = Date.now();

    console.log(`[RATE_LIMIT] Checking key: ${key}`);
    console.log(`[RATE_LIMIT] Current entry:`, entry);

    // ウィンドウリセット
    if (!entry || now - entry.lastReset > windowMs) {
      console.log(`[RATE_LIMIT] Resetting window for ${key}`);
      rateStore.set(key, {
        count: 0,
        lastReset: now,
        maxPerWindow,
        windowMs,
      });
    }

    const currentEntry = rateStore.get(key);
    if (!currentEntry) {
      // This should not happen due to the set above, but handle it safely
      throw new ContractError("Rate limit entry not found", {
        code: "RATE_LIMIT_ERROR",
        category: ErrorCategory.SYSTEM,
        details: { operation, key },
      });
    }

    const current = currentEntry.count;

    console.log(`[RATE_LIMIT] Current usage: ${current}/${maxPerWindow}`);

    if (current >= maxPerWindow) {
      console.error(
        `[RATE_LIMIT] Rate limit exceeded: ${current}/${maxPerWindow}`
      );
      throw new ContractError(
        `Rate limit exceeded for ${operation}: ${current}/${maxPerWindow} per ${windowMs / 1000} seconds`,
        {
          code: "RATE_LIMIT_EXCEEDED",
          category: ErrorCategory.BUSINESS_LOGIC,
          details: { operation, maxPerWindow, current, windowMs },
          isRecoverable: false,
        }
      );
    }

    // カウンター増加
    const newCount = currentEntry.count + 1;
    rateStore.set(key, { ...currentEntry, count: newCount });

    console.log(`[RATE_LIMIT] Updated count: ${newCount}/${maxPerWindow}`);
    console.log(`[RATE_LIMIT] Rate limit check passed for ${operation}`);

    return true;
  };
}

/**
 * Utility function to clear rate limit for a specific user and operation
 * Useful for testing or administrative purposes
 */
export function clearRateLimit(userId: string, operation: string): void {
  const key = `rateLimit:${userId}:${operation}`;
  rateStore.delete(key);
  console.log(`[RATE_LIMIT] Cleared rate limit for ${key}`);
}

/**
 * Utility function to get current rate limit status
 * Useful for debugging or displaying to users
 */
export function getRateLimitStatus(
  userId: string,
  operation: string
): {
  current: number;
  max: number;
  windowMs: number;
  timeUntilReset: number;
} | null {
  const key = `rateLimit:${userId}:${operation}`;
  const entry = rateStore.get(key);

  if (!entry) {
    return null;
  }

  const now = Date.now();
  const timeUntilReset = Math.max(0, entry.lastReset + entry.windowMs - now);

  return {
    current: entry.count,
    max: entry.maxPerWindow,
    windowMs: entry.windowMs,
    timeUntilReset,
  };
}

/**
 * Utility function to clear all rate limits
 * Useful for testing
 */
export function clearAllRateLimits(): void {
  rateStore.clear();
  console.log(`[RATE_LIMIT] Cleared all rate limits`);
}

/**
 * Utility function to get all active rate limits
 * Useful for monitoring and debugging
 */
export function getAllRateLimits(): Record<string, RateLimitEntry> {
  const result: Record<string, RateLimitEntry> = {};
  for (const [key, entry] of rateStore.entries()) {
    result[key] = { ...entry };
  }
  return result;
}

/**
 * Utility function to check if a rate limit exists without modifying it
 * Useful for read-only checks
 */
export function checkRateLimit(
  userId: string,
  operation: string,
  maxPerWindow: number,
  windowMs: number = 60000
): { allowed: boolean; current: number; timeUntilReset: number } {
  const key = `rateLimit:${userId}:${operation}`;
  const entry = rateStore.get(key);
  const now = Date.now();

  if (!entry || now - entry.lastReset > windowMs) {
    return {
      allowed: true,
      current: 0,
      timeUntilReset: 0,
    };
  }

  const timeUntilReset = Math.max(0, entry.lastReset + entry.windowMs - now);

  return {
    allowed: entry.count < maxPerWindow,
    current: entry.count,
    timeUntilReset,
  };
}
