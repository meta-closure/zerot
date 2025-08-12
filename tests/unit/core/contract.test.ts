import { contract } from "zerot/core/contract";
import { ContractError, ContractViolationError } from "zerot/core/errors";
import { setSessionProvider, type AuthContext } from "zerot/core/types";

describe("contract.ts - @contract decorator unit tests", () => {
  let mockContext: AuthContext;

  beforeEach(() => {
    mockContext = {
      user: { id: "user-123", roles: ["user"] },
      session: { id: "session-123", expiresAt: new Date(Date.now() + 3600000) },
    };
    setSessionProvider(() => mockContext);
  });

  afterEach(() => {
    setSessionProvider(undefined as any); // Clean up global session provider
  });

  it("should execute the original method if no conditions are specified", async () => {
    class TestService {
      @contract({})
      async doSomething(input: string, context?: AuthContext): Promise<string> {
        return `processed: ${input}`;
      }
    }
    const service = new TestService();
    await expect(service.doSomething("test")).resolves.toBe("processed: test");
  });

  it("should execute the original method if all requires conditions pass", async () => {
    class TestService {
      @contract({
        requires: [
          (input: string) => input === "valid",
          (input: string, context: AuthContext) => context.user?.id === "user-123",
        ],
      })
      async doSomething(input: string, context?: AuthContext): Promise<string> {
        return `processed: ${input}`;
      }
    }
    const service = new TestService();
    await expect(service.doSomething("valid", mockContext)).resolves.toBe("processed: valid");
  });

  it("should throw ContractViolationError if a requires condition fails", async () => {
    class TestService {
      @contract({
        requires: [(input: string) => input === "valid"],
        layer: "test",
      })
      async doSomething(input: string, context?: AuthContext): Promise<string> {
        return `processed: ${input}`;
      }
    }
    const service = new TestService();
    await expect(service.doSomething("invalid", mockContext)).rejects.toThrow(ContractViolationError);
    await expect(service.doSomething("invalid", mockContext)).rejects.toHaveProperty('layer', 'test');
    await expect(service.doSomething("invalid", mockContext)).rejects.toHaveProperty('originalError.type', 'PRECONDITION_FAILED');
  });

  it("should apply input transformation from a validator in requires", async () => {
    const stringToNumberValidator = ((input: unknown) => {
      if (typeof input === 'string') return parseInt(input, 10);
      throw new ContractError("VALIDATION_FAILED", "Input must be a string number");
    }) as any;
    stringToNumberValidator.isValidator = true; // Mark as validator

    class TestService {
      @contract({
        requires: [stringToNumberValidator, (input: number) => input > 10],
      })
      async processNumber(input: number): Promise<number> {
        return input * 2;
      }
    }
    const service = new TestService();
    await expect(service.processNumber("15" as any)).resolves.toBe(30);
    await expect(service.processNumber("5" as any)).rejects.toThrow(ContractViolationError);
  });

  it("should execute the original method if all ensures conditions pass", async () => {
    class TestService {
      @contract({
        ensures: [(output: string) => output.startsWith("success:")],
      })
      async doSomething(input: string, context?: AuthContext): Promise<string> {
        return `success:${input}`;
      }
    }
    const service = new TestService();
    await expect(service.doSomething("test", mockContext)).resolves.toBe("success:test");
  });

  it("should throw ContractViolationError if an ensures condition fails", async () => {
    class TestService {
      @contract({
        ensures: [(output: string) => output === "expected"],
        layer: "test",
      })
      async doSomething(input: string, context?: AuthContext): Promise<string> {
        return `processed:${input}`;
      }
    }
    const service = new TestService();
    await expect(service.doSomething("any", mockContext)).rejects.toThrow(ContractViolationError);
    await expect(service.doSomething("any", mockContext)).rejects.toHaveProperty('layer', 'test');
    await expect(service.doSomething("any", mockContext)).rejects.toHaveProperty('originalError.type', 'POSTCONDITION_FAILED');
  });

  it("should execute the original method if all invariants conditions pass", async () => {
    class TestService {
      @contract({
        invariants: [(input: string, output: string) => input.length < output.length],
      })
      async doSomething(input: string, context?: AuthContext): Promise<string> {
        return `long_${input}`;
      }
    }
    const service = new TestService();
    await expect(service.doSomething("short", mockContext)).resolves.toBe("long_short");
  });

  it("should throw ContractViolationError if an invariant condition fails", async () => {
    class TestService {
      @contract({
        invariants: [(input: string, output: string) => input === output],
        layer: "test",
      })
      async doSomething(input: string, context?: AuthContext): Promise<string> {
        return `processed:${input}`;
      }
    }
    const service = new TestService();
    await expect(service.doSomething("input", mockContext)).rejects.toThrow(ContractViolationError);
    await expect(service.doSomething("input", mockContext)).rejects.toHaveProperty('layer', 'test');
    await expect(service.doSomething("input", mockContext)).rejects.toHaveProperty('originalError.type', 'INVARIANT_VIOLATION');
  });

  it("should use global context if not provided in arguments", async () => {
    class TestService {
      @contract({
        requires: [(input: string, context: AuthContext) => context.user?.id === "user-123"],
      })
      async doSomething(input: string): Promise<string> {
        return `processed:${input}`;
      }
    }
    const service = new TestService();
    await expect(service.doSomething("valid")).resolves.toBe("processed:valid");
  });

  it("should prioritize context from arguments over global context", async () => {
    const globalContext: AuthContext = { user: { id: "global-user", roles: [] } };
    setSessionProvider(() => globalContext);

    const argContext: AuthContext = { user: { id: "arg-user", roles: [] } };

    class TestService {
      @contract({
        requires: [(input: string, context: AuthContext) => context.user?.id === "arg-user"],
      })
      async doSomething(input: string, context?: AuthContext): Promise<string> {
        return `processed:${input}`;
      }
    }
    const service = new TestService();
    await expect(service.doSomething("valid", argContext)).resolves.toBe("processed:valid");
  });

  it("should throw ContractViolationError for unexpected errors in original method", async () => {
    class TestService {
      @contract({ layer: "test" })
      async doSomething(input?: any, context?: AuthContext): Promise<string> {
        throw new Error("Unexpected internal error");
      }
    }
    const service = new TestService();
    await expect(service.doSomething()).rejects.toThrow(ContractViolationError);
    await expect(service.doSomething()).rejects.toHaveProperty('layer', 'test');
    await expect(service.doSomething()).rejects.toHaveProperty('originalError.type', 'UNEXPECTED_ERROR');
    await expect(service.doSomething()).rejects.toHaveProperty('originalError.message', 'Unexpected internal error');
  });

  it("should throw error if applied to non-method property", () => {
    expect(() => {
      class TestService {
        @(contract({}) as any) // Cast to any to bypass type check for property decorator
        myProperty: string = "value";
      }
      new TestService(); // Instantiating to trigger decorator
    }).toThrow("TestService.myProperty is not a method.");
  });

  it("should correctly pass input and context to ensures conditions", async () => {
    class TestService {
      @contract({
        ensures: [
          (output: string, input: string, context: AuthContext) => {
            return output === `processed:${input}` && context.user?.id === "user-123";
          },
        ],
      })
      async process(input: string, context: AuthContext): Promise<string> {
        return `processed:${input}`;
      }
    }
    const service = new TestService();
    await expect(service.process("data", mockContext)).resolves.toBe("processed:data");
  });
});
