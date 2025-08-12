// Mock rate limit functions
const mockRateLimitStore = new Map<string, { count: number; lastReset: number }>();
const mockGetRateLimitCount = jest.fn(async (key: string) => {
  const entry = mockRateLimitStore.get(key);
  if (!entry || (Date.now() - entry.lastReset) > 60 * 1000) {
    mockRateLimitStore.set(key, { count: 0, lastReset: Date.now() });
    return 0;
  }
  return entry.count;
});
const mockIncrementRateLimitCount = jest.fn(async (key: string) => {
  const entry = mockRateLimitStore.get(key);
  if (entry) {
    entry.count++;
  } else {
    mockRateLimitStore.set(key, { count: 1, lastReset: Date.now() });
  }
});
const mockAuditLog = jest.fn((action: string) => async () => {
  // console.log(`Mock Audit Log: ${action}`);
  return true;
});

import {
  contract,
  ContractError,
  ContractViolationError,
  setSessionProvider,
  auth,
  owns,
  validates,
  returns,
  rateLimit,
  auditLog,
  businessRule,
} from "zerot";
import type { AuthContext } from "zerot/core/types"; // Use import type for AuthContext
import { z } from "zod";

jest.mock('zerot/conditions/rate-limit', () => ({
  ...jest.requireActual('zerot/conditions/rate-limit'),
  getRateLimitCount: mockGetRateLimitCount,
  incrementRateLimitCount: mockIncrementRateLimitCount,
}));

jest.mock('zerot/conditions/audit', () => ({
  ...jest.requireActual('zerot/conditions/audit'),
  auditLog: mockAuditLog,
}));

// Mock getResourceById for owns condition
// This needs to be globally available for the owns condition to work in tests
declare global {
  var getResourceById: (resourceId: string) => Promise<{ id: string; userId: string } | null>;
}
global.getResourceById = jest.fn(async (resourceId: string) => {
  const resources: { [key: string]: { id: string; userId: string } } = { // Add index signature
    "resource-123": { id: "resource-123", userId: "user-123" },
    "resource-456": { id: "resource-456", userId: "user-456" },
  };
  return resources[resourceId] || null;
});

