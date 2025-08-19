/**
 * Type guard to check if an error is an Error instance
 */
function isError(error: unknown): error is Error {
  return error instanceof Error;
}

/**
 * Base adapter interface for framework integration with Zerot.
 * Adapters provide a standardized way to extract authentication and session
 * information from different web frameworks.
 *
 * @template TRequest - The framework-specific request type
 * @template _TResponse - The framework-specific response type (reserved for future use)
 * @template TUser - The user object type
 * @template TSession - The session object type
 */
export interface ZerotAdapter<
  TRequest = any,
  _TResponse = any,
  TUser = any,
  TSession = any,
> {
  /**
   * Unique name identifying this adapter
   */
  readonly name: string;

  /**
   * Version of the adapter
   */
  readonly version: string;

  /**
   * Detect if the current environment supports this adapter
   * @returns true if this adapter can be used in the current environment
   */
  detectEnvironment(): boolean;

  /**
   * Extract user information from the request
   * @param request - Framework-specific request object
   * @returns Promise resolving to user object or undefined if not authenticated
   */
  extractUser(request: TRequest): Promise<TUser | undefined>;

  /**
   * Extract session information from the request
   * @param request - Framework-specific request object
   * @returns Promise resolving to session object or undefined if no session
   */
  extractSession(request: TRequest): Promise<TSession | undefined>;

  /**
   * Optional: Create framework-specific middleware for automatic context setup
   * @returns Middleware function compatible with the target framework
   */
  createMiddleware?(): any;

  /**
   * Optional: Transform user object to Zerot's AuthContext.user format
   * @param user - Framework-specific user object
   * @returns Transformed user object
   */
  transformUser?(user: TUser): any;

  /**
   * Optional: Transform session object to Zerot's AuthContext.session format
   * @param session - Framework-specific session object
   * @returns Transformed session object
   */
  transformSession?(session: TSession): any;

  /**
   * Optional: Handle adapter-specific errors
   * @param error - Error that occurred during extraction
   * @returns Handled error or undefined to ignore
   */
  handleError?(error: Error): Error | undefined;

  /**
   * Optional: Create error response for failed authentication
   * @param error - The error that occurred
   * @param request - The original request
   * @returns Framework-specific response object
   */
  createErrorResponse?(error: Error, request: TRequest): _TResponse;

  /**
   * Optional: Create redirect response for authentication
   * @param redirectUrl - URL to redirect to
   * @param request - The original request
   * @returns Framework-specific response object
   */
  createRedirectResponse?(redirectUrl: string, request: TRequest): _TResponse;
}

/**
 * Abstract base class for implementing Zerot adapters.
 * Provides common functionality and type safety.
 */
export abstract class BaseAdapter<
  TRequest = any,
  TResponse = any,
  TUser = any,
  TSession = any,
