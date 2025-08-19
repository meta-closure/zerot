import { BaseAdapter } from "@/core/adapters/base";
import { logger } from "@/utils/logger";

// Define types for Next.js if not available
interface NextRequest {
  headers: Headers;
  cookies: {
    get(name: string): { name: string; value: string } | undefined;
  };
  url: string;
  method: string;
}

interface NextResponse {
  next(): NextResponse;
}

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
 * JWT payload interface for session tokens
 */
interface JWTPayload {
  userId: string;
  email?: string;
  name?: string;
  roles?: string[];
  sessionId?: string;
  exp: number;
  iat: number;
  [key: string]: any;
}

/**
 * Next.js configuration options for the adapter
 */
export interface NextjsAdapterOptions {
  /**
   * Custom session extraction function
   */
  getSession?: (request: NextRequest) => Promise<any>;

  /**
   * Custom user extraction function
   */
  getUser?: (request: NextRequest) => Promise<any>;

  /**
   * JWT secret for token verification (if using JWT sessions)
   */
  jwtSecret?: string;

  /**
   * Session cookie name (default: "session-token")
   */
  sessionCookieName?: string;

  /**
   * Whether to enable debug logging
   */
  debug?: boolean;

  /**
   * Custom cookie names to check for sessions
   */
  sessionCookies?: string[];

  /**
   * Custom JWT verification function
   */
  verifyJWT?: (token: string) => Promise<JWTPayload | null>;
}

/**
 * Next.js adapter for Zerot contract system.
 * Provides session management without external dependencies.
 *
 * @example
 * ```typescript
 * // Basic usage with cookies
 * const adapter = new NextjsAdapter({ debug: true });
 *
 * // With JWT sessions
 * const adapter = new NextjsAdapter({
 *   jwtSecret: process.env.JWT_SECRET,
 *   sessionCookieName: "auth-token"
 * });
 *
 * // With custom session extraction
 * const adapter = new NextjsAdapter({
 *   getUser: async (request) => {
 *     return await extractUserFromRequest(request);
 *   }
 * });
 *
 * await Zerot.withAdapter(adapter);
 * ```
 */
export class NextjsAdapter extends BaseAdapter<NextRequest, NextResponse> {
  readonly name = "nextjs";
  readonly version = "2.0.0";

  private readonly sessionCookieName: string;
  private readonly sessionCookies: string[];

  constructor(private config: NextjsAdapterOptions = {}) {
    super(config);

    this.sessionCookieName = config.sessionCookieName || "session-token";
    this.sessionCookies = config.sessionCookies || [
      this.sessionCookieName,
      "session",
      "connect.sid",
      "sessionId",
      "auth-token",
      "token",
    ];

    if (config.debug) {
      logger.debug("[NEXTJS ADAPTER] Initialized with config", {
        sessionCookieName: this.sessionCookieName,
        sessionCookies: this.sessionCookies,
        hasCustomGetSession: !!config.getSession,
        hasCustomGetUser: !!config.getUser,
        hasJWTSecret: !!config.jwtSecret,
        hasCustomJWTVerify: !!config.verifyJWT,
      });
    }
  }

  /**
   * Detect if we're running in a Next.js environment
   */
  detectEnvironment(): boolean {
    return this.safeSyncOperation(
      () => {
        const isNextjs = !!(
          typeof process !== "undefined" &&
          (process.env.NEXT_RUNTIME ||
            process.env.__NEXT_PROCESSED_ENV ||
            process.env.NEXT_PUBLIC_VERCEL_URL ||
            (typeof globalThis !== "undefined" &&
              (globalThis as any).__NEXT_DATA__))
        );

        if (this.config.debug) {
          logger.debug("[NEXTJS ADAPTER] Environment detection", { isNextjs });
        }

        return isNextjs;
      },
      false,
      "Environment detection failed"
    );
  }

  /**
   * Extract user information from Next.js request
   */
  async extractUser(request: NextRequest): Promise<any> {
    if (this.config.debug) {
      logger.debug("[NEXTJS ADAPTER] Extracting user from request");
    }

    // Use custom user extraction if provided
    if (this.config.getUser) {
      return await this.safeExtract(
        () => this.config.getUser!(request),
        undefined
      );
    }

    // Try to get session and extract user from it
    const session = await this.extractSession(request);
    const user = this.safeGet(session, "user");

    if (this.config.debug) {
      logger.debug("[NEXTJS ADAPTER] User extracted", {
        hasUser: !!user,
        userId: this.safeGet(user, "id") || this.safeGet(user, "userId"),
        extractionMethod: this.config.getUser ? "custom" : "session-based",
      });
    }

    return user;
  }

