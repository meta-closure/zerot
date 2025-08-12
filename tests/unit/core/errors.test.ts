import { ContractError, ContractViolationError } from "zerot/core/errors";

describe("errors.ts", () => {
  describe("ContractError", () => {
    it("should create an instance with correct properties", () => {
      const error = new ContractError("TEST_TYPE", "This is a test error.");
      expect(error).toBeInstanceOf(ContractError);
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe("ContractError");
      expect(error.type).toBe("TEST_TYPE");
      expect(error.message).toBe("This is a test error.");
    });

    it("should have a stack trace", () => {
      const error = new ContractError("TEST_TYPE", "Test message");
      expect(error.stack).toBeDefined();
    });
  });

  describe("ContractViolationError", () => {
    it("should create an instance with correct properties", () => {
      const originalError = new ContractError("PRECONDITION_FAILED", "Input invalid");
      const violationError = new ContractViolationError(
        "MyService.myMethod",
        "business",
        originalError
      );

      expect(violationError).toBeInstanceOf(ContractViolationError);
      expect(violationError).toBeInstanceOf(Error);
      expect(violationError.name).toBe("ContractViolationError");
      expect(violationError.contractName).toBe("MyService.myMethod");
      expect(violationError.layer).toBe("business");
      expect(violationError.originalError).toBe(originalError);
      expect(violationError.message).toBe(
        "Contract violation in business.MyService.myMethod: Input invalid"
      );
    });

    it("should handle unexpected original errors", () => {
      const unexpectedError = new Error("Something went wrong");
      const violationError = new ContractViolationError(
        "AnotherService.anotherMethod",
        "action",
        unexpectedError
      );

      expect(violationError.originalError).toBeInstanceOf(Error);
      expect(violationError.originalError.message).toBe("Something went wrong");
    });

    describe("getAppropriateResponse", () => {
      it("should return redirect for presentation layer", () => {
        const originalError = new ContractError("AUTH_FAILED", "Not logged in");
        const violationError = new ContractViolationError(
          "AuthService.login",
          "presentation",
          originalError
        );
        const response = violationError.getAppropriateResponse();
        expect(response).toEqual({ redirect: "/login", error: "Authentication required" });
      });

      it("should return success:false and error message for action layer", () => {
        const originalError = new ContractError("INVALID_INPUT", "Bad data");
        const violationError = new ContractViolationError(
          "UserService.createUser",
          "action",
          originalError
        );
        const response = violationError.getAppropriateResponse();
        expect(response).toEqual({ success: false, error: "Bad data" });
      });

      it("should return permission denied for business layer", () => {
        const originalError = new ContractError("PERMISSION_DENIED", "User not authorized");
        const violationError = new ContractViolationError(
          "OrderService.placeOrder",
          "business",
          originalError
        );
        const response = violationError.getAppropriateResponse();
        expect(response).toEqual({ success: false, error: "Permission denied" });
      });

      it("should return operation failed for data layer", () => {
        const originalError = new ContractError("DB_ERROR", "Database connection lost");
        const violationError = new ContractViolationError(
          "UserRepository.findById",
          "data",
          originalError
        );
        const response = violationError.getAppropriateResponse();
        expect(response).toEqual({ success: false, error: "Operation failed" });
      });

      it("should return generic error for unknown layer", () => {
        const originalError = new ContractError("UNKNOWN", "Something unexpected");
        const violationError = new ContractViolationError(
          "SomeService.someMethod",
          "unknown",
          originalError
        );
        const response = violationError.getAppropriateResponse();
        expect(response).toEqual({ success: false, error: "An error occurred" });
      });

      it("should return generic error for undefined layer", () => {
        const originalError = new ContractError("UNKNOWN", "Something unexpected");
        const violationError = new ContractViolationError(
          "SomeService.someMethod",
          undefined as any, // Simulate undefined layer
          originalError
        );
        const response = violationError.getAppropriateResponse();
        expect(response).toEqual({ success: false, error: "An error occurred" });
      });
    });
  });
});
