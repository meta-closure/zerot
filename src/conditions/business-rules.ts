import { ContractError, ErrorCategory } from "@/core/errors";
import { AuthContext } from "@/core/types";

/**
 * Creates a business rule condition.
 * This condition allows defining custom business logic that must pass for a method to execute or complete.
 *
 * @template T - The input type that will be passed to the business rule
 * @param description - A descriptive message for the business rule, used in case of violation.
 * @param rule - A function that implements the business logic. It takes input and authentication context,
 *               and returns a boolean or a Promise resolving to a boolean.
 * @returns A condition function that takes input and authentication context, and returns a Promise resolving to a boolean.
 * @throws {ContractError} If the business rule is violated.
 *
 * @example
 * ```typescript
 * class OrderService {
 *   @contract({
 *     requires: [
 *       businessRule<{ value: number }>(
 *         "Order value must be positive",
 *         (input) => input.value > 0
 *       ),
 *       businessRule<{ userId: string; value: number }>(
 *         "User must have sufficient balance",
 *         async (input, context) => {
 *           const userBalance = await getUserBalance(input.userId);
 *           return userBalance >= input.value;
 *         }
 *       ),
 *     ],
 *   })
 *   async placeOrder(order: { userId: string; value: number }, context: AuthContext) {
 *     // Logic to place the order
 *     logger.debug(`Order placed for user ${order.userId} with value ${order.value}`);
 *   }
 * }
 * ```
 */
export function businessRule<T = unknown>(
  description: string,
  rule: (input: T, context: AuthContext) => boolean | Promise<boolean>
) {
  return async (input: T, context: AuthContext): Promise<boolean> => {
    try {
      const passed = await Promise.resolve(rule(input, context));
      if (!passed) {
        throw new ContractError(description, {
          code: "BUSINESS_RULE_VIOLATION",
          category: ErrorCategory.BUSINESS_LOGIC,
        });
      }
      return true;
    } catch (error: unknown) {
      // If the error is already a ContractError or any other error from the rule function,
      // re-throw it as-is to preserve the original error information
      if (error instanceof ContractError) {
        throw error;
      }

      // For non-ContractError exceptions from the rule function,
      // re-throw them directly to preserve their original type and message
      throw error;
    }
  };
}
