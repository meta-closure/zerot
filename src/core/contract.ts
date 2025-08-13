import {
  ContractOptions,
  getAuthContext,
  ContractCondition,
  ContractValidator,
  ContractEnsuresCondition,
  ContractInvariant,
  AuthContext,
} from "./types";
import { ContractError, ContractViolationError, ErrorCategory } from "./errors";
import { delay } from "zerot/utils/delay";
import { logger } from "zerot/utils/logger";
import { isValidator } from "zerot/utils/type-guards";

/**
 * The main contract decorator.
 * Applies a set of pre-conditions, post-conditions, and invariants to a method.
 *
 * @template TInput - The expected type of the input to the decorated method.
 * @template TOutput - The expected type of the output of the decorated method.
 * @template TContext - The expected type of the authentication context.
 * @param options - The contract options including `requires`, `ensures`, and `invariants`.
 * @returns A method decorator function.
 *
 * @example
 * ```typescript
 * class UserService {
 *   @contract<UserCreateInput, User, AuthContext>({
 *     requires: [auth("admin"), validates(UserSchema)],
 *     ensures: [returns(UserSchema)],
 *     invariants: [(input, output) => output.id === input.id],
 *     layer: "business"
 *   })
 *   async createUser(input: UserCreateInput, context?: AuthContext): Promise<User> {
 *     // Business logic to create a user
 *     return { id: "123", name: input.name, email: input.email, roles: ["user"] };
 *   }
 * }
 * ```
 */
export function contract<
  Method extends (...args: any[]) => Promise<any>, // Ensure method returns a Promise
  TInput = Parameters<Method>[0],
  TContext extends AuthContext = Parameters<Method> extends [any, infer C] ? (C extends AuthContext ? C : AuthContext) : AuthContext,
  TOutput = Method extends (...args: any[]) => Promise<infer R> ? R : ReturnType<Method> // Unwrap Promise