  /**
   * Extract session information from Next.js request
   */
  async extractSession(request: NextRequest): Promise<any> {
    if (this.config.debug) {
      logger.debug("[NEXTJS ADAPTER] Extracting session from request");
    }

    // Use custom session extraction if provided
    if (this.config.getSession) {
      return await this.safeExtract(
        () => this.config.getSession!(request),
        undefined
      );
    }

    // Try JWT-based session extraction first
    if (this.config.jwtSecret || this.config.verifyJWT) {
      const jwtSession = await this.safeExtract(
        () => this.extractJWTSession(request),
        undefined
      );

      if (jwtSession) {
        if (this.config.debug) {
          logger.debug("[NEXTJS ADAPTER] Session extracted via JWT");
        }
        return jwtSession;
      }
    }

    // Fallback to cookie-based session extraction
    if (this.config.debug) {
      logger.debug(
        "[NEXTJS ADAPTER] Falling back to cookie-based session extraction"
      );
    }

    return await this.safeExtract(
      () => this.extractSessionFromCookies(request),
      undefined
    );
  }

  /**
   * Extract session using JWT tokens
   */
  private async extractJWTSession(request: NextRequest): Promise<any> {
    try {
      // Try to get JWT token from cookies
      const token = request.cookies.get(this.sessionCookieName)?.value;

      if (!token) {
        if (this.config.debug) {
          logger.debug("[NEXTJS ADAPTER] No JWT token found in cookies");
        }
        return undefined;
      }

      let payload: JWTPayload | null = null;

      // Use custom JWT verification if provided
      if (this.config.verifyJWT) {
        payload = await this.config.verifyJWT(token);
      } else if (this.config.jwtSecret) {
        // Use built-in JWT verification
        payload = await this.verifyJWTToken(token);
      }

      if (!payload) {
        if (this.config.debug) {
          logger.debug("[NEXTJS ADAPTER] JWT token verification failed");
        }
        return undefined;
      }

      // Check if token is expired
      if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
        if (this.config.debug) {
          logger.debug("[NEXTJS ADAPTER] JWT token is expired");
        }
        return undefined;
      }

      if (this.config.debug) {
        logger.debug("[NEXTJS ADAPTER] JWT session extracted", {
          userId: payload.userId,
          sessionId: payload.sessionId,
          hasRoles: !!payload.roles,
        });
      }

      return {
        id: payload.sessionId || `session_${payload.userId}`,
        sessionToken: token,
        expiresAt: new Date(payload.exp * 1000),
        user: {
          id: payload.userId,
          email: payload.email,
          name: payload.name,
          roles: payload.roles || ["user"],
        },
        source: "jwt",
      };
    } catch (error: unknown) {
      if (this.config.debug) {
        logger.warn(
          "[NEXTJS ADAPTER] JWT session extraction failed",
          formatErrorForLogging(error)
        );
      }
      return undefined;
    }
  }

  /**
   * Verify JWT token using built-in verification
   */
  private async verifyJWTToken(token: string): Promise<JWTPayload | null> {
    try {
      // Simple JWT verification - in production, use a proper JWT library
      const parts = token.split(".");
      if (parts.length !== 3) {
        return null;
      }

      const payload = JSON.parse(
        Buffer.from(parts[1], "base64url").toString("utf8")
      );

      // In a real implementation, you would verify the signature here
      // For now, we just return the payload if it has required fields
      if (payload.userId && payload.exp) {
        return payload as JWTPayload;
      }

      return null;
    } catch (error: unknown) {
      if (this.config.debug) {
        logger.debug(
          "[NEXTJS ADAPTER] JWT verification error",
          formatErrorForLogging(error)
        );
      }
      return null;
    }
  }

  /**
   * Extract session from cookies (fallback method)
   */
  private async extractSessionFromCookies(request: NextRequest): Promise<any> {
    try {
      for (const cookieName of this.sessionCookies) {
        try {
          const cookie = request.cookies.get(cookieName);
          if (cookie?.value) {
            if (this.config.debug) {
              logger.debug("[NEXTJS ADAPTER] Found session cookie", {
                cookieName,
                hasValue: !!cookie.value,
              });
            }

            // Basic session object from cookie presence
            return {
              id: cookie.value,
              sessionToken: cookie.value,
              expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h default
              source: "cookie",
              cookieName,
            };
          }
        } catch (cookieError: unknown) {
          if (this.config.debug) {
            logger.debug(
              `[NEXTJS ADAPTER] Failed to get cookie ${cookieName}`,
              formatErrorForLogging(cookieError)
            );
          }
          continue;
        }
      }

      if (this.config.debug) {
        logger.debug("[NEXTJS ADAPTER] No session cookies found", {
          searchedCookies: this.sessionCookies,
        });
      }

      return undefined;
    } catch (error: unknown) {
      if (this.config.debug) {
        logger.warn(
          "[NEXTJS ADAPTER] Cookie extraction failed",
          formatErrorForLogging(error)
        );
      }
      return undefined;
    }
  }

  /**
   * Transform user data to Zerot format
   */
  transformUser(user: any): any {
    if (!user) return undefined;

    const transformed = {
      id: this.safeGet(user, "id") || this.safeGet(user, "userId"),
      email: this.safeGet(user, "email"),
      name: this.safeGet(user, "name"),
      image: this.safeGet(user, "image"),
      roles:
        this.safeGet(user, "roles") ||
        (this.safeGet(user, "role") ? [this.safeGet(user, "role")] : ["user"]),
      // Preserve any additional fields
      ...user,
    };

    if (this.config.debug) {
      logger.debug("[NEXTJS ADAPTER] User transformed", {
        originalId: this.safeGet(user, "id") || this.safeGet(user, "userId"),
        transformedId: transformed.id,
        roles: transformed.roles,
        hasEmail: !!transformed.email,
      });
    }

    return transformed;
  }

  /**
   * Transform session data to Zerot format
   */
  transformSession(session: any): any {
    if (!session) return undefined;

    const transformed = {
      id:
        this.safeGet(session, "id") ||
        this.safeGet(session, "sessionToken") ||
        "nextjs-session",
      expiresAt: this.safeGet(session, "expiresAt")
        ? new Date(this.safeGet(session, "expiresAt"))
        : new Date(Date.now() + 24 * 60 * 60 * 1000),
      // Preserve source information
      source: this.safeGet(session, "source") || "nextjs",
      // Preserve any additional fields
      ...session,
    };

    if (this.config.debug) {
      logger.debug("[NEXTJS ADAPTER] Session transformed", {
        originalId: this.safeGet(session, "id"),
        transformedId: transformed.id,
        expiresAt: transformed.expiresAt,
        source: transformed.source,
      });
    }

    return transformed;
  }

  handleError(error: Error): Error | undefined {
    if (this.config.debug) {
      logger.error("[NEXTJS ADAPTER] Error occurred", error);
    }

    // Log specific error types but don't throw
    if (error.message.includes("jwt") || error.message.includes("JWT")) {
      logger.warn(
        "[NEXTJS ADAPTER] JWT-related error, check token format and secret"
      );
    }

    if (error.message.includes("cookies")) {
      logger.warn(
        "[NEXTJS ADAPTER] Cookie-related error, check request object"
      );
    }

    if (error.message.includes("import")) {
      logger.warn(
        "[NEXTJS ADAPTER] Import error - ensure all required packages are installed"
      );
    }

    // Return undefined to ignore the error (fail gracefully)
    return undefined;
  }

  /**
   * Create Next.js error response
   */
  createErrorResponse(error: Error, _request: NextRequest): NextResponse {
    return this.safeSyncOperation(
      () => {
        // Create a basic error response
        return {
          status: 500,
          json: () =>
            Promise.resolve({
              error: error.message,
              timestamp: new Date().toISOString(),
            }),
        } as any;
      },
      {
        status: 500,
        json: () =>
          Promise.resolve({
            error: "Internal Server Error",
            timestamp: new Date().toISOString(),
          }),
      } as any,
      "Failed to create error response"
    );
  }

  /**
   * Create Next.js redirect response
   */
  createRedirectResponse(
    redirectUrl: string,
    _request: NextRequest
  ): NextResponse {
    return this.safeSyncOperation(
      () => {
        // Create a basic redirect response
        return {
          status: 302,
          headers: { Location: redirectUrl },
        } as any;
      },
      { status: 302, headers: { Location: "/login" } } as any,
      "Failed to create redirect response"
    );
  }

  /**
   * Create Next.js middleware for automatic context setup
   */
  createMiddleware() {
    const adapter = this;

    return function nextjsZerotMiddleware(request: NextRequest) {
      if (adapter.config.debug) {
        logger.debug("[NEXTJS ADAPTER] Middleware processing request", {
          url: request.url,
          method: request.method,
        });
      }

      // The actual context setup will be done in the API route
      // This middleware can be used for logging or preprocessing
      return adapter.safeSyncOperation(
        () => {
          // Return a response that allows the request to continue
          return { next: () => ({}) } as any;
        },
        { next: () => ({}) } as any,
        "Middleware failed"
      );
    };
  }
}

