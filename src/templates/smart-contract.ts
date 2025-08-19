import { auditLog } from "@/conditions/audit";
import { auth } from "@/conditions/auth";
import { owns } from "@/conditions/owns";
import { rateLimit } from "@/conditions/rate-limit";
import { returns, validates } from "@/conditions/validation";
import { ContractOptions } from "@/core/types";
import { z } from "zod";

// Placeholder schemas for demonstration.
// In a real application, these would be defined elsewhere or passed in.
const userCreateSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
  role: z.enum(["user", "admin", "moderator"]).default("user"),
});

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
 * Schema registry type
 */
type SchemaRegistry = Record<string, Record<string, z.ZodSchema>>;

/**
 * Retrieves the appropriate Zod schema for a given resource and operation.
 * This function acts as a lookup for input/output validation schemas.
 *
 * @param resource - The name of the resource (e.g., "user", "product").
 * @param operation - The type of operation (e.g., "create", "update", "output").
 * @returns The Zod schema corresponding to the resource and operation, or `z.any()` if not found.
 */
function getSchemaForResource(
  resource: string,
  operation: string
): z.ZodSchema {
  const schemas: SchemaRegistry = {
    user: {
      create: userCreateSchema,
      update: userUpdateSchema,
      output: userOutputSchema,
    },
    // Define schemas for other resources here
  };

  return schemas[resource]?.[operation] || z.any();
}

/**
 * A helper function to automatically infer contract conditions based on common operation patterns.
 * This can be used to quickly set up contracts for typical CRUD operations with varying visibility.
 *
 * @param options - Configuration options for the smart contract.
 * @param options.operation - The type of operation (e.g., "create", "read", "update", "delete").
 * @param options.resource - The name of the resource (e.g., "user", "product").
 * @param options.visibility - The visibility level ("public", "private", "admin").
 * @param options.rateLimit - Optional. The maximum number of operations allowed per minute.
 * @returns A `ContractOptions` object configured with appropriate conditions.
 *
 * @example
 * ```typescript
 * class ProductService {
 *   @contract(smartContract({
 *     operation: "create",
 *     resource: "product",
 *     visibility: "admin",
 *     rateLimit: 10
 *   }))
 *   async createProduct(productData: unknown) {
 *     // Logic to create a product
 *   }
 *
 *   @contract(smartContract({
 *     operation: "read",
 *     resource: "product",
 *     visibility: "public"
 *   }))
 *   async getProduct(productId: string) {
 *     // Logic to get a product
 *   }
 * }
 * ```
 */
export function smartContract(options: {
  operation: "create" | "read" | "update" | "delete";
  resource: string;
  visibility: "public" | "private" | "admin";
  rateLimit?: number;
}): ContractOptions {
  const contracts: ContractOptions = {
    requires: [],
    ensures: [],
    invariants: [],
    layer: "unknown", // Default layer, can be overridden
  };

  // Authentication requirements based on visibility
  switch (options.visibility) {
    case "public":
      // No authentication required for public operations
      break;
    case "private":
      // Private operations require user authentication
      contracts.requires!.push(auth("user"));
      // For non-create private operations, ownership check is required
      if (options.operation !== "create") {
        contracts.requires!.push(
          owns<Record<string, unknown>>(`${options.resource}Id`)
        );
      }
      break;
    case "admin":
      // Admin operations require admin authentication
      contracts.requires!.push(auth("admin"));
      break;
  }

  // Input validation requirements based on operation
  if (["create", "update"].includes(options.operation)) {
    // Input validation is required for create/update operations
    contracts.requires!.push(
      validates(getSchemaForResource(options.resource, options.operation))
    );
  }

  // Rate limiting condition
  if (options.rateLimit) {
    contracts.requires!.push(
      rateLimit(`${options.operation}_${options.resource}`, options.rateLimit)
    );
  }

  // Audit logging condition (always included for traceability)
  contracts.ensures!.push(auditLog(`${options.operation}_${options.resource}`));

  // Output validation condition
  if (["create", "read", "update"].includes(options.operation)) {
    contracts.ensures!.push(
      returns(getSchemaForResource(options.resource, "output"))
    );
  }

  return contracts;
}
