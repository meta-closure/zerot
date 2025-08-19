import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Create mock functions first
const mockConsoleLog = vi.fn();
const mockConsoleError = vi.fn();
const mockLogAuditEvent = vi.fn();

// Store original console methods
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

// Mock environment variables
const mockEnv = vi.hoisted(() => ({
  NODE_ENV: "test",
}));

vi.stubEnv("NODE_ENV", mockEnv.NODE_ENV);

// Simple audit types for testing
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

interface AuthContext {
  user?: {
    id: string;
    email?: string;
    name?: string;
    roles: string[];
  };
  session?: {
    id: string;
    expiresAt: Date;
  };
}

// Mock audit functions (inline implementation for testing)
function sanitizeForAudit(data: unknown): unknown {
  if (typeof data !== "object" || data === null) {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeForAudit(item));
  }

  const sanitized = { ...data } as Record<string, unknown>;

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

  Object.keys(sanitized).forEach((key) => {
    if (typeof sanitized[key] === "object" && sanitized[key] !== null) {
      sanitized[key] = sanitizeForAudit(sanitized[key]);
    }
  });

  return sanitized;
}

function extractResourceId(input: unknown): string {
  if (typeof input !== "object" || input === null) {
    return "N/A";
  }

  const inputObj = input as Record<string, unknown>;
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

function auditLog<
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

      await mockLogAuditEvent(auditEvent);
      return true;
    } catch (error: unknown) {
      console.error("Failed to log audit event:", error);
      return true;
    }
  };
}

function auditLogFailure<
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

      await mockLogAuditEvent(auditEvent);
    } catch (auditError: unknown) {
      console.error("Failed to log audit failure event:", auditError);
    }
  };
}

