import { ContractViolationError } from "~/core/errors";
import { getAuthContext } from "~/core/types";
import { redirect } from "next/navigation"; // Assuming Next.js environment
import { logger } from "~/utils/logger";

/**
 * Helper to integrate Next.js Server Actions with the contract system.
 * This function acts as a wrapper for Server Actions, handling contract violations appropriately.
 * It extracts input from FormData (if applicable), retrieves the authentication context,
 * executes the action, and catches `ContractViolationError` to return a structured response or redirect.
 *
 * @template TInput - The expected type of the input for the server action.
 * @template TOutput - The expected return type of the server action.
 * @param actionFn - The original server action function that takes input and context.
 * @returns A wrapped server action function that can be used directly in Next.js.
 *
 * @example
 * ```typescript
 * // app/actions.ts (Server Component)
 * "use server";
 *
 * import { createServerAction } from "../../src/integrations/server-actions";
 * import { contract } from "../../src/core/contract";
 * import { auth } from "../../src/conditions/auth";
 * import { z } from "zod";
 * import { validates } from "../../src/conditions/validation";
 *
 * const CreatePostSchema = z.object({
 *   title: z.string().min(1),
 *   content: z.string().min(10),
 * });
 *
 * class PostActions {
 *   @contract({
 *     requires: [auth("user"), validates(CreatePostSchema)],
   *   })
   *   async createPost(input: z.infer<typeof CreatePostSchema>, context: any) {
   *     logger.debug(`Creating post: ${JSON.stringify(input)} by user: ${context.user?.id}`);
   *     // Logic to save post to DB
   *     return { postId: "new-post-id", ...input };
   *   }
   * }
   *
   * export const createPostAction = createServerAction(new PostActions().createPost);
   * ```
   */
export function createServerAction<TInput, TOutput>(
  actionFn: (input: TInput, context: any) => Promise<TOutput> | TOutput
) {
  return async (formData: FormData | TInput): Promise<any> => {
    // Logic to extract input from FormData needs to be adjusted based on specific use cases.
    // Here, if it's FormData, convert it to an object; otherwise, treat it as direct input.
    const input = formData instanceof FormData ? Object.fromEntries(formData.entries()) as TInput : formData;

    try {
      const context = await getAuthContext(); // Retrieve context from the global session provider
      const result = await actionFn(input, context);
      return { success: true, data: result };
    } catch (error) {
      if (error instanceof ContractViolationError) {
        const response = error.getAppropriateResponse();

        if (response.redirect) {
          redirect(response.redirect);
        }

        return response;
      }

      logger.error("Unexpected error in server action:", error as Error);
      return { success: false, error: "An unexpected error occurred." };
    }
  };
}
