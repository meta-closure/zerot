/**
 * Defines categories for different types of errors within the contract system.
 * This helps in classifying errors for better handling, logging, and retry mechanisms.
 */
export enum ErrorCategory {
  NETWORK = "NETWORK",
  VALIDATION = "VALIDATION",
  AUTHENTICATION = "AUTHENTICATION",
  AUTHORIZATION = "AUTHORIZATION",
  BUSINESS_LOGIC = "BUSINESS_LOGIC",
  SYSTEM = "SYSTEM",
  UNKNOWN = "UNKNOWN",
}

/**
 * Base class for all contract-related errors.
 * Provides a structured way to define errors with a code, category, and additional details.
 */
export class ContractError extends Error {
  public code?: string;
  public category: ErrorCategory;
  public details?: Record<string, any>;
  public isRecoverable?: boolean;

  constructor(
    /** The error message. */
    message: string,
    /** Additional options for the error. */
    options?: {
      /** A specific error code. */
      code?: string;
      /** The category of the error. */
      category?: ErrorCategory;
      /** Additional details about the error. */
      details?: Record<string, any>;
      /** Indicates if the error is recoverable. */
      isRecoverable?: boolean;
    }
  ) {
    super(message);
    this.name = "ContractError";
    this.code = options?.code;
    this.category = options?.category || ErrorCategory.UNKNOWN;
    this.details = options?.details;
    this.isRecoverable = options?.isRecoverable;
  }
}

/**
 * Represents an error specifically indicating a violation of a contract condition.
 * This error wraps an original error and provides context about the contract and layer where the violation occurred.
 */
export class ContractViolationError extends ContractError {
  constructor(
    /** The name of the contract that was violated. */
    public contractName: string,
    /** The layer in which the contract violation occurred (e.g., "presentation", "business"). */
    public layer: string,
    /** The original error that caused the contract violation. */
    public originalError: ContractError | Error // Ensure originalError is typed
  ) {
    // If originalError is a ContractError, use its properties; otherwise, default
    const code =
      originalError instanceof ContractError
        ? originalError.code
        : "CONTRACT_VIOLATION";
    const category =
      originalError instanceof ContractError
        ? originalError.category
        : ErrorCategory.BUSINESS_LOGIC;
    const details =
      originalError instanceof ContractError ? originalError.details : {};
    const isRecoverable =
      originalError instanceof ContractError
        ? originalError.isRecoverable
        : false;

    super(
      `Contract violation in ${layer}.${contractName}: ${originalError.message}`,
      {
        code,
        category,
        details: {
          ...details,
          originalErrorMessage: originalError.message,
          originalErrorStack: originalError.stack,
        },
        isRecoverable,
      }
    );
    this.name = "ContractViolationError";
  }

  /**
   * Provides an appropriate response object based on the contract's layer.
   * This can be used by integration layers (e.g., Next.js Server Actions or Middleware)
   * to return a user-friendly or system-appropriate response.
   * @returns An object containing response details, such as redirect paths or error messages.
   */
  getAppropriateResponse(): {
    redirect?: string;
    error?: string;
    success?: boolean;
  } {
    switch (this.layer) {
      case "presentation":
        return { redirect: "/login", error: "Authentication required" };
      case "action":
        return { success: false, error: this.originalError.message };
      case "business":
        return { success: false, error: "Permission denied" };
      case "data":
        return { success: false, error: "Operation failed" };
      default:
        return { success: false, error: "An error occurred" };
    }
  }
}