> implements ZerotAdapter<TRequest, TResponse, TUser, TSession>
{
  abstract readonly name: string;
  abstract readonly version: string;

  constructor(protected options: Record<string, any> = {}) {}

  abstract detectEnvironment(): boolean;
  abstract extractUser(request: TRequest): Promise<TUser | undefined>;
  abstract extractSession(request: TRequest): Promise<TSession | undefined>;

  /**
   * Default user transformation - override for custom behavior
   */
  transformUser(user: TUser): any {
    if (!user || typeof user !== "object") {
      return undefined;
    }

    const userObj = user as any;
    return {
      id: userObj.id || userObj.sub || userObj.userId || userObj._id,
      email: userObj.email,
      name: userObj.name || userObj.displayName,
      roles: userObj.roles || (userObj.role ? [userObj.role] : ["user"]),
      ...userObj,
    };
  }

  /**
   * Default session transformation - override for custom behavior
   */
  transformSession(session: TSession): any {
    if (!session || typeof session !== "object") {
      return undefined;
    }

    const sessionObj = session as any;
    return {
      id: sessionObj.id || sessionObj.sessionId || sessionObj.sid,
      expiresAt: sessionObj.expiresAt
        ? new Date(sessionObj.expiresAt)
        : sessionObj.expires
          ? new Date(sessionObj.expires)
          : new Date(Date.now() + 24 * 60 * 60 * 1000), // Default 24h
      createdAt: sessionObj.createdAt
        ? new Date(sessionObj.createdAt)
        : undefined,
      ...sessionObj,
    };
  }

  /**
   * Default error handling - override for custom behavior
   */
  handleError(error: Error): Error | undefined {
    console.warn(`[ZEROT ADAPTER:${this.name}] Error:`, error.message);
    return undefined; // Ignore errors by default
  }

  /**
   * Create a generic error response (override for framework-specific implementation)
   * @param error - The error that occurred
   * @param request - The original request
   * @returns Framework-specific response object
   */
  createErrorResponse?(_error: Error, _request: TRequest): TResponse {
    // Default implementation - subclasses should override
    throw new Error(
      `createErrorResponse not implemented for ${this.name} adapter`
    );
  }

  /**
   * Create a generic redirect response (override for framework-specific implementation)
   * @param redirectUrl - URL to redirect to
   * @param request - The original request
   * @returns Framework-specific response object
   */
  createRedirectResponse?(_redirectUrl: string, _request: TRequest): TResponse {
    // Default implementation - subclasses should override
    throw new Error(
      `createRedirectResponse not implemented for ${this.name} adapter`
    );
  }

  /**
   * Safe extraction wrapper that handles errors
   */
  protected async safeExtract<T>(
    operation: () => Promise<T>,
    fallback: T
  ): Promise<T> {
    try {
      return await operation();
    } catch (error: unknown) {
      if (isError(error)) {
        const handledError = this.handleError(error);
        if (handledError) {
          throw handledError;
        }
      } else {
        // Convert non-Error objects to Error
        const errorObj = new Error(String(error));
        const handledError = this.handleError(errorObj);
        if (handledError) {
          throw handledError;
        }
      }
      return fallback;
    }
  }

  /**
   * Safe synchronous operation wrapper
   */
  protected safeSyncOperation<T>(
    operation: () => T,
    fallback: T,
    errorMessage = "Operation failed"
  ): T {
    try {
      return operation();
    } catch (error: unknown) {
      if (isError(error)) {
        const handledError = this.handleError(error);
        if (handledError) {
          throw handledError;
        }
      } else {
        const errorObj = new Error(`${errorMessage}: ${String(error)}`);
        const handledError = this.handleError(errorObj);
        if (handledError) {
          throw handledError;
        }
      }
      return fallback;
    }
  }

  /**
   * Validate that a value exists and is not null/undefined
   */
  protected validateExists<T>(
    value: T | null | undefined,
    errorMessage: string
  ): T {
    if (value === null || value === undefined) {
      throw new Error(errorMessage);
    }
    return value;
  }

  /**
   * Extract property safely from an object
   */
  protected safeGet(obj: any, path: string, fallback: any = undefined): any {
    if (!obj || typeof obj !== "object") {
      return fallback;
    }

    const keys = path.split(".");
    let current = obj;

    for (const key of keys) {
      if (current === null || current === undefined || !(key in current)) {
        return fallback;
      }
      current = current[key];
    }

    return current;
  }
}

/**
 * Registry for managing available adapters
 */
export class AdapterRegistry {
  private static adapters = new Map<string, ZerotAdapter>();

  /**
   * Register an adapter
   */
  static register(adapter: ZerotAdapter): void {
    if (!adapter?.name) {
      throw new Error("Invalid adapter: adapter must have a name");
    }
    this.adapters.set(adapter.name, adapter);
  }

  /**
   * Get adapter by name
   */
  static get(name: string): ZerotAdapter | undefined {
    if (!name || typeof name !== "string") {
      return undefined;
    }
    return this.adapters.get(name);
  }

  /**
   * Get all registered adapters
   */
  static getAll(): ZerotAdapter[] {
    return Array.from(this.adapters.values());
  }

  /**
   * Auto-detect and return the most suitable adapter
   */
  static autoDetect(): ZerotAdapter | undefined {
    try {
      for (const adapter of this.adapters.values()) {
        if (adapter.detectEnvironment()) {
          return adapter;
        }
      }
      return undefined;
    } catch (error: unknown) {
      console.warn("[ADAPTER REGISTRY] Auto-detection failed:", error);
      return undefined;
    }
  }

  /**
   * Clear all adapters (useful for testing)
   */
  static clear(): void {
    this.adapters.clear();
  }

  /**
   * Check if an adapter is registered
   */
  static has(name: string): boolean {
    return this.adapters.has(name);
  }

  /**
   * Unregister a specific adapter
   */
  static unregister(name: string): boolean {
    return this.adapters.delete(name);
  }

  /**
   * Get the count of registered adapters
   */
  static count(): number {
    return this.adapters.size;
  }

  /**
   * Get list of registered adapter names
   */
  static getNames(): string[] {
    return Array.from(this.adapters.keys());
  }
}
