import { AuthContext } from "../core/types";

// Placeholder for audit logging (e.g., a logging service)
// In a real application, this would send logs to a centralized system.
export async function logAuditEvent(event: any): Promise<void> {
  if (process.env.NODE_ENV === "development") {
    console.log("AUDIT LOG:", event);
  }
  // In production, send to a dedicated logging service
}

/**
 * Sanitizes data by removing sensitive information before logging for audit purposes.
 * @param data - The data to sanitize.
 * @returns The sanitized data.
 */
function sanitizeForAudit(data: any): any {
  if (typeof data !== "object" || data === null) {
    return data;
  }

  const sanitized = { ...data };
  // Exclude sensitive information
  delete sanitized.password;
  delete sanitized.token;
  delete sanitized.secret;
  delete sanitized.session; // Also exclude session information from audit logs

  return sanitized;
}

/**
 * Creates an audit logging condition.
 * This condition logs an audit event after a method successfully executes.
 * Sensitive information is sanitized before logging.
 *
 * @param action - A string describing the action being audited (e.g., "USER_LOGIN", "DATA_UPDATE").
 * @returns A condition function that takes output, input, and authentication context, and returns a Promise resolving to a boolean.
 *
 * @example
 * ```typescript
 * class AuthService {
 *   @contract({
 *     ensures: [auditLog("USER_LOGIN")],
 *   })
 *   async login(credentials: { username: string; password: string }, context: AuthContext) {
 *     // Login logic
 *     return { success: true, userId: "user123" };
 *   }
 * }
 * ```
 */
export function auditLog(action: string) {
  return async (
    output: any,
    input: any,
    context: AuthContext
  ): Promise<boolean> => {
    try {
      await logAuditEvent({
        action,
        userId: context.user?.id || "anonymous",
        resourceId: input.id || input.userId || "N/A",
        timestamp: new Date(),
        input: sanitizeForAudit(input),
        output: sanitizeForAudit(output),
        success: true,
      });
      return true;
    } catch (error) {
      // Re-throw the error to allow proper error handling by the calling code
      throw error;
    }
  };
}