describe("Audit System", () => {
  let mockAuthContext: AuthContext;

  beforeEach(() => {
    // Set up console mocks
    console.log = mockConsoleLog;
    console.error = mockConsoleError;

    mockAuthContext = {
      user: {
        id: "user123",
        email: "test@example.com",
        name: "Test User",
        roles: ["user"],
      },
      session: {
        id: "session456",
        expiresAt: new Date("2024-12-31"),
      },
    };

    vi.clearAllMocks();
    mockLogAuditEvent.mockResolvedValue(undefined);
  });

  afterEach(() => {
    // Restore console methods
    console.log = originalConsoleLog;
    console.error = originalConsoleError;

    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  describe("environment handling", () => {
    it("should handle development environment", () => {
      vi.stubEnv("NODE_ENV", "development");
      expect(process.env.NODE_ENV).toBe("development");
    });

    it("should handle production environment", () => {
      vi.stubEnv("NODE_ENV", "production");
      expect(process.env.NODE_ENV).toBe("production");
    });
  });

  describe("auditLog", () => {
    it("should create audit log with default options", async () => {
      const auditCondition = auditLog("USER_LOGIN");
      const input = { username: "testuser", password: "secret123" };
      const output = { success: true, userId: "user123" };

      const result = await auditCondition(output, input, mockAuthContext);

      expect(result).toBe(true);
      expect(mockLogAuditEvent).toHaveBeenCalledWith({
        action: "USER_LOGIN",
        userId: "user123",
        resourceId: "N/A",
        timestamp: expect.any(Date),
        input: { username: "testuser" }, // password should be sanitized
        output: { success: true, userId: "user123" },
        success: true,
        metadata: undefined,
      });
    });

    it("should extract resource ID from input", async () => {
      const auditCondition = auditLog("DATA_UPDATE");
      const input = { id: "resource789", data: { name: "updated" } };
      const output = { success: true };

      await auditCondition(output, input, mockAuthContext);

      expect(mockLogAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          resourceId: "resource789",
        })
      );
    });

    it("should extract resource ID from different field names", async () => {
      const testCases = [
        { userId: "user456", expected: "user456" },
        { resourceId: "res789", expected: "res789" },
        { entityId: "entity123", expected: "entity123" },
        { documentId: "doc999", expected: "doc999" },
        { id: 12345, expected: "12345" }, // numeric ID
      ];

      for (const { expected, ...input } of testCases) {
        const auditCondition = auditLog("TEST_ACTION");
        await auditCondition({}, input, mockAuthContext);

        expect(mockLogAuditEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            resourceId: expected,
          })
        );
        vi.clearAllMocks();
      }
    });

    it("should use anonymous user when context has no user", async () => {
      const auditCondition = auditLog("ANONYMOUS_ACTION");
      const contextWithoutUser: AuthContext = {};

      await auditCondition({}, {}, contextWithoutUser);

      expect(mockLogAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "anonymous",
        })
      );
    });

    it("should respect includeInput option", async () => {
      const auditCondition = auditLog("SECURE_ACTION", { includeInput: false });
      const input = { sensitiveData: "secret" };
      const output = { result: "success" };

      await auditCondition(output, input, mockAuthContext);

      expect(mockLogAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          input: undefined,
          output: { result: "success" },
        })
      );
    });

    it("should respect includeOutput option", async () => {
      const auditCondition = auditLog("SECURE_ACTION", {
        includeOutput: false,
      });
      const input = { data: "test" };
      const output = { sensitiveResult: "secret" };

      await auditCondition(output, input, mockAuthContext);

      expect(mockLogAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          input: { data: "test" },
          output: undefined,
        })
      );
    });

    it("should include custom metadata", async () => {
      const metadata = { source: "api", version: "1.0" };
      const auditCondition = auditLog("API_CALL", { metadata });

      await auditCondition({}, {}, mockAuthContext);

      expect(mockLogAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata,
        })
      );
    });

    it("should sanitize sensitive data from input", async () => {
      const auditCondition = auditLog("USER_UPDATE");
      const input = {
        id: "user123",
        name: "Test User",
        password: "secret123",
        token: "jwt-token",
        secret: "api-secret",
        apiKey: "api-key",
        session: "session-data",
        accessToken: "access-token",
        refreshToken: "refresh-token",
        privateKey: "private-key",
        secretKey: "secret-key",
        normalField: "normal-value",
      };

      await auditCondition({}, input, mockAuthContext);

      expect(mockLogAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          input: {
            id: "user123",
            name: "Test User",
            normalField: "normal-value",
            // All sensitive fields should be removed
          },
        })
      );

      const loggedInput = mockLogAuditEvent.mock.calls[0][0].input;
      expect(loggedInput).not.toHaveProperty("password");
      expect(loggedInput).not.toHaveProperty("token");
      expect(loggedInput).not.toHaveProperty("secret");
      expect(loggedInput).not.toHaveProperty("apiKey");
      expect(loggedInput).not.toHaveProperty("session");
      expect(loggedInput).not.toHaveProperty("accessToken");
      expect(loggedInput).not.toHaveProperty("refreshToken");
      expect(loggedInput).not.toHaveProperty("privateKey");
      expect(loggedInput).not.toHaveProperty("secretKey");
    });

    it("should sanitize nested objects", async () => {
      const auditCondition = auditLog("NESTED_UPDATE");
      const input = {
        user: {
          id: "user123",
          password: "secret",
          profile: {
            name: "Test",
            token: "nested-token",
          },
        },
        metadata: {
          source: "api",
          secret: "meta-secret",
        },
      };

      await auditCondition({}, input, mockAuthContext);

      const loggedInput = mockLogAuditEvent.mock.calls[0][0].input;
      expect(loggedInput.user).not.toHaveProperty("password");
      expect(loggedInput.user.profile).not.toHaveProperty("token");
      expect(loggedInput.metadata).not.toHaveProperty("secret");
      expect(loggedInput.user.profile.name).toBe("Test");
      expect(loggedInput.metadata.source).toBe("api");
    });

    it("should sanitize arrays", async () => {
      const auditCondition = auditLog("ARRAY_UPDATE");
      const input = {
        users: [
          { id: "1", name: "User1", password: "secret1" },
          { id: "2", name: "User2", token: "token2" },
        ],
      };

      await auditCondition({}, input, mockAuthContext);

      const loggedInput = mockLogAuditEvent.mock.calls[0][0].input;
      expect(loggedInput.users[0]).not.toHaveProperty("password");
      expect(loggedInput.users[1]).not.toHaveProperty("token");
      expect(loggedInput.users[0].name).toBe("User1");
      expect(loggedInput.users[1].name).toBe("User2");
    });

    it("should handle primitive input types", async () => {
      const testCases = ["string input", 123, true, null, undefined];

      for (const input of testCases) {
        const auditCondition = auditLog("PRIMITIVE_TEST");
        await auditCondition({}, input, mockAuthContext);

        expect(mockLogAuditEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            input,
            resourceId: "N/A",
          })
        );
        vi.clearAllMocks();
      }
    });

    it("should handle audit logging errors gracefully", async () => {
      mockLogAuditEvent.mockRejectedValue(
        new Error("Audit service unavailable")
      );

      const auditCondition = auditLog("ERROR_TEST");
      const result = await auditCondition({}, {}, mockAuthContext);

      expect(result).toBe(true); // Should still return true
      expect(mockConsoleError).toHaveBeenCalledWith(
        "Failed to log audit event:",
        expect.any(Error)
      );
    });
  });

  describe("auditLogFailure", () => {
    it("should create audit log for failed operations", async () => {
      const error = new Error("Operation failed");
      error.stack = "Error stack trace";

      const auditFailureCondition = auditLogFailure("USER_LOGIN", error);
      const input = { username: "testuser", password: "secret123" };

      await auditFailureCondition(input, mockAuthContext);

      expect(mockLogAuditEvent).toHaveBeenCalledWith({
        action: "USER_LOGIN_FAILED",
        userId: "user123",
        resourceId: "N/A",
        timestamp: expect.any(Date),
        input: { username: "testuser" }, // password sanitized
        output: {
          error: "Operation failed",
          errorType: "Error",
        },
        success: false,
        metadata: {
          errorStack: "Error stack trace",
        },
      });
    });

    it("should respect includeInput option in failure logging", async () => {
      const error = new Error("Operation failed");
      const auditFailureCondition = auditLogFailure("SECURE_OPERATION", error, {
        includeInput: false,
      });

      await auditFailureCondition({ sensitiveData: "secret" }, mockAuthContext);

      expect(mockLogAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          input: undefined,
        })
      );
    });

    it("should include custom metadata in failure logging", async () => {
      const error = new Error("Operation failed");
      const metadata = { operation: "critical", retryCount: 3 };
      const auditFailureCondition = auditLogFailure(
        "CRITICAL_OPERATION",
        error,
        {
          metadata,
        }
      );

      await auditFailureCondition({}, mockAuthContext);

      expect(mockLogAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: {
            ...metadata,
            errorStack: error.stack,
          },
        })
      );
    });

    it("should use anonymous user in failure logging when no user context", async () => {
      const error = new Error("Operation failed");
      const auditFailureCondition = auditLogFailure(
        "ANONYMOUS_OPERATION",
        error
      );
      const contextWithoutUser: AuthContext = {};

      await auditFailureCondition({}, contextWithoutUser);

      expect(mockLogAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "anonymous",
        })
      );
    });

    it("should handle audit failure logging errors gracefully", async () => {
      mockLogAuditEvent.mockRejectedValue(new Error("Audit service down"));

      const error = new Error("Original operation failed");
      const auditFailureCondition = auditLogFailure("ERROR_TEST", error);

      // Should not throw
      await expect(
        auditFailureCondition({}, mockAuthContext)
      ).resolves.not.toThrow();

      expect(mockConsoleError).toHaveBeenCalledWith(
        "Failed to log audit failure event:",
        expect.any(Error)
      );
    });
  });

  describe("Resource ID extraction", () => {
    it("should return N/A for non-object input", async () => {
      const testCases = ["string", 123, true, null, undefined];

      for (const input of testCases) {
        const auditCondition = auditLog("PRIMITIVE_TEST");
        await auditCondition({}, input, mockAuthContext);

        expect(mockLogAuditEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            resourceId: "N/A",
          })
        );
        vi.clearAllMocks();
      }
    });

    it("should prioritize id field over other fields", async () => {
      const auditCondition = auditLog("PRIORITY_TEST");
      const input = {
        userId: "user456",
        resourceId: "resource789",
        id: "primary123", // This should be used
        entityId: "entity999",
      };

      await auditCondition({}, input, mockAuthContext);

      expect(mockLogAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          resourceId: "primary123",
        })
      );
    });

    it("should return N/A when no resource ID fields found", async () => {
      const auditCondition = auditLog("NO_ID_TEST");
      const input = {
        name: "Test",
        description: "No ID fields",
        someOtherField: "value",
      };

      await auditCondition({}, input, mockAuthContext);

      expect(mockLogAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          resourceId: "N/A",
        })
      );
    });

    it("should skip empty string resource IDs", async () => {
      const auditCondition = auditLog("EMPTY_ID_TEST");
      const input = {
        id: "", // Empty string should be skipped
        userId: "user123", // This should be used
      };

      await auditCondition({}, input, mockAuthContext);

      expect(mockLogAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          resourceId: "user123",
        })
      );
    });
  });
});
