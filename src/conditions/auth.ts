import { ContractError, ErrorCategory } from "~/core/errors";
import { AuthContext } from "~/core/types";

/**
 * Creates an authentication condition that checks if a user is logged in and has a required role.
 *
 * @param requiredRole - An optional role string. If provided, the user must have this role.
 * @returns A condition function that takes input and authentication context, and returns a Promise resolving to a boolean.
 * @throws {ContractError} If authentication is required but no user is logged in, or if the session has expired,
 *                         or if the user does not have the required role.
 *
 * @example
 * ```typescript
 * class AdminService {
 *   @contract({
 *     requires: [auth("admin")],
 *   })
 *   async deleteCriticalData(dataId: string, context: AuthContext) {
 *     // Only accessible by users with the "admin" role
 *     console.log(`Deleting critical data ${dataId} by admin ${context.user?.id}`);
 *   }
 * }
 *
 * class UserService {
 *   @contract({
 *     requires: [auth()], // Requires any logged-in user
 *   })
 *   async getUserProfile(userId: string, context: AuthContext) {
 *     // Accessible by any logged-in user
 *     console.log(`Fetching profile for user ${userId}`);
 *   }
 * }
 * ```
 */
export function auth(requiredRole?: string) {
  return async (input: any, context: AuthContext): Promise<boolean> => {
    if (!context.user) {
      throw new ContractError("User must be logged in", {
        code: "AUTHENTICATION_REQUIRED",
        category: ErrorCategory.AUTHENTICATION,
      });
    }

    if (!context.session || new Date(context.session.expiresAt) < new Date()) {
      throw new ContractError("Session has expired", {
        code: "SESSION_EXPIRED",
        category: ErrorCategory.AUTHENTICATION,
      });
    }

    // roles チェックを強化
    if (requiredRole) {
      const userRoles = context.user.roles || [];
      if (!userRoles.includes(requiredRole)) {
        throw new ContractError(
          `Required role: ${requiredRole}, User roles: ${userRoles.join(", ")}`,
          {
            code: "INSUFFICIENT_ROLE",
            category: ErrorCategory.AUTHORIZATION,
          }
        );
      }
    }

    return true;
  };
}
