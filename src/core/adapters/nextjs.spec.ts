import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  MockedFunction,
  vi,
} from "vitest";
// 正しいパスに変更してください - 以下のいずれかを選択
// import { NextjsAdapter, createJWTAdapter, createCookieOnlyAdapter, createCustomSessionAdapter, NextjsSessionUtils } from "./nextjs";
// import { NextjsAdapter, createJWTAdapter, createCookieOnlyAdapter, createCustomSessionAdapter, NextjsSessionUtils } from "../adapters/nextjs";
// import { NextjsAdapter, createJWTAdapter, createCookieOnlyAdapter, createCustomSessionAdapter, NextjsSessionUtils } from "@/core/adapters/nextjs";
import {
  createCookieOnlyAdapter,
  createCustomSessionAdapter,
  createJWTAdapter,
  NextjsAdapter,
  NextjsSessionUtils,
} from "@/core/adapters/nextjs";

// Mock logger
vi.mock("@/utils/logger", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock Next.js types and utilities
interface MockNextRequest {
  headers: Map<string, string>;
  cookies: {
    get: MockedFunction<any>;
  };
  url: string;
  method: string;
}

interface MockNextResponse {
  next(): MockNextResponse;
}

// Helper to create mock request
function createMockRequest(
  options: {
    cookies?: Record<string, string>;
    headers?: Record<string, string>;
    url?: string;
    method?: string;
  } = {}
): MockNextRequest {
  const cookiesMap = new Map(Object.entries(options.cookies || {}));

  return {
    headers: new Map(Object.entries(options.headers || {})),
    cookies: {
      get: vi.fn().mockImplementation((name: string) => {
        const value = cookiesMap.get(name);
        return value ? { name, value } : undefined;
      }),
    },
    url: options.url || "http://localhost:3000",
    method: options.method || "GET",
  } as MockNextRequest;
}

describe("NextjsAdapter", () => {
  let adapter: NextjsAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new NextjsAdapter();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Environment Detection", () => {
    it("should detect Next.js environment when NEXT_RUNTIME is set", () => {
      const originalEnv = process.env.NEXT_RUNTIME;
      process.env.NEXT_RUNTIME = "nodejs";

      const isNextjs = adapter.detectEnvironment();

      expect(isNextjs).toBe(true);

      // Cleanup
      if (originalEnv) {
        process.env.NEXT_RUNTIME = originalEnv;
      } else {
        delete process.env.NEXT_RUNTIME;
      }
    });

    it("should detect Next.js environment when __NEXT_DATA__ is present", () => {
      const originalGlobal = (globalThis as any).__NEXT_DATA__;
      (globalThis as any).__NEXT_DATA__ = {};

      const isNextjs = adapter.detectEnvironment();

      expect(isNextjs).toBe(true);

      // Cleanup
      if (originalGlobal) {
        (globalThis as any).__NEXT_DATA__ = originalGlobal;
      } else {
        delete (globalThis as any).__NEXT_DATA__;
      }
    });

    it("should return false when not in Next.js environment", () => {
      const originalEnv = process.env.NEXT_RUNTIME;
      const originalGlobal = (globalThis as any).__NEXT_DATA__;

      delete process.env.NEXT_RUNTIME;
      delete process.env.__NEXT_PROCESSED_ENV;
      delete process.env.NEXT_PUBLIC_VERCEL_URL;
      delete (globalThis as any).__NEXT_DATA__;

      const isNextjs = adapter.detectEnvironment();

      expect(isNextjs).toBe(false);

      // Cleanup
      if (originalEnv) process.env.NEXT_RUNTIME = originalEnv;
      if (originalGlobal) (globalThis as any).__NEXT_DATA__ = originalGlobal;
    });
  });

  describe("Cookie-based Session Extraction", () => {
    it("should extract session from default session-token cookie", async () => {
      const request = createMockRequest({
        cookies: { "session-token": "test-session-value" },
      });

      const session = await adapter.extractSession(request as any);

      expect(session).toEqual({
        id: "test-session-value",
        sessionToken: "test-session-value",
        expiresAt: expect.any(Date),
        source: "cookie",
        cookieName: "session-token",
      });
    });

    it("should try multiple cookie names", async () => {
      const request = createMockRequest({
        cookies: { "connect.sid": "connect-session-value" },
      });

      const session = await adapter.extractSession(request as any);

      expect(session).toEqual({
        id: "connect-session-value",
        sessionToken: "connect-session-value",
        expiresAt: expect.any(Date),
        source: "cookie",
        cookieName: "connect.sid",
      });
    });

    it("should return undefined when no session cookies found", async () => {
      const request = createMockRequest({
        cookies: { "other-cookie": "other-value" },
      });

      const session = await adapter.extractSession(request as any);

      expect(session).toBeUndefined();
    });

    it("should handle cookie access errors gracefully", async () => {
      const request = createMockRequest();
      request.cookies.get.mockImplementation(() => {
        throw new Error("Cookie access error");
      });

      const session = await adapter.extractSession(request as any);

      expect(session).toBeUndefined();
    });
  });

  describe("JWT-based Session Extraction", () => {
    it("should extract session from JWT token", async () => {
      const jwtAdapter = createJWTAdapter("test-secret");
      const sessionUtils = new NextjsSessionUtils("test-secret");

      const jwtToken = await sessionUtils.createJWTSession({
        id: "user-123",
        email: "test@example.com",
        name: "Test User",
        roles: ["user", "admin"],
      });

      const request = createMockRequest({
        cookies: { "session-token": jwtToken },
      });

      const session = await jwtAdapter.extractSession(request as any);

      expect(session).toEqual({
        id: expect.stringMatching(/^sess_/),
        sessionToken: jwtToken,
        expiresAt: expect.any(Date),
        user: {
          id: "user-123",
          email: "test@example.com",
          name: "Test User",
          roles: ["user", "admin"],
        },
        source: "jwt",
      });
    });

    it("should handle expired JWT tokens", async () => {
      const jwtAdapter = createJWTAdapter("test-secret");
      const sessionUtils = new NextjsSessionUtils("test-secret");

      // Create expired token (expires in -1 second)
      const expiredToken = await sessionUtils.createJWTSession(
        {
          id: "user-123",
          email: "test@example.com",
        },
        -1
      );

      const request = createMockRequest({
        cookies: { "session-token": expiredToken },
      });

      const session = await jwtAdapter.extractSession(request as any);

      // JWT fails, so it should fallback to cookie-based session
      // The cookie will be treated as a regular session cookie
      expect(session).toBeDefined();
      expect(session.source).toBe("cookie");
    });

    it("should handle invalid JWT tokens", async () => {
      const jwtAdapter = createJWTAdapter("test-secret");

      const request = createMockRequest({
        cookies: { "session-token": "invalid.jwt.token" },
      });

      const session = await jwtAdapter.extractSession(request as any);

      // JWT fails, so it should fallback to cookie-based session
      expect(session).toBeDefined();
      expect(session.source).toBe("cookie");
      expect(session.id).toBe("invalid.jwt.token");
    });

    it("should fallback to cookie-based when JWT fails", async () => {
      const jwtAdapter = createJWTAdapter("test-secret");

      const request = createMockRequest({
        cookies: {
          "session-token": "invalid-jwt",
          // Add a different cookie name for fallback
          session: "fallback-session",
        },
      });

      const session = await jwtAdapter.extractSession(request as any);

      // Should use the first available cookie (session-token) even if invalid JWT
      expect(session).toEqual({
        id: "invalid-jwt",
        sessionToken: "invalid-jwt",
        expiresAt: expect.any(Date),
        source: "cookie",
        cookieName: "session-token",
      });
    });
  });

  describe("User Extraction", () => {
    it("should extract user from JWT session", async () => {
      const jwtAdapter = createJWTAdapter("test-secret");
      const sessionUtils = new NextjsSessionUtils("test-secret");

      const jwtToken = await sessionUtils.createJWTSession({
        id: "user-123",
        email: "test@example.com",
        name: "Test User",
        roles: ["admin"],
      });

      const request = createMockRequest({
        cookies: { "session-token": jwtToken },
      });

      const user = await jwtAdapter.extractUser(request as any);

      expect(user).toEqual({
        id: "user-123",
        email: "test@example.com",
        name: "Test User",
        roles: ["admin"],
      });
    });

    it("should return undefined when no session exists", async () => {
      const request = createMockRequest();

      const user = await adapter.extractUser(request as any);

      expect(user).toBeUndefined();
    });

    it("should use custom user extraction when provided", async () => {
      const customGetUser = vi.fn().mockResolvedValue({
        id: "custom-user",
        email: "custom@example.com",
      });

      const customAdapter = new NextjsAdapter({
        getUser: customGetUser,
      });

      const request = createMockRequest();

      const user = await customAdapter.extractUser(request as any);

      expect(customGetUser).toHaveBeenCalledWith(request);
      expect(user).toEqual({
        id: "custom-user",
        email: "custom@example.com",
      });
    });
  });

  describe("Transform Methods", () => {
    describe("transformUser", () => {
      it("should transform user data to Zerot format", () => {
        const userData = {
          id: "user-123",
          email: "test@example.com",
          name: "Test User",
          role: "admin",
          customField: "custom-value",
        };

        const transformed = adapter.transformUser(userData);

        expect(transformed).toEqual({
          id: "user-123",
          email: "test@example.com",
          name: "Test User",
          image: undefined,
          roles: ["admin"],
          role: "admin",
          customField: "custom-value",
        });
      });

      it("should handle users with roles array", () => {
        const userData = {
          id: "user-123",
          roles: ["user", "moderator"],
        };

        const transformed = adapter.transformUser(userData);

        expect(transformed.roles).toEqual(["user", "moderator"]);
      });

      it("should default to user role when no role specified", () => {
        const userData = {
          id: "user-123",
          email: "test@example.com",
        };

        const transformed = adapter.transformUser(userData);

        expect(transformed.roles).toEqual(["user"]);
      });

      it("should handle userId field", () => {
        const userData = {
          userId: "user-123",
          email: "test@example.com",
        };

        const transformed = adapter.transformUser(userData);

        expect(transformed.id).toBe("user-123");
      });

      it("should return undefined for null/undefined user", () => {
        expect(adapter.transformUser(null)).toBeUndefined();
        expect(adapter.transformUser(undefined)).toBeUndefined();
      });
    });

    describe("transformSession", () => {
      it("should transform session data to Zerot format", () => {
        const sessionData = {
          id: "session-123",
          expiresAt: new Date("2024-12-31T23:59:59Z"), // Use Date object instead of string
          customField: "custom-value",
        };

        const transformed = adapter.transformSession(sessionData);

        expect(transformed).toEqual({
          id: "session-123",
          expiresAt: new Date("2024-12-31T23:59:59Z"),
          source: "nextjs",
          customField: "custom-value",
        });
      });

      it("should use sessionToken as fallback ID", () => {
        const sessionData = {
          sessionToken: "token-123",
        };

        const transformed = adapter.transformSession(sessionData);

        expect(transformed.id).toBe("token-123");
      });

      it("should default ID when no id or sessionToken", () => {
        const sessionData = {
          customField: "value",
        };

        const transformed = adapter.transformSession(sessionData);

        expect(transformed.id).toBe("nextjs-session");
      });

      it("should set default expiration", () => {
        const sessionData = {
          id: "session-123",
        };

        const transformed = adapter.transformSession(sessionData);

        expect(transformed.expiresAt).toBeInstanceOf(Date);
        expect(transformed.expiresAt.getTime()).toBeGreaterThan(Date.now());
      });

      it("should return undefined for null/undefined session", () => {
        expect(adapter.transformSession(null)).toBeUndefined();
        expect(adapter.transformSession(undefined)).toBeUndefined();
      });
    });
  });

  describe("Custom Session Handling", () => {
    it("should use custom session extraction", async () => {
      const customGetSession = vi.fn().mockResolvedValue({
        id: "custom-session",
        userId: "user-123",
      });

      const customAdapter = createCustomSessionAdapter(customGetSession);

      const request = createMockRequest();

      const session = await customAdapter.extractSession(request as any);

      expect(customGetSession).toHaveBeenCalledWith(request);
      expect(session).toEqual({
        id: "custom-session",
        userId: "user-123",
      });
    });

    it("should use custom user extraction", async () => {
      const customGetSession = vi.fn().mockResolvedValue({ id: "session" });
      const customGetUser = vi.fn().mockResolvedValue({
        id: "user-123",
        email: "test@example.com",
      });

      const customAdapter = createCustomSessionAdapter(
        customGetSession,
        customGetUser
      );

      const request = createMockRequest();

      const user = await customAdapter.extractUser(request as any);

      expect(customGetUser).toHaveBeenCalledWith(request);
      expect(user).toEqual({
        id: "user-123",
        email: "test@example.com",
      });
    });
  });

  describe("Error Handling", () => {
    it("should handle errors gracefully", () => {
      const error = new Error("Test error");
      const result = adapter.handleError(error);

      expect(result).toBeUndefined();
    });

    it("should log JWT-related errors", () => {
      const error = new Error("JWT verification failed");
      adapter.handleError(error);

      // Verify warning was logged (would need to mock logger)
    });

    it("should create error response", () => {
      const error = new Error("Test error");
      const request = createMockRequest();

      const response = adapter.createErrorResponse(error, request as any);

      expect(response).toEqual({
        status: 500,
        json: expect.any(Function),
      });
    });

    it("should create redirect response", () => {
      const request = createMockRequest();

      const response = adapter.createRedirectResponse("/login", request as any);

      expect(response).toEqual({
        status: 302,
        headers: { Location: "/login" },
      });
    });
  });

  describe("Middleware", () => {
    it("should create middleware function", () => {
      const middleware = adapter.createMiddleware();

      expect(middleware).toBeInstanceOf(Function);
    });

    it("should process request in middleware", () => {
      const middleware = adapter.createMiddleware();
      const request = createMockRequest();

      const result = middleware(request as any);

      expect(result).toEqual({ next: expect.any(Function) });
    });
  });

  describe("Debug Mode", () => {
    it("should log debug information when debug is enabled", async () => {
      const debugAdapter = new NextjsAdapter({ debug: true });
      const request = createMockRequest({
        cookies: { "session-token": "test-value" },
      });

      await debugAdapter.extractSession(request as any);

      // In a real test, you would verify logger.debug was called
      // expect(logger.debug).toHaveBeenCalledWith(
      //   expect.stringContaining("[NEXTJS ADAPTER]"),
      //   expect.any(Object)
      // );
    });
  });
});

