import { ContractError, ErrorCategory } from "../core/errors";
import { AuthContext } from "../core/types";

/**
 * Creates a business rule condition.
 * This condition allows defining custom business logic that must pass for a method to execute or complete.
 *
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
 *       businessRule(
 *         "Order value must be positive",
 *         (input: { value: number }) => input.value > 0
 *       ),
 *       businessRule(
 *         "User must have sufficient balance",
 *         async (input: { userId: string; value: number }, context: AuthContext) => {
 *           const userBalance = await getUserBalance(input.userId);
 *           return userBalance >= input.value;
 *         }
 *       ),
 *     ],
 *   })
 *   async placeOrder(order: { userId: string; value: number }, context: AuthContext) {
 *     // Logic to place the order
 *     console.log(`Order placed for user ${order.userId} with value ${order.value}`);
 *   }
 * }
 * ```
 */
export function businessRule(
  description: string,
  rule: (input: any, context: AuthContext) => boolean | Promise<boolean>
) {
  return async (input: any, context: AuthContext): Promise<boolean> => {
    const passed = await Promise.resolve(rule(input, context));
    if (!passed) {
      throw new ContractError(description, {
        code: "BUSINESS_RULE_VIOLATION",
        category: ErrorCategory.BUSINESS_LOGIC,
      });
    }
    return true;
  };
}
