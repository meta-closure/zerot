import { logger } from "@/utils/logger";
import { AsyncLocalStorage } from "async_hooks";
import { BaseAdapter } from "./adapters/base";
import { AuthContext } from "./types";

/**
 * Type guard to check if an error is an Error instance
 */
function isError(error: unknown): error is Error {
  return error instanceof Error;
}

/**
 * Safe conversion of unknown error to loggable format
 */
function formatErrorForLogging(error: unknown): Record<string, any> {
  if (isError(error)) {
    return {
      message: error.message,
      name: error.name,
      stack: error.stack,
    };
  }

  if (typeof error === "object" && error !== null) {
    return { error: String(error) };
  }

  return { error: String(error) };
}

/**
 * Request context information stored during request processing
 */
export interface RequestContext {
  /**
   * The adapter being used for this request
   */
  adapter?: BaseAdapter;

  /**
   * Framework-specific request object
   */
  request?: any;

  /**
   * Framework-specific response object
   */
  response?: any;

  /**
   * Pre-extracted user information (cached)
   */
  user?: any;

  /**
   * Pre-extracted session information (cached)
   */
  session?: any;

  /**
   * Request metadata
   */
  metadata?: {
    startTime: number;
    requestId: string;
    userAgent?: string;
    ipAddress?: string;
    [key: string]: any;
  };

  /**
   * Additional custom data
   */
  [key: string]: any;
}

/**
 * AsyncLocalStorage instance for managing request context
 */
const requestContextStorage = new AsyncLocalStorage<RequestContext>();

/**
 * Set the current request context
 * @param context - Request context to set
 */
export function setRequestContext(context: RequestContext): void {
  logger.debug("[CONTEXT] Setting request context", {
    adapter: context.adapter?.name,
    hasRequest: !!context.request,
    hasUser: !!context.user,
    requestId: context.metadata?.requestId,
  });

  requestContextStorage.enterWith(context);
}

/**
 * Get the current request context
 * @returns Current request context
 * @throws Error if no context is set
 */
export function getRequestContext(): RequestContext {
  const context = requestContextStorage.getStore();

  if (!context) {
    throw new Error(
      "No request context available. Make sure to call setRequestContext() or use withRequestContext()."
    );
  }

  logger.debug("[CONTEXT] Getting request context", {
    adapter: context.adapter?.name,
    hasRequest: !!context.request,
    requestId: context.metadata?.requestId,
  });

  return context;
}

/**
 * Get the current request context safely (returns undefined if not available)
 * @returns Current request context or undefined if none set
 */
export function getRequestContextSafe(): RequestContext | undefined {
  const context = requestContextStorage.getStore();

  logger.debug("[CONTEXT] Getting request context safely", {
    hasContext: !!context,
    adapter: context?.adapter?.name,
    hasRequest: !!context?.request,
    requestId: context?.metadata?.requestId,
  });

  return context;
}

/**
 * Execute a function within a request context
 * @param context - Request context to use
 * @param fn - Function to execute
 * @returns Promise resolving to the function result
 */
export function withRequestContext<T>(
  context: RequestContext,
  fn: () => Promise<T>
): Promise<T> {
  return requestContextStorage.run(context, fn);
}

/**
 * Enhanced session provider that uses the current request context
 * @returns Promise resolving to AuthContext
 */
export async function getAuthContextFromRequest(): Promise<AuthContext> {
  const context = getRequestContextSafe();

  if (!context?.adapter || !context?.request) {
    logger.warn(
      "[CONTEXT] No adapter or request in context, returning empty auth context"
    );
    return {};
  }

  try {
    // Use cached values if available
    if (context.user !== undefined && context.session !== undefined) {
      logger.debug("[CONTEXT] Using cached auth context");
      return {
        user: context.user,
        session: context.session,
      };
    }

    logger.debug("[CONTEXT] Extracting auth context from request");

    // Extract user and session
    const [rawUser, rawSession] = await Promise.all([
      context.adapter.extractUser(context.request),
      context.adapter.extractSession(context.request),
    ]);

    // Transform using adapter methods if available
    const user =
      rawUser && context.adapter.transformUser
        ? context.adapter.transformUser(rawUser)
        : rawUser;

    const session =
      rawSession && context.adapter.transformSession
        ? context.adapter.transformSession(rawSession)
        : rawSession;

    // Cache the results
    context.user = user;
    context.session = session;

    logger.debug("[CONTEXT] Auth context extracted", {
      hasUser: !!user,
      userId: user?.id,
      hasSession: !!session,
      sessionId: session?.id,
    });

    return { user, session };
  } catch (error: unknown) {
    logger.error(
      "[CONTEXT] Error extracting auth context",
      formatErrorForLogging(error)
    );

    if (context.adapter.handleError && isError(error)) {
      const handledError = context.adapter.handleError(error);
      if (handledError) {
        throw handledError;
      }
    }

    return {};
  }
}

