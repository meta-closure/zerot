import {
  ContractOptions,
  getAuthContext,
  ContractCondition,
  ContractValidator,
  ContractEnsuresCondition, // Add this import
  ContractInvariant,
  AuthContext,
} from "./types";
import { ContractError, ContractViolationError } from "./errors";

/**
 * The main contract decorator.
 * Applies a set of pre-conditions, post-conditions, and invariants to a method.
 *
 * @param options - The contract options including `requires`, `ensures`, and `invariants`.
 * @returns A method decorator function.
 *
 * @example
 * ```typescript
 * class UserService {
 *   @contract({
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
export function contract(options: ContractOptions) {
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

    descriptor.value = async function (
      input: any,
      contextFromArgs?: AuthContext
    ) {
      const contractName = `${target.constructor.name}.${propertyName}`;

      // If context is not passed as an argument, retrieve it from the global session provider.
      const context: AuthContext =
        contextFromArgs || (await getAuthContext());

      try {
        // Pre-condition checks (requires)
        let validatedInput = input;
        for (const condition of options.requires || []) {
          // Determine if it's a ContractCondition or ContractValidator
          // ContractValidator takes one argument (input) and returns transformed input
          // ContractCondition takes two arguments (input, context) and returns boolean
          // Check if the condition is a ContractValidator (has a 'isValidator' property)
          // This is a more robust way to distinguish than checking function arity.
          const isValidator = (c: ContractCondition | ContractValidator): c is ContractValidator => {
            return typeof c === 'function' && (c as any).isValidator === true;
          };

          if (isValidator(condition)) {
            // If it's a validator, apply the transformation
            validatedInput = await Promise.resolve(condition(validatedInput));
          } else {
            // If it's a regular condition, check if it passes
            const conditionResult = await Promise.resolve(
              (condition as ContractCondition)(validatedInput, context)
            );
            if (conditionResult === false) {
              throw new ContractError(
                "PRECONDITION_FAILED",
                `Precondition failed for ${contractName}`
              );
            }
          }
        }

        // Execute the original method
        const result = await originalMethod.call(this, validatedInput, context);

        // Post-condition checks (ensures)
        for (const condition of options.ensures || []) {
          const checkResult = await Promise.resolve(
            (condition as ContractEnsuresCondition)(result, validatedInput, context)
          );
          if (checkResult === false) {
            throw new ContractError(
              "POSTCONDITION_FAILED",
              `Postcondition failed for ${contractName}`
            );
          }
        }

        // Invariant checks (invariants)
        for (const invariant of options.invariants || []) {
          const invariantResult = await Promise.resolve(
            invariant(validatedInput, result)
          );
          if (invariantResult === false) {
            throw new ContractError(
              "INVARIANT_VIOLATION",
              `Invariant condition failed in ${contractName}`
            );
          }
        }

        return result;
      } catch (error) {
        if (error instanceof ContractError) {
          throw new ContractViolationError(
            contractName,
            options.layer || "unknown",
            error
          );
        } else {
          // Handle unexpected errors
          throw new ContractViolationError(
            contractName,
            options.layer || "unknown",
            new ContractError("UNEXPECTED_ERROR", (error as Error).message)
          );
        }
      }
    };

    return descriptor;
  };
}
