import { configureZerot } from "@/config";
import { BaseAdapter } from "@/core/adapters/base";
import {
  clearRequestContext,
  createRequestContext,
  getRequestContext,
  setRequestContext,
  withRequestContext,
} from "@/core/context";
import { ContractError, ErrorCategory } from "@/core/errors";
import {
  AuthContext,
  ContractCondition,
  ContractOptions,
  ContractValidator,
  getAuthContext,
  getResource,
  isValidator,
} from "@/core/types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock adapter for testing
class MockAdapter extends BaseAdapter {
  readonly name = "mock";
  readonly version = "1.0.0";

  private mockUser: any = null;
  private mockSession: any = null;

  constructor(user?: any, session?: any) {
    super();
    this.mockUser = user;
    this.mockSession = session;
  }

  detectEnvironment(): boolean {
    return true;
  }

  async extractUser(request?: any): Promise<any> {
    return this.mockUser;
  }

  async extractSession(request?: any): Promise<any> {
    return this.mockSession;
  }

  setMockUser(user: any) {
    this.mockUser = user;
  }

  setMockSession(session: any) {
    this.mockSession = session;
  }
}

describe("Contract Types and Functions (Adapter System)", () => {
  let mockAdapter: MockAdapter;

  beforeEach(async () => {
    // Clear any existing context
    clearRequestContext();

    // Create fresh mock adapter
    mockAdapter = new MockAdapter();

    // Configure Zerot with mock session provider that uses request context
    await configureZerot({
      sessionProvider: async () => {
        try {
          const context = getRequestContext();
          if (!context?.adapter || !context?.request) {
            console.log("[TEST] No request context available");
            return {};
          }

          const user = await context.adapter.extractUser(context.request);
          const session = await context.adapter.extractSession(context.request);

          return { user, session };
        } catch (error) {
          console.log("[TEST] Error in sessionProvider:", error);
          return {};
        }
      },
      resourceProvider: async (id: string) => {
        // Mock resource provider for testing
        if (id === "resource123") {
          return { id: "resource123", userId: "user456" };
        }
        return null;
      },
    });
  });

  afterEach(() => {
    clearRequestContext();
    vi.clearAllMocks();
  });

  describe("isValidator", () => {
    it("should return true for a valid validator function", () => {
      const validator: ContractValidator<string, number> = (input: string) =>
        parseInt(input, 10);
      validator.isValidator = true;

      const result = isValidator(validator);
      expect(result).toBe(true);
    });

    it("should return false for a validator without isValidator property", () => {
      const validator = (input: string) => parseInt(input, 10);

      const result = isValidator(validator);
      expect(result).toBe(false);
    });

    it("should return false for a validator with isValidator set to false", () => {
      const validator: any = (input: string) => parseInt(input, 10);
      validator.isValidator = false;

      const result = isValidator(validator);
      expect(result).toBe(false);
    });

    it("should return false for a regular condition function", () => {
      const condition: ContractCondition<string, AuthContext> = (
        input,
        context
      ) => {
        return input.length > 0;
      };

      const result = isValidator(condition);
      expect(result).toBe(false);
    });

    it("should return false for non-function values", () => {
      const result = isValidator("not a function" as any);
      expect(result).toBe(false);
    });
  });

  describe("Session Provider with Adapter System", () => {
    it("should extract auth context using adapter", async () => {
      const mockUser = { id: "user123", roles: ["admin"] };
      const mockSession = { id: "session456", expiresAt: new Date() };

      mockAdapter.setMockUser(mockUser);
      mockAdapter.setMockSession(mockSession);

      const requestContext = createRequestContext(mockAdapter, {
        mockRequest: true,
      });

      const result = await withRequestContext(requestContext, async () => {
        return await getAuthContext();
      });

      expect(result.user).toEqual(mockUser);
      expect(result.session).toEqual(mockSession);
    });

    it("should handle adapter returning null user", async () => {
      mockAdapter.setMockUser(null);
      mockAdapter.setMockSession(null);

      const requestContext = createRequestContext(mockAdapter, {
        mockRequest: true,
      });

      const result = await withRequestContext(requestContext, async () => {
        return await getAuthContext();
      });

      expect(result.user).toBeNull();
      expect(result.session).toBeNull();
    });

    it("should return empty context when no request context is set", async () => {
      // Ensure no request context is set
      clearRequestContext();

      const result = await getAuthContext();
      expect(result).toEqual({});
    });

    it("should handle adapter throwing an error gracefully", async () => {
      const errorAdapter = new (class extends MockAdapter {
        async extractUser(): Promise<any> {
          throw new Error("Extraction failed");
        }
      })();

      const requestContext = createRequestContext(errorAdapter, {
        mockRequest: true,
      });

      // The getAuthContext function should handle errors gracefully and return empty context
      const result = await withRequestContext(requestContext, async () => {
        return await getAuthContext();
      });

      expect(result).toEqual({});
    });

    it("should work with custom user and session data", async () => {
      const customUser = {
        id: "user123",
        email: "test@example.com",
        roles: ["user", "editor"],
      };
      const customSession = {
        id: "session456",
        expiresAt: new Date(),
        token: "abc123",
      };

      mockAdapter.setMockUser(customUser);
      mockAdapter.setMockSession(customSession);

      const requestContext = createRequestContext(mockAdapter, {
        mockRequest: true,
      });

      const result = await withRequestContext(requestContext, async () => {
        return await getAuthContext();
      });

      expect(result.user).toEqual(customUser);
      expect(result.session).toEqual(customSession);
    });
  });

  describe("Resource Provider", () => {
    it("should get resource using configured provider", async () => {
      const result = await getResource("resource123");

      expect(result).toEqual({
        id: "resource123",
        userId: "user456",
      });
    });

    it("should return null for non-existent resource", async () => {
      const result = await getResource("nonexistent");
      expect(result).toBeNull();
    });

    it("should handle resource provider errors", async () => {
      // Reconfigure with error-throwing provider
      await configureZerot({
        sessionProvider: async () => ({}),
        resourceProvider: async () => {
          throw new Error("Database error");
        },
      });

      await expect(getResource("resource123")).rejects.toThrow(
        "Database error"
      );
    });
  });

  describe("Request Context Management", () => {
    it("should set and get request context", () => {
      const context = createRequestContext(mockAdapter, { test: true });
      setRequestContext(context);

      const retrieved = getRequestContext();
      expect(retrieved.adapter?.name).toBe("mock");
      expect(retrieved.request).toEqual({ test: true });
    });

    it("should execute function within request context", async () => {
      const context = createRequestContext(mockAdapter, { test: true });

      const result = await withRequestContext(context, async () => {
        const currentContext = getRequestContext();
        return currentContext.request;
      });

      expect(result).toEqual({ test: true });
    });

    it("should isolate contexts between executions", async () => {
      const adapter1 = new MockAdapter();
      const adapter2 = new MockAdapter();

      const context1 = createRequestContext(adapter1, { id: 1 });
      const context2 = createRequestContext(adapter2, { id: 2 });

      const results = await Promise.all([
        withRequestContext(context1, async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          return getRequestContext().request.id;
        }),
        withRequestContext(context2, async () => {
          await new Promise((resolve) => setTimeout(resolve, 5));
          return getRequestContext().request.id;
        }),
      ]);

      expect(results).toEqual([1, 2]);
    });

    it("should handle nested context execution", async () => {
      const outerAdapter = new MockAdapter();
      const innerAdapter = new MockAdapter();

      const outerContext = createRequestContext(outerAdapter, {
        level: "outer",
      });
      const innerContext = createRequestContext(innerAdapter, {
        level: "inner",
      });

      const result = await withRequestContext(outerContext, async () => {
        const outerLevel = getRequestContext().request.level;

        const innerResult = await withRequestContext(innerContext, async () => {
          return getRequestContext().request.level;
        });

        const outerLevelAfter = getRequestContext().request.level;

        return { outerLevel, innerResult, outerLevelAfter };
      });

      expect(result.outerLevel).toBe("outer");
      expect(result.innerResult).toBe("inner");
      expect(result.outerLevelAfter).toBe("outer");
    });

    it("should clear context properly", () => {
      const context = createRequestContext(mockAdapter, { test: true });
      setRequestContext(context);

      expect(getRequestContext()).toBeDefined();

      clearRequestContext();

      // After clearing, getRequestContext should return an empty context
      // (clearRequestContext sets an empty object, doesn't actually clear)
      const clearedContext = getRequestContext();
      expect(clearedContext).toEqual({});
    });
  });

  describe("Type Definitions", () => {
    describe("ContractCondition", () => {
      it("should accept function returning boolean", () => {
        const condition: ContractCondition<string, AuthContext> = (
          input,
          context
        ) => {
          return input.length > 0 && !!context.user;
        };

        expect(typeof condition).toBe("function");
      });

      it("should accept function returning Promise<boolean>", () => {
        const condition: ContractCondition<string, AuthContext> = async (
          input,
          context
        ) => {
          return Promise.resolve(input.length > 0);
        };

        expect(typeof condition).toBe("function");
      });

      it("should accept function returning ContractError", () => {
        const condition: ContractCondition<string, AuthContext> = (
          input,
          context
        ) => {
          return new ContractError("Validation failed", {
            category: ErrorCategory.VALIDATION,
          });
        };

        expect(typeof condition).toBe("function");
      });
    });

    describe("ContractValidator", () => {
      it("should transform input and have isValidator property", () => {
        const validator: ContractValidator<string, number> = (input: string) =>
          parseInt(input, 10);
        validator.isValidator = true;

        expect(typeof validator).toBe("function");
        expect(validator.isValidator).toBe(true);
        expect(validator("42")).toBe(42);
      });

      it("should handle invalid input appropriately", () => {
        const validator: ContractValidator<string, number> = (
          input: string
        ) => {
          const result = parseInt(input, 10);
          if (isNaN(result)) {
            throw new ContractError("Invalid number", {
              category: ErrorCategory.VALIDATION,
            });
          }
          return result;
        };
        validator.isValidator = true;

        expect(validator("42")).toBe(42);
        expect(() => validator("invalid")).toThrow("Invalid number");
      });
    });

    describe("ContractOptions", () => {
      it("should accept all optional properties", () => {
        const stringValidator: ContractValidator<string, string> = (
          input: string
        ) => input.trim();
        stringValidator.isValidator = true;

        const options: ContractOptions<string, number, AuthContext> = {
          requires: [(input, context) => input.length > 0, stringValidator],
          ensures: [(output, input, context) => output > 0],
          invariants: [(input, output) => input.length >= 0],
          layer: "business",
          retryAttempts: 3,
          retryDelayMs: 500,
          retryOnCategories: [ErrorCategory.NETWORK, ErrorCategory.SYSTEM],
        };

        expect(options).toBeDefined();
        expect(options.layer).toBe("business");
        expect(options.retryAttempts).toBe(3);
        expect(options.requires).toHaveLength(2);
        expect(isValidator(options.requires![1])).toBe(true);
      });

      it("should work with minimal configuration", () => {
        const options: ContractOptions = {
          layer: "data",
        };

        expect(options).toBeDefined();
        expect(options.layer).toBe("data");
        expect(options.requires).toBeUndefined();
        expect(options.ensures).toBeUndefined();
        expect(options.invariants).toBeUndefined();
      });
    });
  });

  describe("Integration Tests", () => {
    it("should work with complete adapter workflow", async () => {
      const mockUser = { id: "user123", roles: ["admin"] };
      const mockSession = { id: "session456", expiresAt: new Date() };

      mockAdapter.setMockUser(mockUser);
      mockAdapter.setMockSession(mockSession);

      const requestContext = createRequestContext(mockAdapter, {
        url: "/api/test",
        method: "POST",
      });

      const result = await withRequestContext(requestContext, async () => {
        // Test auth context retrieval
        const authContext = await getAuthContext();

        // Test resource retrieval
        const resource = await getResource("resource123");
        const nonExistentResource = await getResource("nonexistent");

        return {
          authContext,
          resource,
          nonExistentResource,
        };
      });

      // より厳密な比較のために、オブジェクト全体を比較
      expect(result.authContext.user).toEqual(mockUser);
      expect(result.authContext.session).toEqual(mockSession);
      expect(result.resource).toEqual({ id: "resource123", userId: "user456" });
      expect(result.nonExistentResource).toBeNull();
    });

    it("should handle validator identification correctly", () => {
      const numberValidator: ContractValidator<string, number> = (
        input: string
      ) => {
        const num = parseInt(input, 10);
        if (isNaN(num)) {
          throw new ContractError("Invalid number", {
            category: ErrorCategory.VALIDATION,
          });
        }
        return num;
      };
      numberValidator.isValidator = true;

      const lengthCondition: ContractCondition<string, AuthContext> = (
        input,
        context
      ) => {
        return input.length >= 5;
      };

      expect(isValidator(numberValidator)).toBe(true);
      expect(isValidator(lengthCondition)).toBe(false);

      const options: ContractOptions<string, number, AuthContext> = {
        requires: [numberValidator, lengthCondition],
      };

      expect(options.requires).toHaveLength(2);
      expect(isValidator(options.requires![0])).toBe(true);
      expect(isValidator(options.requires![1])).toBe(false);
    });

    it("should work with multiple adapters concurrently", async () => {
      const adapter1 = new MockAdapter({ id: "user1" }, { id: "session1" });
      const adapter2 = new MockAdapter({ id: "user2" }, { id: "session2" });

      const context1 = createRequestContext(adapter1, { source: "api1" });
      const context2 = createRequestContext(adapter2, { source: "api2" });

      const [result1, result2] = await Promise.all([
        withRequestContext(context1, () => getAuthContext()),
        withRequestContext(context2, () => getAuthContext()),
      ]);

      expect(result1.user?.id).toBe("user1");
      expect(result1.session?.id).toBe("session1");
      expect(result2.user?.id).toBe("user2");
      expect(result2.session?.id).toBe("session2");
    });

    it("should handle complex auth context scenarios", async () => {
      // Test with partial user data
      mockAdapter.setMockUser({ id: "user123" }); // No roles
      mockAdapter.setMockSession(null); // No session

      const requestContext = createRequestContext(mockAdapter, {});

      const result = await withRequestContext(requestContext, async () => {
        return await getAuthContext();
      });

      expect(result.user?.id).toBe("user123");
      expect(result.session).toBeNull();
    });
  });

  describe("Error Handling and Edge Cases", () => {
    it("should handle sessionProvider returning null", async () => {
      await configureZerot({
        sessionProvider: async () => null,
        resourceProvider: async () => null,
      });

      const result = await getAuthContext();
      expect(result).toEqual({});
    });

    it("should handle sessionProvider returning undefined", async () => {
      await configureZerot({
        sessionProvider: async () => undefined,
        resourceProvider: async () => null,
      });

      const result = await getAuthContext();
      expect(result).toEqual({});
    });

    it("should handle adapter extraction methods throwing errors", async () => {
      const errorAdapter = new (class extends MockAdapter {
        async extractUser(): Promise<any> {
          throw new Error("User extraction failed");
        }

        async extractSession(): Promise<any> {
          throw new Error("Session extraction failed");
        }
      })();

      const requestContext = createRequestContext(errorAdapter, {});

      const result = await withRequestContext(requestContext, async () => {
        return await getAuthContext();
      });

      // Should return empty context when extraction fails
      expect(result).toEqual({});
    });

    it("should handle missing request context gracefully", async () => {
      // Clear any existing context
      clearRequestContext();

      // Try to get auth context without setting request context
      const result = await getAuthContext();
      expect(result).toEqual({});
    });
  });
});
