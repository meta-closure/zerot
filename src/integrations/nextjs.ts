import { ContractViolationError } from "~/core/errors";
import { redirect } from "next/navigation"; // Assuming Next.js environment

/**
 * Helper function for Next.js Middleware integration.
 * This function acts as a wrapper to handle contract violations within Next.js middleware.
 * It catches `ContractViolationError` and responds with appropriate HTTP status codes or redirects.
 *
 * @param handler - The original Next.js middleware handler function.
 * @returns A wrapped middleware function that handles contract violations.
 *
 * @example
 * ```typescript
 * // pages/api/protected-route.ts
 * import { withContractMiddleware } from "../../src/integrations/nextjs";
 * import { contract } from "../../src/core/contract";
 * import { auth } from "../../src/conditions/auth";
 *
 * class MyApiHandler {
 *   @contract({
 *     requires: [auth("admin")],
 *   })
 *   async handleRequest(req: NextApiRequest, res: NextApiResponse) {
 *     res.status(200).json({ message: "Welcome, admin!" });
 *   }
 * }
 *
 * export default withContractMiddleware(new MyApiHandler().handleRequest);
 * ```
 */
export function withContractMiddleware(handler: Function) {
  return async (...args: any[]) => {
    try {
      return await handler(...args);
    } catch (error) {
      if (error instanceof ContractViolationError) {
        const response = error.getAppropriateResponse();
        if (response.redirect) {
          // Use Next.js's redirect function
          redirect(response.redirect);
        }
        // Other error handling (e.g., returning a JSON response)
        return new Response(JSON.stringify(response), {
          status: 403, // Forbidden or appropriate status
          headers: { "Content-Type": "application/json" },
        });
      }
      // Re-throw unknown errors or handle as generic errors
      throw error;
    }
  };
}
