import { ContractError, ErrorCategory } from "../core/errors";
import { AuthContext, getResource } from "../core/types"; // Import getResource
import { logger } from "../utils/logger";

/**
 * Creates an ownership check condition.
 * This condition verifies that the authenticated user owns the resource specified by `resourceIdField` in the input.
 * Admins bypass this check.
 *
 * @param resourceIdField - The name of the field in the input object that contains the resource ID.
 * @returns A condition function that takes input and authentication context, and returns a Promise resolving to a boolean.
 * @throws {ContractError} If the user is not authenticated, the resource ID is missing, the resource is not found,
 *                         or the user does not own the resource.
 * @throws {Error} If `getResource` is not configured via `setResourceProvider`.
 *
 * @example
 * ```typescript
 * // Ensure setResourceProvider is called at application startup:
 * // setResourceProvider(async (resourceId: string) => {
 * //   // Your logic to fetch resource from DB/API
 * //   return { id: resourceId, userId: "owner123" };
 * // });
 *
 * class DocumentService {
 *   @contract({
 *     requires: [owns("documentId")],
 *   })
 *   async editDocument(input: { documentId: string; content: string }, context: AuthContext) {
 *     // Only the owner of the document (or an admin) can edit it
 *     logger.debug(`User ${context.user?.id} editing document ${input.documentId}`);
 *   }
 * }
 * ```
 */
export function owns(resourceIdField: string) {
  return async (input: any, context: AuthContext): Promise<boolean> => {
    if (!context.user?.id) {
      throw new ContractError("User not authenticated for ownership check", {
        code: "AUTHENTICATION_REQUIRED",
        category: ErrorCategory.AUTHENTICATION,
      });
    }

    const resourceId = input[resourceIdField];
    if (!resourceId) {
      throw new ContractError(`Resource ID field '${resourceIdField}' is missing in input`, {
        code: "MISSING_RESOURCE_ID",
        category: ErrorCategory.VALIDATION,
      });
    }

    // Admins bypass ownership checks
    // Check if user has roles and if the roles array includes "admin"
    if (context.user.roles && context.user.roles.includes("admin")) {
      return true;
    }    

    // Use the configured resource provider to get the resource
    const resource = await getResource(resourceId);

    if (!resource) {
      throw new ContractError(`Resource with ID ${resourceId} not found`, {
        code: "RESOURCE_NOT_FOUND",
        category: ErrorCategory.BUSINESS_LOGIC,
      });
    }

    if (resource.userId !== context.user.id) {
      throw new ContractError(`User ${context.user.id} does not own resource ${resourceId}`, {
        code: "OWNERSHIP_DENIED",
        category: ErrorCategory.AUTHORIZATION,
      });
    }

    return true;
  };
}