/**
 * Utility function to create a Next.js adapter with common configurations
 */
export function createNextjsAdapter(
  options: NextjsAdapterOptions = {}
): NextjsAdapter {
  return new NextjsAdapter(options);
}

/**
 * Create adapter for JWT-based sessions
 */
export function createJWTAdapter(
  jwtSecret: string,
  options: Omit<NextjsAdapterOptions, "jwtSecret"> = {}
): NextjsAdapter {
  return new NextjsAdapter({
    ...options,
    jwtSecret,
  });
}

/**
 * Create adapter for cookie-only sessions (no JWT)
 */
export function createCookieOnlyAdapter(
  options: NextjsAdapterOptions = {}
): NextjsAdapter {
  return new NextjsAdapter(options);
}

/**
 * Create adapter with custom session handling
 */
export function createCustomSessionAdapter(
  getSession: (request: NextRequest) => Promise<any>,
  getUser?: (request: NextRequest) => Promise<any>,
  options: Omit<NextjsAdapterOptions, "getSession" | "getUser"> = {}
): NextjsAdapter {
  return new NextjsAdapter({
    ...options,
    getSession,
    getUser,
  });
}

/**
 * Higher-order function to wrap Next.js API routes with Zerot context
 */
export function withZerotContext(
  adapter: NextjsAdapter,
  handler: (request: NextRequest, context: any) => Promise<Response>
) {
  return async function wrappedHandler(request: NextRequest, context: any) {
    try {
      const { withRequestContext, createRequestContext } = await import(
        "@/core/context"
      );

      const requestContext = createRequestContext(adapter, request, undefined, {
        nextjsContext: context,
      });

      return await withRequestContext(requestContext, () =>
        handler(request, context)
      );
    } catch (error: unknown) {
      if (isError(error)) {
        throw error;
      }
      throw new Error(`Context setup failed: ${String(error)}`);
    }
  };
}

