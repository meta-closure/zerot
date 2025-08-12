import { ContractOptions } from "../core/types";
import { auth } from "../conditions/auth";
import { validates, returns } from "../conditions/validation";
import { owns } from "../conditions/owns";
import { rateLimit } from "../conditions/rate-limit";
import { auditLog } from "../conditions/audit";
import { ContractError } from "../core/errors";
import { z } from "zod";

// Placeholder schemas for demonstration.
// In a real application, these would be defined elsewhere or passed in.
const userUpdateSchema = z.object({
  userId: z.string().uuid().optional(),
  email: z.string().email().optional(),
  name: z.string().optional(),
  role: z.enum(["user", "admin", "moderator"]).optional(),
});

const userOutputSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string(),
  role: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

/**
 * Provides a collection of predefined contract templates for common use cases.
 * These templates help quickly apply standard sets of conditions to methods.
 */
export const ContractTemplates = {
  /**
   * Template for basic CRUD operations on user resources.
   * Requires authentication, input validation, ownership check, and applies rate limiting and audit logging.
   * @param requiredRole - The role required for the user to perform the operation (defaults to "user").
   * @returns `ContractOptions` configured for user CRUD operations.
   */
  userCRUD: (requiredRole: string = "user"): ContractOptions => ({
    requires: [
      auth(requiredRole),
      validates(userUpdateSchema), // Example schema
      owns("userId"),
      rateLimit("userCRUD", 10),
    ],
    ensures: [returns(userOutputSchema), auditLog("user_crud")], // Example schema
    layer: "action", // Default layer for CRUD actions
  }),

  /**
   * Template for operations accessible only by administrators.
   * Requires "admin" role authentication and applies rate limiting and audit logging.
   * @param operation - A string identifying the specific admin operation (e.g., "delete_user", "manage_settings").
   * @returns `ContractOptions` configured for admin-only operations.
   */
  adminOnly: (operation: string): ContractOptions => ({
    requires: [auth("admin"), rateLimit(`admin_${operation}`, 20)],
    ensures: [auditLog(`admin_${operation}`)],
    layer: "action",
  }),

  /**
   * Template for public API endpoints that do not require authentication.
   * Applies basic input validation, rate limiting, and audit logging.
   * @param operation - A string identifying the specific public API operation (e.g., "get_product_list", "search_items").
   * @returns `ContractOptions` configured for public API operations.
   */
  publicAPI: (operation: string): ContractOptions => ({
    requires: [
      validates(z.any()), // Only basic input validation
      rateLimit(`public_${operation}`, 100),
    ],
    ensures: [auditLog(`public_${operation}`)],
    layer: "presentation",
  }),

  /**
   * Template for batch processing operations.
   * Requires admin authentication and validates that the input is an array within a size limit.
   * Applies audit logging.
   * @param itemContract - Optional `ContractOptions` to apply to each item within the batch (not directly used here, but for conceptual extension).
   * @returns `ContractOptions` configured for batch operations.
   */
  batchOperation: (itemContract: ContractOptions): ContractOptions => ({
    requires: [
      auth("admin"),
      (input: any[]) => {
        if (!Array.isArray(input)) {
          throw new ContractError('INVALID_BATCH_INPUT', 'Input must be an array');
        }
        if (input.length > 1000) {
          throw new ContractError(
            "BATCH_TOO_LARGE",
            "Batch size must be ≤ 1000 items"
          );
        }
        return true;
      },
    ],
    ensures: [auditLog("batch_operation")],
    layer: "action",
  }),
};
