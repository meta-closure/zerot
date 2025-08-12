import { ContractError } from "../core/errors";
import { AuthContext } from "../core/types";

// This is a placeholder for a function that would retrieve a resource by its ID.
// In a real application, this would interact with a database or external service.
// It's declared globally for testing purposes in `tests/unit/contract.test.ts` and `tests/integration/contract.integration.test.ts`.
declare global {
  var getResourceById: (resourceId: string) => Promise<{ id: string; userId: string } | null>;
}

/**
 * Creates an ownership check condition.
 * This condition verifies that the authenticated user owns the resource specified by `resourceIdField` in the input.
 * Admins bypass this check.
 *
 * @param resourceIdField - The name of the field in the input object that contains the resource ID.
 * @returns A condition function that takes input and authentication context, and returns a Promise resolving to a boolean.
 * @throws {ContractError} If the user is not authenticated, the resource ID is missing, the resource is not found,
 *                         or the user does not own the resource.
 * @throws {Error} If `global.getResourceById` is not defined (which is used to fetch resource details).
 *
 * @example
 * ```typescript
 * // Assume global.getResourceById is implemented to fetch resource details
 * declare global {
 *   var getResourceById: (resourceId: string) => Promise<{ id: string; userId: string } | null>;
 * }
 *
 * class DocumentService {
 *   @contract({
 *     requires: [owns("documentId")],
 *   })
 *   async editDocument(input: { documentId: string; content: string }, context: AuthContext) {
 *     // Only the owner of the document (or an admin) can edit it
 *     console.log(`User ${context.user?.id} editing document ${input.documentId}`);
 *   }
 * }
 * ```
 */
export function owns(resourceIdField: string) {
  return async (input: any, context: AuthContext): Promise<boolean> => {
    if (!context.user?.id) {
      throw new ContractError("AUTHENTICATION_REQUIRED", "User not authenticated for ownership check");
    }

    const resourceId = input[resourceIdField];
    if (!resourceId) {
      throw new ContractError("MISSING_RESOURCE_ID", `Resource ID field '${resourceIdField}' is missing in input`);
    }

    // Admins bypass ownership checks
    if (context.user.roles.includes("admin")) {
      return true;
    }

    if (typeof global.getResourceById !== 'function') {
      throw new Error("global.getResourceById is not defined. Ensure it's mocked or implemented for ownership checks.");
    }

    const resource = await global.getResourceById(resourceId);

    if (!resource) {
      throw new ContractError("RESOURCE_NOT_FOUND", `Resource with ID ${resourceId} not found`);
    }

    if (resource.userId !== context.user.id) {
      throw new ContractError("OWNERSHIP_DENIED", `User ${context.user.id} does not own resource ${resourceId}`);
    }

    return true;
  };
}