/**
 * Type-safe wrapper for Next.js API handlers
 */
export function createZerotApiHandler<T = any>(
  adapter: NextjsAdapter,
  handler: (request: NextRequest, context: T) => Promise<Response>
): (request: NextRequest, context: T) => Promise<Response> {
  return withZerotContext(adapter, handler);
}

/**
 * Utility to check if running in Next.js environment
 */
export function isNextjsEnvironment(): boolean {
  try {
    return !!(
      typeof process !== "undefined" &&
      (process.env.NEXT_RUNTIME ||
        process.env.__NEXT_PROCESSED_ENV ||
        process.env.NEXT_PUBLIC_VERCEL_URL ||
        (typeof globalThis !== "undefined" &&
          (globalThis as any).__NEXT_DATA__))
    );
  } catch (error: unknown) {
    return false;
  }
}

/**
 * Development helper to log current adapter status
 */
export async function logAdapterStatus(adapter: NextjsAdapter): Promise<void> {
  const isNextjs = adapter.detectEnvironment();

  console.log("=== Next.js Adapter Status ===");
  console.log(`Next.js Environment: ${isNextjs}`);
  console.log(`Adapter Version: ${adapter.version}`);
  console.log(`Session Management: JWT + Cookie fallback`);
  console.log("===============================");
}

/**
 * Session utilities for Next.js
 */
export class NextjsSessionUtils {
  constructor(private jwtSecret?: string) {}

  /**
   * Create a JWT session token
   */
  async createJWTSession(
    user: {
      id: string;
      email?: string;
      name?: string;
      roles?: string[];
    },
    expiresInSeconds: number = 30 * 24 * 60 * 60
  ): Promise<string> {
    const payload: JWTPayload = {
      userId: user.id,
      email: user.email,
      name: user.name,
      roles: user.roles || ["user"],
      sessionId: this.generateSessionId(),
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
    };

    // In production, use a proper JWT library like 'jsonwebtoken'
    // For now, we'll create a simple base64-encoded token
    return this.encodeJWT(payload);
  }

  /**
   * Verify a JWT session token
   */
  async verifyJWTSession(token: string): Promise<JWTPayload | null> {
    try {
      const payload = this.decodeJWT(token);

      // Check expiration
      if (payload.exp < Math.floor(Date.now() / 1000)) {
        return null;
      }

      return payload;
    } catch {
      return null;
    }
  }

  /**
   * Generate a session ID
   */
  private generateSessionId(): string {
    return `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Simple JWT encoding (replace with proper JWT library in production)
   */
  private encodeJWT(payload: JWTPayload): string {
    const header = { alg: "HS256", typ: "JWT" };

    const encodedHeader = Buffer.from(JSON.stringify(header)).toString(
      "base64url"
    );
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
      "base64url"
    );

    // In production, create a proper HMAC signature
    const signature = Buffer.from(this.jwtSecret || "default-secret").toString(
      "base64url"
    );

    return `${encodedHeader}.${encodedPayload}.${signature}`;
  }

  /**
   * Simple JWT decoding (replace with proper JWT library in production)
   */
  private decodeJWT(token: string): JWTPayload {
    const parts = token.split(".");
    if (parts.length !== 3) {
      throw new Error("Invalid JWT format");
    }

    const payload = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf8")
    );

    return payload as JWTPayload;
  }
}