>(
  options: ContractOptions<TInput, TOutput, TContext>
) {
  /**
   * Decorator function that applies the contract logic to the target method.
   * @param target - The prototype of the class.
   * @param propertyName - The name of the method being decorated.
   * @param descriptor - The property descriptor for the method.
   * @returns The modified property descriptor.
   */
  return function (
    target: any,
    propertyName: string,
    descriptor: PropertyDescriptor
  ) {
    if (!descriptor || typeof descriptor.value !== "function") {
      throw new Error(
        `@contract decorator can only be applied to methods. ${target.constructor.name}.${propertyName} is not a method.`
      );
    }

    const originalMethod = descriptor.value;

    /**
     * The new method implementation that includes pre-conditions, post-conditions, and invariants.
     * It also handles retries based on the contract options.
     * @param input - The input arguments for the original method.
     * @param contextFromArgs - Optional authentication context passed as an argument.
     * @returns A Promise that resolves with the result of the original method execution.
     * @throws {ContractViolationError} If any contract condition or invariant is violated.
     * @throws {ContractError} If the method fails after all retry attempts.
     */
    descriptor.value = async function (
      input: TInput,
      contextFromArgs?: TContext
    ): Promise<TOutput> {
      const contractName = `${target.constructor.name}.${propertyName}`;

      // If context is not passed as an argument, retrieve it from the global session provider.
      const context: TContext =
        (contextFromArgs || (await getAuthContext())) as TContext; // Cast to TContext

      const maxAttempts = options.retryAttempts !== undefined ? options.retryAttempts + 1 : 1; // +1 for the initial attempt
      const retryDelay = options.retryDelayMs || 100;
      const retryOnCategories = options.retryOnCategories;

      let attempts = 0;
      while (attempts < maxAttempts) {
        try {
          /**
           * Pre-condition checks (requires)
           * These conditions must pass before the original method is executed.
           * Validators can transform the input, while other conditions return a boolean or ContractError.
           */
          let validatedInput: TInput = input;
          for (const condition of options.requires || []) {
            try {
              if (isValidator<TInput, TContext>(condition)) {
                // If the condition is a validator, it can transform the input.
                validatedInput = await condition(validatedInput);
              } else {
                // For other conditions, evaluate the result.
                // The cast to ContractCondition is safe here because isValidator has already checked for validators.
                const conditionResult = await (condition as ContractCondition<TInput, TContext>)(validatedInput, context);
                if (conditionResult instanceof ContractError) {
                  // If a ContractError is returned, it indicates a specific failure.
                  throw new ContractViolationError(contractName, options.layer || "unknown", conditionResult);
                } else if (conditionResult === false) {
                  // If false is returned, it indicates a generic precondition failure.
                  throw new ContractViolationError(
                    contractName,
                    options.layer || "unknown",
                    new ContractError(`Precondition failed for ${contractName}`, {
                      code: "PRECONDITION_FAILED",
                      category: ErrorCategory.VALIDATION,
                      details: { contractName },
                    })
                  );
                }
              }
            } catch (error) {
              // Handle errors from individual conditions (especially validators)
              if (error instanceof ContractViolationError) {
                // Re-throw ContractViolationError as-is
                throw error;
              } else if (error instanceof ContractError) {
                // Wrap ContractError in ContractViolationError
                throw new ContractViolationError(contractName, options.layer || "unknown", error);
              } else {
                // Wrap other errors in ContractError then ContractViolationError
                const contractError = new ContractError(
                  (error as Error).message,
                  {
                    code: "UNEXPECTED_ERROR",
                    category: ErrorCategory.SYSTEM,
                    details: { originalErrorMessage: (error as Error).message, originalErrorStack: (error as Error).stack },
                    isRecoverable: false,
                  }
                );
                throw new ContractViolationError(contractName, options.layer || "unknown", contractError);
              }
            }
          }

          // Execute the original method
          const result: TOutput = await originalMethod.call(this, validatedInput, context);

          /**
           * Post-condition checks (ensures)
           * These conditions must pass after the original method has successfully executed.
           */
          for (const condition of options.ensures || []) {
            const checkResult = await (condition as ContractEnsuresCondition<TOutput, TInput, TContext>)(result, validatedInput, context);
            if (checkResult instanceof ContractError) {
              // If a ContractError is returned, it indicates a specific failure.
              throw new ContractViolationError(contractName, options.layer || "unknown", checkResult);
            } else if (checkResult === false) {
              // If false is returned, it indicates a generic postcondition failure.
              throw new ContractViolationError(
                contractName,
                options.layer || "unknown",
                new ContractError(`Postcondition failed for ${contractName}`, {
                  code: "POSTCONDITION_FAILED",
                  category: ErrorCategory.VALIDATION,
                  details: { contractName },
                })
              );
            }
          }

          /**
           * Invariant checks (invariants)
           * These conditions must hold true both before and after method execution.
           */
          for (const invariant of options.invariants || []) {
            const invariantResult = await (invariant as ContractInvariant<TInput, TOutput>)(validatedInput, result);
            if (invariantResult instanceof ContractError) {
              // If a ContractError is returned, it indicates a specific failure.
              throw new ContractViolationError(contractName, options.layer || "unknown", invariantResult);
            } else if (invariantResult === false) {
              // If false is returned, it indicates a generic invariant failure.
              throw new ContractViolationError(
                contractName,
                options.layer || "unknown",
                new ContractError(`Invariant condition failed in ${contractName}`, {
                  code: "INVARIANT_VIOLATION",
                  category: ErrorCategory.BUSINESS_LOGIC,
                  details: { contractName },
                })
              );
            }
          }

          return result; // If successful, break the retry loop
        } catch (error) {
          attempts++;
          
          // Handle ContractViolationError differently - don't wrap it again
          if (error instanceof ContractViolationError) {
            // For ContractViolationError, check if retry is warranted based on the original error
            const originalError = error.originalError;
            const isRecoverable = originalError instanceof ContractError ? originalError.isRecoverable : false;
            const category = originalError instanceof ContractError ? originalError.category : ErrorCategory.UNKNOWN;
            const code = originalError instanceof ContractError ? originalError.code : "UNKNOWN_ERROR";
            
            const shouldRetry = (
              isRecoverable ||
              (retryOnCategories && retryOnCategories.includes(category))
            ) && attempts < maxAttempts;

            if (shouldRetry) {
              logger.warn(
                `Retrying ${contractName} due to recoverable error (attempt ${attempts}/${maxAttempts - 1}): ${originalError.message}`,
                {
                  contractName,
                  attempt: attempts,
                  maxAttempts: maxAttempts - 1,
                  errorMessage: originalError.message,
                  errorCode: code,
                  errorCategory: category,
                }
              );
              await delay(retryDelay);
            } else {
              // Re-throw the ContractViolationError as-is
              throw error;
            }
          } else {
            // Determine if the caught error is a ContractError or a generic error
            const contractError = error instanceof ContractError
              ? error
              : new ContractError(
                  (error as Error).message,
                  {
                    code: "UNEXPECTED_ERROR",
                    category: ErrorCategory.SYSTEM,
                    details: { originalErrorMessage: (error as Error).message, originalErrorStack: (error as Error).stack },
                    isRecoverable: false,
                  }
                );

            // Check if a retry is warranted based on recoverability or specified categories
            const shouldRetry = (
              contractError.isRecoverable ||
              (retryOnCategories && retryOnCategories.includes(contractError.category))
            ) && attempts < maxAttempts;

            if (shouldRetry) {
              logger.warn(
                `Retrying ${contractName} due to recoverable error (attempt ${attempts}/${maxAttempts - 1}): ${contractError.message}`,
                {
                  contractName,
                  attempt: attempts,
                  maxAttempts: maxAttempts - 1,
                  errorMessage: contractError.message,
                  errorCode: contractError.code,
                  errorCategory: contractError.category,
                }
              );
              await delay(retryDelay);
            } else {
              // If not recoverable or no attempts left, re-throw as ContractViolationError
              throw new ContractViolationError(
                contractName,
                options.layer || "unknown",
                contractError
              );
            }
          }
        }
      }
      // This part should ideally not be reached if maxAttempts is handled correctly,
      // but as a fallback, throw an error if all attempts fail.
      throw new ContractError(`Failed to execute ${contractName} after ${maxAttempts} attempts.`, {
        code: "MAX_RETRY_ATTEMPTS_EXCEEDED",
        category: ErrorCategory.SYSTEM,
        details: { contractName, maxAttempts },
        isRecoverable: false,
      });
    };

    return descriptor;
  };
}