/**
 * Create a request context with metadata
 * @param adapter - Adapter to use
 * @param request - Request object
 * @param response - Response object (optional)
 * @param additionalData - Additional context data
 * @returns Complete request context
 */
export function createRequestContext(
  adapter: BaseAdapter,
  request: any,
  response?: any,
  additionalData: Record<string, any> = {}
): RequestContext {
  const requestId = generateRequestId();

  const context: RequestContext = {
    adapter,
    request,
    response,
    metadata: {
      startTime: Date.now(),
      requestId,
      userAgent: extractUserAgent(request),
      ipAddress: extractIpAddress(request),
    },
    ...additionalData,
  };

  logger.debug("[CONTEXT] Created request context", {
    adapter: adapter.name,
    requestId,
    hasRequest: !!request,
    hasResponse: !!response,
  });

  return context;
}

/**
 * Generate a unique request ID
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Extract user agent from request (framework-agnostic)
 */
function extractUserAgent(request: any): string | undefined {
  if (!request) return undefined;

  try {
    // Common patterns across frameworks
    return (
      request.headers?.["user-agent"] ||
      request.get?.("user-agent") ||
      request.header?.("user-agent") ||
      request.userAgent
    );
  } catch (error: unknown) {
    logger.debug(
      "[CONTEXT] Failed to extract user agent",
      formatErrorForLogging(error)
    );
    return undefined;
  }
}

/**
 * Extract IP address from request (framework-agnostic)
 */
function extractIpAddress(request: any): string | undefined {
  if (!request) return undefined;

  try {
    // Common patterns across frameworks
    return (
      request.ip ||
      request.connection?.remoteAddress ||
      request.socket?.remoteAddress ||
      request.headers?.["x-forwarded-for"]?.split(",")[0]?.trim() ||
      request.headers?.["x-real-ip"]
    );
  } catch (error: unknown) {
    logger.debug(
      "[CONTEXT] Failed to extract IP address",
      formatErrorForLogging(error)
    );
    return undefined;
  }
}

/**
 * Clear the current request context (useful for testing)
 */
export function clearRequestContext(): void {
  // For testing purposes, we can use a workaround
  // by setting an empty context temporarily
  try {
    // This is a bit of a hack for testing, but AsyncLocalStorage
    // doesn't provide a direct clear method
    requestContextStorage.enterWith({});
    logger.debug("[CONTEXT] Request context cleared");
  } catch (error: unknown) {
    logger.debug(
      "[CONTEXT] Could not clear request context",
      formatErrorForLogging(error)
    );
  }
}

/**
 * Check if we're currently in a request context
 */
export function hasRequestContext(): boolean {
  return !!requestContextStorage.getStore();
}

/**
 * Get request metadata from current context
 */
export function getRequestMetadata(): RequestContext["metadata"] | undefined {
  try {
    const context = getRequestContextSafe();
    return context?.metadata;
  } catch (error: unknown) {
    logger.debug(
      "[CONTEXT] Could not get request metadata",
      formatErrorForLogging(error)
    );
    return undefined;
  }
}

/**
 * Update the current request context with new data
 * @param updates - Partial context updates to apply
 */
export function updateRequestContext(updates: Partial<RequestContext>): void {
  try {
    const currentContext = getRequestContext();
    const updatedContext = { ...currentContext, ...updates };
    setRequestContext(updatedContext);

    logger.debug("[CONTEXT] Request context updated", {
      updatedKeys: Object.keys(updates),
    });
  } catch (error: unknown) {
    logger.warn(
      "[CONTEXT] Could not update request context",
      formatErrorForLogging(error)
    );
  }
}

/**
 * Get a specific value from the request context
 * @param key - Key to retrieve from context
 * @returns Value or undefined if not found
 */
export function getContextValue<T = any>(
  key: keyof RequestContext
): T | undefined {
  try {
    const context = getRequestContextSafe();
    return context?.[key] as T;
  } catch (error: unknown) {
    logger.debug(
      `[CONTEXT] Could not get context value for key: ${String(key)}`,
      formatErrorForLogging(error)
    );
    return undefined;
  }
}

/**
 * Set a specific value in the request context
 * @param key - Key to set in context
 * @param value - Value to set
 */
export function setContextValue<T = any>(
  key: keyof RequestContext,
  value: T
): void {
  try {
    const context = getRequestContext();
    context[key] = value;

    logger.debug(`[CONTEXT] Context value set for key: ${String(key)}`);
  } catch (error: unknown) {
    logger.warn(
      `[CONTEXT] Could not set context value for key: ${String(key)}`,
      formatErrorForLogging(error)
    );
  }
}
