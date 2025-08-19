import { ContractError, ErrorCategory } from "@/core/errors";
import { AuthContext, getResource } from "@/core/types"; // Import getResource

/**
 * Creates an ownership check condition.
 * This condition verifies that the authenticated user owns the resource specified by `resourceIdField` in the input.
 * Admins bypass this check.
 *
 * @template T - The input type that should contain the resource ID field
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
 *     requires: [owns<{ documentId: string }>("documentId")],
 *   })
 *   async editDocument(input: { documentId: string; content: string }, context: AuthContext) {
 *     // Only the owner of the document (or an admin) can edit it
 *     logger.debug(`User ${context.user?.id} editing document ${input.documentId}`);
 *   }
 * }
 * ```
 */
export function owns<T extends Record<string, unknown>>(
  resourceIdField: keyof T & string
) {
  return async (input: T, context: AuthContext): Promise<boolean> => {
    if (!context.user?.id) {
      throw new ContractError("User not authenticated for ownership check", {
        code: "AUTHENTICATION_REQUIRED",
        category: ErrorCategory.AUTHENTICATION,
      });
    }

    const resourceId = input[resourceIdField];

    // リソースIDのバリデーションを改善: string, number, または有効な値をチェック
    if (resourceId === null || resourceId === undefined || resourceId === "") {
      throw new ContractError(
        `Resource ID field '${String(resourceIdField)}' is missing or invalid in input`,
        {
          code: "MISSING_RESOURCE_ID",
          category: ErrorCategory.VALIDATION,
        }
      );
    }

    // リソースIDを文字列に変換（数値も受け入れる）
    const resourceIdString = String(resourceId);

    // admin チェックを強化
    const userRoles = context.user.roles || [];
    if (userRoles.includes("admin")) {
      return true;
    }

    try {
      // Use the configured resource provider to get the resource
      const resource = await getResource(resourceIdString);

      if (!resource) {
        throw new ContractError(
          `Resource with ID ${resourceIdString} not found`,
          {
            code: "RESOURCE_NOT_FOUND",
            category: ErrorCategory.BUSINESS_LOGIC,
          }
        );
      }

      if (resource.userId !== context.user.id) {
        throw new ContractError(
          `User ${context.user.id} does not own resource ${resourceIdString}`,
          {
            code: "OWNERSHIP_DENIED",
            category: ErrorCategory.AUTHORIZATION,
          }
        );
      }

      return true;
    } catch (error: unknown) {
      // If the error is already a ContractError, re-throw it
      if (error instanceof ContractError) {
        throw error;
      }

      // Convert other errors to ContractError
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new ContractError(
        `Failed to check resource ownership: ${errorMessage}`,
        {
          code: "OWNERSHIP_CHECK_FAILED",
          category: ErrorCategory.SYSTEM,
        }
      );
    }
  };
}
