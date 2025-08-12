import { ContractError } from "../core/errors";
import { AuthContext } from "../core/types";

// Placeholder for rate limit storage (e.g., Redis)
// In a real application, these would interact with a persistent store.
const rateLimitStore = new Map<string, { count: number; lastReset: number }>();

async function getRateLimitCount(key: string): Promise<number> {
  const entry = rateLimitStore.get(key);
  if (!entry || (Date.now() - entry.lastReset) > 60 * 1000) { // Reset every minute
    rateLimitStore.set(key, { count: 0, lastReset: Date.now() });
    return 0;
  }
  return entry.count;
}

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
 * This condition limits the number of times a specific operation can be performed by a user within a minute.
 *
 * @param operation - A string identifying the operation being rate-limited (e.g., "login", "create_post").
 * @param maxPerMinute - The maximum number of times the operation can be performed per minute.
 * @returns A condition function that takes input and authentication context, and returns a Promise resolving to a boolean.
 * @throws {ContractError} If the user ID is not available for rate limiting, or if the rate limit is exceeded.
 *
 * @example
 * ```typescript
 * class CommentService {
 *   @contract({
 *     requires: [rateLimit("post_comment", 5)], // Max 5 comments per minute per user
 *   })
 *   async addComment(comment: { postId: string; text: string }, context: AuthContext) {
 *     // Logic to add comment
 *     console.log(`User ${context.user?.id} added comment to post ${comment.postId}`);
 *   }
 * }
 * ```
 */
export function rateLimit(operation: string, maxPerMinute: number) {
  return async (input: any, context: AuthContext): Promise<boolean> => {
    if (!context.user?.id) {
      // If the user is not authenticated, either don't apply rate limiting or handle it differently.
      // For now, throw an error.
      throw new ContractError("RATE_LIMIT_ERROR", "User ID required for rate limiting");
    }
    const key = `rateLimit:${context.user.id}:${operation}`;
    const current = await getRateLimitCount(key);

    if (current >= maxPerMinute) {
      throw new ContractError(
        "RATE_LIMIT_EXCEEDED",
        `Rate limit exceeded for ${operation}: ${current}/${maxPerMinute} per minute`
      );
    }

    await incrementRateLimitCount(key);
    return true;
  };
}
