import { AuthContext } from "@/core/types";

/**
 * Audit event interface
 */
interface AuditEvent {
  action: string;
  userId: string;
  resourceId: string;
  timestamp: Date;
  input: unknown;
  output: unknown;
  success: boolean;
  metadata?: Record<string, unknown>;
}

export async function logAuditEvent(event: AuditEvent): Promise<void> {
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
function sanitizeForAudit(data: unknown): unknown {
  if (typeof data !== "object" || data === null) {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeForAudit(item));
  }

  const sanitized = { ...data } as Record<string, unknown>;

  // Exclude sensitive information
  const sensitiveFields = [
    "password",
    "token",
    "secret",
    "session",
    "apiKey",
    "accessToken",
    "refreshToken",
    "privateKey",
    "secretKey",
  ];

  sensitiveFields.forEach((field) => {
    if (field in sanitized) {
      delete sanitized[field];
    }
  });

  // Recursively sanitize nested objects
  Object.keys(sanitized).forEach((key) => {
    if (typeof sanitized[key] === "object" && sanitized[key] !== null) {
      sanitized[key] = sanitizeForAudit(sanitized[key]);
    }
  });

  return sanitized;
}

/**
 * Extract resource ID from input data safely
 */
function extractResourceId(input: unknown): string {
  if (typeof input !== "object" || input === null) {
    return "N/A";
  }

  const inputObj = input as Record<string, unknown>;

  // Try common resource ID field names
  const resourceIdFields = [
    "id",
    "userId",
    "resourceId",
    "entityId",
    "documentId",
  ];

  for (const field of resourceIdFields) {
    const value = inputObj[field];
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
    if (typeof value === "number") {
      return String(value);
    }
  }

  return "N/A";
}

/**
 * Creates an audit logging condition.
 * This condition logs an audit event after a method successfully executes.
 * Sensitive information is sanitized before logging.
 *
 * @template TOutput - The type of the method output
 * @template TInput - The type of the method input
 * @template TContext - The type of the authentication context
 * @param action - A string describing the action being audited (e.g., "USER_LOGIN", "DATA_UPDATE").
 * @param options - Optional configuration for audit logging
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
 *
 * class DataService {
 *   @contract({
 *     ensures: [auditLog<UpdateResult, { id: string; data: any }>("DATA_UPDATE", {
 *       includeOutput: false,
 *       metadata: { source: "api" }
 *     })],
 *   })
 *   async updateData(input: { id: string; data: any }, context: AuthContext) {
 *     // Update logic
 *     return { success: true, id: input.id };
 *   }
 * }
 * ```
 */
export function auditLog<
  TOutput = unknown,
  TInput = unknown,
  TContext extends AuthContext = AuthContext,
>(
  action: string,
  options: {
    includeInput?: boolean;
    includeOutput?: boolean;
    metadata?: Record<string, unknown>;
  } = {}
) {
  const { includeInput = true, includeOutput = true, metadata = {} } = options;

  return async (
    output: TOutput,
    input: TInput,
    context: TContext
  ): Promise<boolean> => {
    try {
      const auditEvent: AuditEvent = {
        action,
        userId: context.user?.id || "anonymous",
        resourceId: extractResourceId(input),
        timestamp: new Date(),
        input: includeInput ? sanitizeForAudit(input) : undefined,
        output: includeOutput ? sanitizeForAudit(output) : undefined,
        success: true,
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
      };

      await logAuditEvent(auditEvent);
      return true;
    } catch (error: unknown) {
      // Log audit errors but don't fail the original operation
      console.error("Failed to log audit event:", error);
      return true;
    }
  };
}

/**
 * Creates an audit logging condition for failed operations
 * This can be used in catch blocks or error handlers
 *
 * @template TInput - The type of the method input
 * @template TContext - The type of the authentication context
 * @param action - A string describing the failed action
 * @param error - The error that occurred
 * @returns A condition function for logging failed operations
 */
export function auditLogFailure<
  TInput = unknown,
  TContext extends AuthContext = AuthContext,
>(
  action: string,
  error: Error,
  options: {
    includeInput?: boolean;
    metadata?: Record<string, unknown>;
  } = {}
) {
  const { includeInput = true, metadata = {} } = options;

  return async (input: TInput, context: TContext): Promise<void> => {
    try {
      const auditEvent: AuditEvent = {
        action: `${action}_FAILED`,
        userId: context.user?.id || "anonymous",
        resourceId: extractResourceId(input),
        timestamp: new Date(),
        input: includeInput ? sanitizeForAudit(input) : undefined,
        output: {
          error: error.message,
          errorType: error.name,
        },
        success: false,
        metadata: {
          ...metadata,
          errorStack: error.stack,
        },
      };

      await logAuditEvent(auditEvent);
    } catch (auditError: unknown) {
      console.error("Failed to log audit failure event:", auditError);
    }
  };
}