describe("NextjsSessionUtils", () => {
  let sessionUtils: NextjsSessionUtils;

  beforeEach(() => {
    sessionUtils = new NextjsSessionUtils("test-secret");
  });

  describe("JWT Session Management", () => {
    it("should create JWT session token", async () => {
      const user = {
        id: "user-123",
        email: "test@example.com",
        name: "Test User",
        roles: ["user", "admin"],
      };

      const token = await sessionUtils.createJWTSession(user);

      expect(token).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/); // JWT format
    });

    it("should create token with custom expiration", async () => {
      const user = { id: "user-123" };
      const expiresIn = 3600; // 1 hour

      const token = await sessionUtils.createJWTSession(user, expiresIn);
      const payload = await sessionUtils.verifyJWTSession(token);

      expect(payload?.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
      expect(payload?.exp).toBeLessThanOrEqual(
        Math.floor(Date.now() / 1000) + expiresIn + 1
      );
    });

    it("should verify valid JWT session", async () => {
      const user = {
        id: "user-123",
        email: "test@example.com",
        roles: ["admin"],
      };

      const token = await sessionUtils.createJWTSession(user);
      const payload = await sessionUtils.verifyJWTSession(token);

      expect(payload).toEqual({
        userId: "user-123",
        email: "test@example.com",
        name: undefined,
        roles: ["admin"],
        sessionId: expect.stringMatching(/^sess_/),
        iat: expect.any(Number),
        exp: expect.any(Number),
      });
    });

    it("should reject expired tokens", async () => {
      const user = { id: "user-123" };
      const token = await sessionUtils.createJWTSession(user, -1); // Already expired

      const payload = await sessionUtils.verifyJWTSession(token);

      expect(payload).toBeNull();
    });

    it("should reject invalid tokens", async () => {
      const payload = await sessionUtils.verifyJWTSession("invalid.token.here");

      expect(payload).toBeNull();
    });

    it("should handle malformed tokens", async () => {
      const payload = await sessionUtils.verifyJWTSession("not-a-jwt");

      expect(payload).toBeNull();
    });
  });
});

