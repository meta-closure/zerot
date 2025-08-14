import { AuthContext } from "~/core/types";

export async function logAuditEvent(event: any): Promise<void> {
  // 開発環境でのみコンソール出力
  if (process.env.NODE_ENV === "development") {
    console.log("AUDIT LOG:", event);
  }
  // 本番環境では外部ログサービスに送信
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
  };
}
