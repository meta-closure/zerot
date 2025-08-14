import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  isValidator,
  getAuthContext,
  getResource,
  setSessionProvider,
  setResourceProvider,
  ContractCondition,
  ContractValidator,
  ContractEnsuresCondition,
  ContractInvariant,
  ContractOptions,
  AuthContext,
  SessionProvider,
  ResourceProvider,
} from "~/core/types"; // Updated import path based on contract.ts
import { ContractError, ErrorCategory } from "~/core/errors"; // Adjust import path as needed

describe("Contract Types and Functions", () => {
  // Reset providers before each test
  beforeEach(() => {
    setSessionProvider(undefined);
    setResourceProvider(undefined as any);
  });

  describe("isValidator", () => {
    it("should return true for a valid validator function", () => {
      const validator: ContractValidator<string, number> = (input: string) =>
        parseInt(input);
      validator.isValidator = true;

      const result = isValidator(validator);
      expect(result).toBe(true);
    });

    it("should return false for a validator without isValidator property", () => {
      const validator = (input: string) => parseInt(input);

      const result = isValidator(validator);
      expect(result).toBe(false);
    });

    it("should return false for a validator with isValidator set to false", () => {
      const validator: any = (input: string) => parseInt(input);
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

  describe("Session Provider", () => {
    it("should set and use a session provider", async () => {
      const mockAuthContext: AuthContext = {
        user: { id: "user123", roles: ["admin"] },
        session: { id: "session456", expiresAt: new Date() },
      };

      const mockProvider: SessionProvider = vi
        .fn()
        .mockResolvedValue(mockAuthContext);
      setSessionProvider(mockProvider);

      const result = await getAuthContext();

      expect(mockProvider).toHaveBeenCalled();
      expect(result).toEqual(mockAuthContext);
    });

    it("should handle synchronous session provider", async () => {
      const mockAuthContext: AuthContext = {
        user: { id: "user123" },
      };

      const mockProvider: SessionProvider = vi
        .fn()
        .mockReturnValue(mockAuthContext);
      setSessionProvider(mockProvider);

      const result = await getAuthContext();

      expect(result).toEqual(mockAuthContext);
    });

    it("should return empty context when no session provider is set", async () => {
      const result = await getAuthContext();
      expect(result).toEqual({});
    });

    it("should handle session provider returning null", async () => {
      const mockProvider: SessionProvider = vi.fn().mockReturnValue(null);
      setSessionProvider(mockProvider);

      const result = await getAuthContext();
      expect(result).toEqual({});
    });

    it("should handle session provider returning undefined", async () => {
      const mockProvider: SessionProvider = vi.fn().mockReturnValue(undefined);
      setSessionProvider(mockProvider);

      const result = await getAuthContext();
      expect(result).toEqual({});
    });

    it("should handle session provider throwing an error", async () => {
      const mockProvider: SessionProvider = vi
        .fn()
        .mockRejectedValue(new Error("Provider error"));
      setSessionProvider(mockProvider);

      const result = await getAuthContext();
      expect(result).toEqual({});
    });

    it("should handle session provider throwing synchronous error", async () => {
      const mockProvider: SessionProvider = vi.fn().mockImplementation(() => {
        throw new Error("Sync error");
      });
      setSessionProvider(mockProvider);

      const result = await getAuthContext();
      expect(result).toEqual({});
    });
  });

  describe("Resource Provider", () => {
    it("should set and use a resource provider", async () => {
      const mockResource = { id: "resource123", userId: "user456" };
      const mockProvider: ResourceProvider = vi
        .fn()
        .mockResolvedValue(mockResource);

      setResourceProvider(mockProvider);
      const result = await getResource("resource123");

      expect(mockProvider).toHaveBeenCalledWith("resource123");
      expect(result).toEqual(mockResource);
    });

    it("should handle resource provider returning null", async () => {
      const mockProvider: ResourceProvider = vi.fn().mockResolvedValue(null);
      setResourceProvider(mockProvider);

      const result = await getResource("nonexistent");
      expect(result).toBeNull();
    });

    it("should throw error when no resource provider is set", async () => {
      await expect(getResource("resource123")).rejects.toThrow(
        "Resource provider not set. Call setResourceProvider to configure how resources are retrieved."
      );
    });

    it("should handle resource provider throwing an error", async () => {
      const mockProvider: ResourceProvider = vi
        .fn()
        .mockRejectedValue(new Error("Database error"));
      setResourceProvider(mockProvider);

      await expect(getResource("resource123")).rejects.toThrow(
        "Database error"
      );
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

      it("should accept function returning Promise<ContractError>", () => {
        const condition: ContractCondition<string, AuthContext> = async (
          input,
          context
        ) => {
          return Promise.resolve(
            new ContractError("Async validation failed", {
              category: ErrorCategory.VALIDATION,
            })
          );
        };

        expect(typeof condition).toBe("function");
      });
    });

    describe("ContractValidator", () => {
      it("should transform input and have isValidator property", () => {
        const validator: ContractValidator<string, number> = (input: string) =>
          parseInt(input);
        validator.isValidator = true;

        expect(typeof validator).toBe("function");
        expect(validator.isValidator).toBe(true);
        expect(validator("42")).toBe(42);
      });

      it("should work without explicit isValidator property", () => {
        const validator: ContractValidator<string, string> = (input: string) =>
          input.trim();

        expect(typeof validator).toBe("function");
        expect(validator(" hello ")).toBe("hello");
      });
    });

    describe("ContractEnsuresCondition", () => {
      it("should accept function with output, input, and context parameters", () => {
        const ensuresCondition: ContractEnsuresCondition<
          number,
          string,
          AuthContext
        > = (output, input, context) => {
          return output > 0 && input.length > 0 && !!context.user;
        };

        expect(typeof ensuresCondition).toBe("function");
      });

      it("should accept async function returning Promise<boolean>", () => {
        const ensuresCondition: ContractEnsuresCondition<
          number,
          string,
          AuthContext
        > = async (output, input, context) => {
          return Promise.resolve(output === parseInt(input));
        };

        expect(typeof ensuresCondition).toBe("function");
      });
    });

    describe("ContractInvariant", () => {
      it("should accept function with input and output parameters", () => {
        const invariant: ContractInvariant<string, number> = (
          input,
          output
        ) => {
          return input.length >= 0 && output >= 0;
        };

        expect(typeof invariant).toBe("function");
      });

      it("should accept async function", () => {
        const invariant: ContractInvariant<string, number> = async (
          input,
          output
        ) => {
          return Promise.resolve(output === input.length);
        };

        expect(typeof invariant).toBe("function");
      });
    });

    describe("ContractOptions", () => {
      it("should accept all optional properties", () => {
        const options: ContractOptions<string, number, AuthContext> = {
          requires: [
            (input, context) => input.length > 0,
            ((input: string) => input.trim()) as ContractValidator<
              string,
              string
            >,
          ],
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
        expect(options.retryDelayMs).toBe(500);
        expect(options.retryOnCategories).toContain(ErrorCategory.NETWORK);
      });

      it("should work with empty options", () => {
        const options: ContractOptions = {};
        expect(options).toEqual({});
      });
    });

    describe("AuthContext", () => {
      it("should support user and session properties", () => {
        const context: AuthContext = {
          user: {
            id: "user123",
            roles: ["admin", "user"],
            email: "test@example.com",
            customProperty: "value",
          },
          session: {
            id: "session456",
            expiresAt: new Date(),
            customSessionData: "sessionValue",
          },
          customContextProperty: "contextValue",
        };

        expect(context.user?.id).toBe("user123");
        expect(context.user?.roles).toContain("admin");
        expect(context.session?.id).toBe("session456");
        expect(context.customContextProperty).toBe("contextValue");
      });

      it("should support minimal context", () => {
        const context: AuthContext = {};
        expect(context.user).toBeUndefined();
        expect(context.session).toBeUndefined();
      });

      it("should support context with only user", () => {
        const context: AuthContext = {
          user: { id: "user123" },
        };

        expect(context.user?.id).toBe("user123");
        expect(context.session).toBeUndefined();
      });
    });
  });

  describe("Integration Tests", () => {
    it("should work with complex workflow", async () => {
      // Set up providers
      const mockUser = { id: "user123", roles: ["admin"] };
      const mockSession = { id: "session456", expiresAt: new Date() };
      const mockResource = { id: "resource789", userId: "user123" };

      setSessionProvider(() =>
        Promise.resolve({
          user: mockUser,
          session: mockSession,
        })
      );

      setResourceProvider(async (id: string) => {
        return id === "resource789" ? mockResource : null;
      });

      // Test auth context retrieval
      const authContext = await getAuthContext();
      expect(authContext.user).toEqual(mockUser);
      expect(authContext.session).toEqual(mockSession);

      // Test resource retrieval
      const resource = await getResource("resource789");
      expect(resource).toEqual(mockResource);

      const nonExistentResource = await getResource("nonexistent");
      expect(nonExistentResource).toBeNull();
    });

    it("should handle validator identification correctly", () => {
      // Create a validator
      const numberValidator: ContractValidator<string, number> = (
        input: string
      ) => {
        const num = parseInt(input);
        if (isNaN(num)) {
          throw new ContractError("Invalid number", {
            category: ErrorCategory.VALIDATION,
          });
        }
        return num;
      };
      numberValidator.isValidator = true;

      // Create a regular condition
      const lengthCondition: ContractCondition<string, AuthContext> = (
        input,
        context
      ) => {
        return input.length >= 5;
      };

      // Test identification
      expect(isValidator(numberValidator)).toBe(true);
      expect(isValidator(lengthCondition)).toBe(false);

      // Test usage in contract options
      const options: ContractOptions<string, number, AuthContext> = {
        requires: [numberValidator, lengthCondition],
      };

      expect(options.requires).toHaveLength(2);
      expect(isValidator(options.requires![0])).toBe(true);
      expect(isValidator(options.requires![1])).toBe(false);
    });
  });
});
