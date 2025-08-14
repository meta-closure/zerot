import { z } from "zod";
import { ContractError, ErrorCategory } from "~/core/errors";
import { ContractEnsuresCondition, ContractValidator } from "~/core/types"; // Import generic types

/**
 * Creates a validation condition that uses a Zod schema to validate and optionally transform input.
 * This condition is marked as a validator for the `@contract` decorator, meaning it can modify the input.
 *
 * @template TSchema - The Zod schema type.
 * @template TInput - The expected type of the input before validation.
 * @template TOutput - The inferred type from the Zod schema, or the transformed type.
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
 *   async processUser(user: z.infer<typeof UserSchema>) {
 *     // user is guaranteed to conform to UserSchema here
 *     logger.debug(`Processing user: ${JSON.stringify(user)}`);
 *   }
 * }
 * ```
 */
export function validates<
  TSchema extends z.ZodSchema,
  TInput = unknown,
  TOutput = z.infer<TSchema>,
>(
  schema: TSchema,
  transformer?: (input: z.infer<TSchema>) => TOutput
): ContractValidator<TInput, TOutput> {
  const validator = (input: TInput): TOutput => {
    try {
      const parsedInput = schema.parse(input) as z.infer<TSchema>;
      return transformer ? transformer(parsedInput) : (parsedInput as TOutput);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const messages = error.issues
          .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
          .join(", ");
        throw new ContractError(`Input validation failed: ${messages}`, {
          code: "VALIDATION_FAILED",
          category: ErrorCategory.VALIDATION,
          details: { issues: error.issues },
        });
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
 * @template TSchema - The Zod schema type.
 * @template TOutput - The expected type of the output to be validated.
 * @template TInput - The expected type of the original input to the method.
 * @template TContext - The expected type of the authentication context.
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
 *   async getUser(id: string): Promise<z.infer<typeof UserOutputSchema>> {
 *     // Assume this fetches a user
 *     return { id: id, name: "John Doe" };
 *   }
 * }
 * ```
 */
export function returns<
  TSchema extends z.ZodSchema,
  TOutput = z.infer<TSchema>,
  TInput = any,
  TContext = any,
>(schema: TSchema): ContractEnsuresCondition<TOutput, TInput, TContext> {
  return (output: TOutput, _input: TInput, _context: TContext) => {
    try {
      schema.parse(output);
      return true;
    } catch (error: unknown) {
      // Ensure all caught errors are wrapped in ContractError for consistent handling
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      return new ContractError(
        `Output does not match expected schema: ${errorMessage}`,
        {
          code: "OUTPUT_VALIDATION_FAILED",
          category: ErrorCategory.VALIDATION,
          details: {
            originalErrorMessage: errorMessage,
            originalErrorStack: errorStack,
          },
        }
      );
    }
  };
}