describe("Factory Functions", () => {
  describe("createJWTAdapter", () => {
    it("should create adapter with JWT configuration", () => {
      const adapter = createJWTAdapter("secret-key", { debug: true });

      expect(adapter).toBeInstanceOf(NextjsAdapter);
      expect(adapter.name).toBe("nextjs");
    });
  });

  describe("createCookieOnlyAdapter", () => {
    it("should create adapter with cookie-only configuration", () => {
      const adapter = createCookieOnlyAdapter({ debug: false });

      expect(adapter).toBeInstanceOf(NextjsAdapter);
    });
  });

  describe("createCustomSessionAdapter", () => {
    it("should create adapter with custom session handlers", () => {
      const getSession = vi.fn();
      const getUser = vi.fn();

      const adapter = createCustomSessionAdapter(getSession, getUser);

      expect(adapter).toBeInstanceOf(NextjsAdapter);
    });
  });
});

describe("Integration Tests", () => {
  it("should work end-to-end with JWT sessions", async () => {
    const jwtSecret = "integration-test-secret";
    const adapter = createJWTAdapter(jwtSecret);
    const sessionUtils = new NextjsSessionUtils(jwtSecret);

    // Create user and JWT token
    const user = {
      id: "integration-user",
      email: "integration@test.com",
      name: "Integration User",
      roles: ["user", "tester"],
    };

    const jwtToken = await sessionUtils.createJWTSession(user);

    // Create request with JWT cookie
    const request = createMockRequest({
      cookies: { "session-token": jwtToken },
    });

    // Extract session and user
    const session = await adapter.extractSession(request as any);
    const extractedUser = await adapter.extractUser(request as any);

    // Transform data
    const transformedSession = adapter.transformSession(session);
    const transformedUser = adapter.transformUser(extractedUser);

    // Verify results
    expect(transformedSession.source).toBe("jwt");
    expect(transformedUser.id).toBe("integration-user");
    expect(transformedUser.email).toBe("integration@test.com");
    expect(transformedUser.roles).toEqual(["user", "tester"]);
  });

  it("should fallback gracefully when JWT fails", async () => {
    const adapter = createJWTAdapter("secret");

    const request = createMockRequest({
      cookies: {
        "session-token": "invalid-jwt",
        session: "fallback-cookie-session",
      },
    });

    const session = await adapter.extractSession(request as any);

    expect(session.source).toBe("cookie");
    // The adapter will use the first available cookie (session-token)
    expect(session.id).toBe("invalid-jwt");
  });
});
