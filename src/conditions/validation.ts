import { z } from "zod";
import { ContractError } from "../core/errors";

/**
 * Creates a validation condition that uses a Zod schema to validate and optionally transform input.
 * This condition is marked as a validator for the `@contract` decorator, meaning it can modify the input.
 *
 * @template T - The Zod schema type.
 * @template U - The inferred type from the Zod schema.
 * @param schema - The Zod schema to validate the input against.
 * @param transformer - An optional function to transform the validated input.
 * @returns A validator function that takes input and returns the validated/transformed input.
 * @throws {ContractError} If the input validation fails.
 *
 * @example
 * ```typescript
 * const UserSchema = z.object({ name: z.string(), email: z.string().email() });
 *
 * class MyService {
 *   @contract({
 *     requires: [validates(UserSchema)],
 *   })
 *   async processUser(user: { name: string; email: string }) {
 *     // user is guaranteed to conform to UserSchema here
 *     console.log("Processing user:", user);
 *   }
 * }
 * ```
 */
export function validates<T extends z.ZodSchema, U = z.infer<T>>(
  schema: T,
  transformer?: (input: U) => any
) {
  const validator = (input: unknown): any => {
    try {
      const parsedInput = schema.parse(input) as U;
      return transformer ? transformer(parsedInput) : parsedInput;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const messages = error.issues
          .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
          .join(", ");
        throw new ContractError(
          "VALIDATION_FAILED",
          `Input validation failed: ${messages}`
        );
      }
      throw error;
    }
  };
  // Mark this function as a validator for the @contract decorator
  (validator as any).isValidator = true;
  return validator;
}

/**
 * Creates a post-condition that validates the output of a method against a Zod schema.
 *
 * @param schema - The Zod schema to validate the output against.
 * @returns A condition function that takes output, input, and context, and returns a boolean.
 * @throws {ContractError} If the output validation fails.
 *
 * @example
 * ```typescript
 * const UserOutputSchema = z.object({ id: z.string(), name: z.string() });
 *
 * class MyService {
 *   @contract({
 *     ensures: [returns(UserOutputSchema)],
 *   })
 *   async getUser(id: string): Promise<{ id: string; name: string }> {
 *     // Assume this fetches a user
 *     return { id: id, name: "John Doe" };
 *   }
 * }
 * ```
 */
export function returns(schema: z.ZodSchema) {
  return (output: any, input: any, context: any): boolean => {
    try {
      schema.parse(output);
      return true;
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new ContractError(
          "OUTPUT_VALIDATION_FAILED",
          `Output does not match expected schema: ${error.message}`
        );
      }
      throw error; // Re-throw if it's not an Error instance
    }
  };
}