describe("Contract System Unit Tests", () => {
  let mockContext: AuthContext;

  beforeEach(() => {
    mockContext = {
      user: { id: "user-123", roles: ["user"], email: "test@example.com" },
      session: { id: "session-123", expiresAt: new Date(Date.now() + 3600000) },
    };
    // Reset mocks
    (global.getResourceById as jest.Mock).mockClear();
    mockRateLimitStore.clear();
    mockGetRateLimitCount.mockClear();
    mockIncrementRateLimitCount.mockClear();
    mockAuditLog.mockClear();

    // Set a default session provider for tests
    setSessionProvider(() => mockContext);
  });

  describe("@contract decorator", () => {
    it("should execute original method if all conditions pass", async () => {
      class TestService {
        @contract({
          requires: [
            (input: string) => input === "valid",
            (input: string, context: AuthContext) => context.user?.id === "user-123",
          ],
          ensures: [(output: string) => output === "processed:valid"],
          layer: "test",
        })
        async process(input: string, context: AuthContext): Promise<string> {
          return `processed:${input}`;
        }
      }

      const service = new TestService();
      await expect(service.process("valid", mockContext)).resolves.toBe("processed:valid");
    });

    it("should throw ContractViolationError for failed precondition (requires)", async () => {
      class TestService {
        @contract({
          requires: [(input: string) => input === "valid"],
          layer: "test",
        })
        async process(input: string, context: AuthContext): Promise<string> {
          return `processed:${input}`;
        }
      }

      const service = new TestService();
      await expect(service.process("invalid", mockContext)).rejects.toThrow(ContractViolationError);
      await expect(service.process("invalid", mockContext)).rejects.toHaveProperty('layer', 'test');
      await expect(service.process("invalid", mockContext)).rejects.toHaveProperty('originalError.type', 'PRECONDITION_FAILED');
    });

    it("should throw ContractViolationError for failed postcondition (ensures)", async () => {
      class TestService {
        @contract({
          ensures: [(output: string) => output === "expected"],
          layer: "test",
        })
        async process(input: string, context: AuthContext): Promise<string> {
          return `processed:${input}`;
        }
      }

      const service = new TestService();
      await expect(service.process("any", mockContext)).rejects.toThrow(ContractViolationError);
      await expect(service.process("any", mockContext)).rejects.toHaveProperty('layer', 'test');
      await expect(service.process("any", mockContext)).rejects.toHaveProperty('originalError.type', 'POSTCONDITION_FAILED');
    });

    it("should throw ContractViolationError for failed invariant", async () => {
      class TestService {
        @contract({
          invariants: [(input: string, output: string) => input === output],
          layer: "test",
        })
        async process(input: string, context: AuthContext): Promise<string> {
          return `processed:${input}`;
        }
      }

      const service = new TestService();
      await expect(service.process("input", mockContext)).rejects.toThrow(ContractViolationError);
      await expect(service.process("input", mockContext)).rejects.toHaveProperty('layer', 'test');
      await expect(service.process("input", mockContext)).rejects.toHaveProperty('originalError.type', 'INVARIANT_VIOLATION');
    });

    it("should use global context if not provided in arguments", async () => {
      class TestService {
        @contract({
          requires: [(input: string, context: AuthContext) => context.user?.id === "user-123"],
          layer: "test",
        })
        async process(input: string): Promise<string> { // No context argument here
          return `processed:${input}`;
        }
      }
      const service = new TestService();
      await expect(service.process("valid")).resolves.toBe("processed:valid"); // No context passed
    });
  });

  describe("Authentication Contract (auth)", () => {
    it("should pass with valid user and required role", async () => {
      const condition = auth("user");
      await expect(condition({}, mockContext)).resolves.toBe(true);
    });

    it("should throw AUTHENTICATION_REQUIRED if no user in context", async () => {
      const condition = auth("user");
      mockContext.user = undefined;
      await expect(condition({}, mockContext)).rejects.toThrow(ContractError);
      await expect(condition({}, mockContext)).rejects.toHaveProperty('type', 'AUTHENTICATION_REQUIRED');
    });

    it("should throw SESSION_EXPIRED if session is expired", async () => {
      const condition = auth("user");
      mockContext.session!.expiresAt = new Date(Date.now() - 1000);
      await expect(condition({}, mockContext)).rejects.toThrow(ContractError);
      await expect(condition({}, mockContext)).rejects.toHaveProperty('type', 'SESSION_EXPIRED');
    });

    it("should throw INSUFFICIENT_ROLE if user does not have required role", async () => {
      const condition = auth("admin");
      await expect(condition({}, mockContext)).rejects.toThrow(ContractError);
      await expect(condition({}, mockContext)).rejects.toHaveProperty('type', 'INSUFFICIENT_ROLE');
    });
  });

  describe("Ownership Contract (owns)", () => {
    it("should pass for resource owner", async () => {
      (global.getResourceById as jest.Mock).mockResolvedValueOnce({ id: "resource-123", userId: "user-123" });
      const condition = owns("resourceId");
      await expect(condition({ resourceId: "resource-123" }, mockContext)).resolves.toBe(true);
    });

    it("should pass for admin user", async () => {
      mockContext.user!.roles = ["admin"];
      const condition = owns("resourceId");
      await expect(condition({ resourceId: "any-resource" }, mockContext)).resolves.toBe(true);
      expect(global.getResourceById).not.toHaveBeenCalled(); // Admin bypasses ownership check
    });

    it("should throw MISSING_RESOURCE_ID if resourceIdField is missing", async () => {
      const condition = owns("missingId");
      await expect(condition({}, mockContext)).rejects.toThrow(ContractError);
      await expect(condition({}, mockContext)).rejects.toHaveProperty('type', 'MISSING_RESOURCE_ID');
    });

    it("should throw OWNERSHIP_DENIED if user does not own resource", async () => {
      (global.getResourceById as jest.Mock).mockResolvedValueOnce({ id: "resource-456", userId: "user-other" });
      const condition = owns("resourceId");
      await expect(condition({ resourceId: "resource-456" }, mockContext)).rejects.toThrow(ContractError);
      await expect(condition({ resourceId: "resource-456" }, mockContext)).rejects.toHaveProperty('type', 'OWNERSHIP_DENIED');
    });
  });

  describe("Validation Contract (validates)", () => {
    const testSchema = z.object({ name: z.string().min(3) });

    it("should return validated input if schema passes", () => {
      const condition = validates(testSchema);
      const validated = condition({ name: "test" });
      expect(validated).toEqual({ name: "test" });
    });

    it("should throw VALIDATION_FAILED if schema fails", () => {
      const condition = validates(testSchema);
      expect(() => condition({ name: "ab" })).toThrow(ContractError);
      expect(() => condition({ name: "ab" })).toThrow("Input validation failed");
    });
  });

  describe("Returns Contract (returns)", () => {
    const testSchema = z.object({ result: z.boolean() });

    it("should return true if output matches schema", () => {
      const condition = returns(testSchema);
      expect(condition({ result: true }, {}, {})).toBe(true);
    });

    it("should throw OUTPUT_VALIDATION_FAILED if output does not match schema", () => {
      const condition = returns(testSchema);
      expect(() => condition({ result: "not-boolean" }, {}, {})).toThrow(ContractError);
      expect(() => condition({ result: "not-boolean" }, {}, {})).toThrow("Output does not match expected schema");
    });
  });

  describe("Rate Limit Contract (rateLimit)", () => {
    it("should pass if within limit", async () => {
      const condition = rateLimit("testOperation", 2);
      await expect(condition({}, mockContext)).resolves.toBe(true);
      await expect(condition({}, mockContext)).resolves.toBe(true);
    });

    it("should throw RATE_LIMIT_ERROR if user ID is missing", async () => {
      mockContext.user = undefined;
      const condition = rateLimit("testOperation", 1);
      await expect(condition({}, mockContext)).rejects.toThrow(ContractError);
      await expect(condition({}, mockContext)).rejects.toHaveProperty('type', 'RATE_LIMIT_ERROR');
    });
  });

  describe("Audit Log Contract (auditLog)", () => {
    it("should return true and log audit event", async () => {
      const condition = auditLog("user_login");
      await expect(condition({ success: true }, { username: "test" }, mockContext)).resolves.toBe(true);
      expect(mockAuditLog).toHaveBeenCalledTimes(1); // Check if the mock was called
      expect(mockAuditLog).toHaveBeenCalledWith("user_login");
    });
  });

  describe("Business Rule Contract (businessRule)", () => {
    it("should pass if rule returns true", async () => {
      const condition = businessRule("Always true", () => true);
      await expect(condition({}, mockContext)).resolves.toBe(true);
    });

    it("should throw BUSINESS_RULE_VIOLATION if rule returns false", async () => {
      const condition = businessRule("Always false", () => false);
      await expect(condition({}, mockContext)).rejects.toThrow(ContractError);
      await expect(condition({}, mockContext)).rejects.toHaveProperty('type', 'BUSINESS_RULE_VIOLATION');
      await expect(condition({}, mockContext)).rejects.toHaveProperty('message', 'Always false');
    });

    it("should handle async business rules", async () => {
      const condition = businessRule("Async rule", async () => Promise.resolve(true));
      await expect(condition({}, mockContext)).resolves.toBe(true);
    });
  });
});
