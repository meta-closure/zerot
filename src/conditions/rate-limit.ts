import { ContractError, ErrorCategory } from "../core/errors";
import { AuthContext } from "../core/types";

// Placeholder for rate limit storage (e.g., Redis)
// In a real application, these would interact with a persistent store.
const rateLimitStore = new Map<string, { count: number; lastReset: number }>();

/**
 * Retrieves the current rate limit count for a given key within a specified window.
 * If the window has expired, the count is reset.
 * @param key - The unique key for the rate limit (e.g., "userId:operation").
 * @param windowMs - The time window in milliseconds.
 * @returns A Promise that resolves to the current count.
 */
async function getRateLimitCount(key: string, windowMs: number): Promise<number> {
  const entry = rateLimitStore.get(key);
  if (!entry || (Date.now() - entry.lastReset) > windowMs) { // Reset based on configured windowMs
    rateLimitStore.set(key, { count: 0, lastReset: Date.now() });
    return 0;
  }
  return entry.count;
}

/**
 * Increments the rate limit count for a given key.
 * @param key - The unique key for the rate limit.
 * @returns A Promise that resolves once the count is incremented.
 */
async function incrementRateLimitCount(key: string): Promise<void> {
  const entry = rateLimitStore.get(key);
  if (entry) {
    entry.count++;
  } else {
    rateLimitStore.set(key, { count: 1, lastReset: Date.now() });
  }
}

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
 *     console.log(`User ${context.user?.id} added comment to post ${comment.postId}`);
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
export function rateLimit(operation: string, maxPerWindow: number, windowMs?: number) {
  return async (input: any, context: AuthContext): Promise<boolean> => {
    const effectiveWindowMs = windowMs || 60 * 1000; // Default to 1 minute

    if (!context.user?.id) {
      // If the user is not authenticated, either don't apply rate limiting or handle it differently.
      // For now, throw an an error.
      throw new ContractError("User ID required for rate limiting", {
        code: "RATE_LIMIT_ERROR",
        category: ErrorCategory.AUTHENTICATION, // Or SYSTEM if it's an internal configuration issue
      });
    }
    const key = `rateLimit:${context.user.id}:${operation}`;
    const current = await getRateLimitCount(key, effectiveWindowMs);

    if (current >= maxPerWindow) {
      throw new ContractError(
        `Rate limit exceeded for ${operation}: ${current}/${maxPerWindow} per ${effectiveWindowMs / 1000} seconds`,
        {
          code: "RATE_LIMIT_EXCEEDED",
          category: ErrorCategory.BUSINESS_LOGIC, // Or THROTTLING
          details: { operation, maxPerWindow, current, windowMs: effectiveWindowMs },
          isRecoverable: false, // Rate limit exceeded is generally not recoverable by retrying immediately
        }
      );
    }

    await incrementRateLimitCount(key);
    return true;
  };
}
