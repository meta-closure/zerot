import { ContractError, ErrorCategory } from "~/core/errors";
import { AuthContext } from "~/core/types";

/**
 * Creates a rate limiting condition.
 * This condition limits the number of times a specific operation can be performed by a user within a defined window.
 *
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
const rateStore = new Map<string, { count: number; lastReset: number }>();

export function rateLimit(
  operation: string,
  maxPerWindow: number,
  windowMs: number = 60000
) {
  return async (input: any, context: AuthContext): Promise<boolean> => {
    if (!context.user?.id) {
      throw new ContractError("User ID required for rate limiting", {
        code: "RATE_LIMIT_ERROR",
        category: ErrorCategory.AUTHENTICATION,
      });
    }

    const key = `rateLimit:${context.user.id}:${operation}`;
    const entry = rateStore.get(key);
    const now = Date.now();

    // ウィンドウリセット
    if (!entry || now - entry.lastReset > windowMs) {
      rateStore.set(key, { count: 0, lastReset: now });
    }

    const current = rateStore.get(key)?.count || 0;

    if (current >= maxPerWindow) {
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
    const currentEntry = rateStore.get(key)!;
    rateStore.set(key, { ...currentEntry, count: currentEntry.count + 1 });

    return true;
  };
}
