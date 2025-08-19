// src/templates/contract-helpers.ts

import { auditLog } from "@/conditions/audit";
import { auth } from "@/conditions/auth";
import { businessRule } from "@/conditions/business-rules";
import { owns } from "@/conditions/owns";
import { rateLimit } from "@/conditions/rate-limit";
import { returns, validates } from "@/conditions/validation";
import { AuthContext, ContractOptions } from "@/core/types";
import { z } from "zod";

/**
 * Business rule definition interface
 */
interface BusinessRuleDefinition<T = unknown> {
  description: string;
  rule: (input: T, context: AuthContext) => boolean | Promise<boolean>;
}

/**
 * Helper functions for combining contract conditions.
 * These provide a more functional approach to building contracts.
 */
export const ContractHelpers = {
  /**
   * Combine multiple contract options into one.
   * Later options override earlier ones for non-array properties.
   */
  combine(...contracts: Partial<ContractOptions>[]): ContractOptions {
    const result: ContractOptions = {
      requires: [],
      ensures: [],
      invariants: [],
    };

    for (const contract of contracts) {
      if (contract.requires) {
        result.requires!.push(...contract.requires);
      }
      if (contract.ensures) {
        result.ensures!.push(...contract.ensures);
      }
      if (contract.invariants) {
        result.invariants!.push(...contract.invariants);
      }

      // Override non-array properties
      if (contract.layer) {
        result.layer = contract.layer;
      }
      if (contract.retryAttempts !== undefined) {
        result.retryAttempts = contract.retryAttempts;
      }
      if (contract.retryDelayMs !== undefined) {
        result.retryDelayMs = contract.retryDelayMs;
      }
      if (contract.retryOnCategories) {
        result.retryOnCategories = contract.retryOnCategories;
      }
    }

    return result;
  },

  /**
   * Create a base authenticated contract.
   */
  authenticated(role = "user"): Partial<ContractOptions> {
    return {
      requires: [auth(role)],
    };
  },

  /**
   * Create a base ownership-required contract.
   */
  withOwnership<T extends Record<string, unknown>>(
    resourceField: keyof T & string
  ): Partial<ContractOptions> {
    return {
      requires: [owns<T>(resourceField)],
    };
  },

  /**
   * Create a validated contract with input/output schemas.
   */
  validated<TInput, TOutput>(
    inputSchema: z.ZodSchema<TInput>,
    outputSchema?: z.ZodSchema<TOutput>
  ): Partial<ContractOptions> {
    const contract: Partial<ContractOptions> = {
      requires: [validates(inputSchema)],
    };

    if (outputSchema) {
      contract.ensures = [returns(outputSchema)];
    }

    return contract;
  },

  /**
   * Create a rate-limited contract.
   */
  rateLimited(
    operation: string,
    limit: number,
    windowMs?: number
  ): Partial<ContractOptions> {
    return {
      requires: [rateLimit(operation, limit, windowMs)],
    };
  },

  /**
   * Create an audited contract.
   */
  audited(action: string): Partial<ContractOptions> {
    return {
      ensures: [auditLog(action)],
    };
  },

  /**
   * Create a contract with retry configuration.
   */
  withRetry(attempts: number, delayMs?: number): Partial<ContractOptions> {
    return {
      retryAttempts: attempts,
      retryDelayMs: delayMs,
    };
  },

  /**
   * Create a contract with custom business rules.
   */
  withBusinessRules<T = unknown>(
    ...rules: BusinessRuleDefinition<T>[]
  ): Partial<ContractOptions> {
    return {
      requires: rules.map((r) => businessRule<T>(r.description, r.rule)),
    };
  },
};

/**
 * Extended contract templates with more specific use cases.
 */
export const ExtendedContractTemplates = {
  /**
   * CRUD operation with full validation and security.
   */
  secureCRUD<TInput extends Record<string, unknown>, TOutput>(options: {
    role?: string;
    resourceField?: keyof TInput & string;
    inputSchema: z.ZodSchema<TInput>;
    outputSchema: z.ZodSchema<TOutput>;
    operation: string;
    rateLimit?: number;
  }): ContractOptions {
    return ContractHelpers.combine(
      ContractHelpers.authenticated(options.role),
      options.resourceField
        ? ContractHelpers.withOwnership<TInput>(options.resourceField)
        : {},
      ContractHelpers.validated(options.inputSchema, options.outputSchema),
      options.rateLimit
        ? ContractHelpers.rateLimited(options.operation, options.rateLimit)
        : {},
      ContractHelpers.audited(options.operation),
      { layer: "action" }
    );
  },

  /**
   * Public API endpoint with validation and rate limiting.
   */
  publicEndpoint<TInput, TOutput>(options: {
    inputSchema: z.ZodSchema<TInput>;
    outputSchema?: z.ZodSchema<TOutput>;
    operation: string;
    rateLimit: number;
  }): ContractOptions {
    return ContractHelpers.combine(
      ContractHelpers.validated(options.inputSchema, options.outputSchema),
      ContractHelpers.rateLimited(options.operation, options.rateLimit),
      ContractHelpers.audited(`public_${options.operation}`),
      { layer: "presentation" }
    );
  },

  /**
   * Business logic with custom rules and retry.
   */
  businessLogic<T = unknown>(options: {
    rules: BusinessRuleDefinition<T>[];
    retryAttempts?: number;
    auditAction: string;
  }): ContractOptions {
    return ContractHelpers.combine(
      ContractHelpers.withBusinessRules<T>(...options.rules),
      options.retryAttempts
        ? ContractHelpers.withRetry(options.retryAttempts)
        : {},
      ContractHelpers.audited(options.auditAction),
      { layer: "business" }
    );
  },

  /**
   * Admin-only operation with comprehensive logging.
   */
  adminOperation<
    TInput extends Record<string, unknown> = Record<string, unknown>,
  >(options: {
    operation: string;
    inputSchema?: z.ZodSchema<TInput>;
    rateLimit?: number;
    retryAttempts?: number;
  }): ContractOptions {
    return ContractHelpers.combine(
      ContractHelpers.authenticated("admin"),
      options.inputSchema ? ContractHelpers.validated(options.inputSchema) : {},
      options.rateLimit
        ? ContractHelpers.rateLimited(
            `admin_${options.operation}`,
            options.rateLimit
          )
        : {},
      options.retryAttempts
        ? ContractHelpers.withRetry(options.retryAttempts)
        : {},
      ContractHelpers.audited(`admin_${options.operation}`),
      { layer: "action" }
    );
  },

  /**
   * Data access layer operation with validation and retry.
   */
  dataOperation<TInput extends Record<string, unknown>, TOutput>(options: {
    inputSchema: z.ZodSchema<TInput>;
    outputSchema?: z.ZodSchema<TOutput>;
    operation: string;
    retryAttempts?: number;
    businessRules?: BusinessRuleDefinition<TInput>[];
  }): ContractOptions {
    return ContractHelpers.combine(
      ContractHelpers.validated(options.inputSchema, options.outputSchema),
      options.businessRules
        ? ContractHelpers.withBusinessRules<TInput>(...options.businessRules)
        : {},
      options.retryAttempts
        ? ContractHelpers.withRetry(options.retryAttempts)
        : {},
      ContractHelpers.audited(`data_${options.operation}`),
      { layer: "data" }
    );
  },

  /**
   * User-specific operation with ownership and validation.
   */
  userOperation<TInput extends Record<string, unknown>, TOutput>(options: {
    resourceField: keyof TInput & string;
    inputSchema: z.ZodSchema<TInput>;
    outputSchema?: z.ZodSchema<TOutput>;
    operation: string;
    rateLimit?: number;
    role?: string;
  }): ContractOptions {
    return ContractHelpers.combine(
      ContractHelpers.authenticated(options.role || "user"),
      ContractHelpers.withOwnership<TInput>(options.resourceField),
      ContractHelpers.validated(options.inputSchema, options.outputSchema),
      options.rateLimit
        ? ContractHelpers.rateLimited(
            `user_${options.operation}`,
            options.rateLimit
          )
        : {},
      ContractHelpers.audited(`user_${options.operation}`),
      { layer: "action" }
    );
  },
};

/**
 * Type-safe factory functions for common contract patterns.
 */
export const ContractFactory = {
  /**
   * Create a contract for creating resources.
   */
  create<TInput extends Record<string, unknown>, TOutput>(
    inputSchema: z.ZodSchema<TInput>,
    outputSchema: z.ZodSchema<TOutput>,
    options: {
      role?: string;
      rateLimit?: number;
      businessRules?: BusinessRuleDefinition<TInput>[];
    } = {}
  ): ContractOptions {
    return ExtendedContractTemplates.secureCRUD({
      inputSchema,
      outputSchema,
      operation: "CREATE",
      role: options.role || "user",
      rateLimit: options.rateLimit,
    });
  },

  /**
   * Create a contract for reading resources.
   */
  read<TInput extends Record<string, unknown>, TOutput>(
    inputSchema: z.ZodSchema<TInput>,
    outputSchema: z.ZodSchema<TOutput>,
    resourceField: keyof TInput & string,
    options: {
      role?: string;
      rateLimit?: number;
    } = {}
  ): ContractOptions {
    return ExtendedContractTemplates.userOperation({
      inputSchema,
      outputSchema,
      resourceField,
      operation: "READ",
      role: options.role || "user",
      rateLimit: options.rateLimit,
    });
  },

  /**
   * Create a contract for updating resources.
   */
  update<TInput extends Record<string, unknown>, TOutput>(
    inputSchema: z.ZodSchema<TInput>,
    outputSchema: z.ZodSchema<TOutput>,
    resourceField: keyof TInput & string,
    options: {
      role?: string;
      rateLimit?: number;
      businessRules?: BusinessRuleDefinition<TInput>[];
    } = {}
  ): ContractOptions {
    return ContractHelpers.combine(
      ExtendedContractTemplates.userOperation({
        inputSchema,
        outputSchema,
        resourceField,
        operation: "UPDATE",
        role: options.role || "user",
        rateLimit: options.rateLimit,
      }),
      options.businessRules
        ? ContractHelpers.withBusinessRules<TInput>(...options.businessRules)
        : {}
    );
  },

  /**
   * Create a contract for deleting resources.
   */
  delete<TInput extends Record<string, unknown>>(
    inputSchema: z.ZodSchema<TInput>,
    resourceField: keyof TInput & string,
    options: {
      role?: string;
      rateLimit?: number;
      businessRules?: BusinessRuleDefinition<TInput>[];
    } = {}
  ): ContractOptions {
    return ContractHelpers.combine(
      ExtendedContractTemplates.userOperation({
        inputSchema,
        resourceField,
        operation: "DELETE",
        role: options.role || "user",
        rateLimit: options.rateLimit || 10, // Default stricter rate limit for deletes
      }),
      options.businessRules
        ? ContractHelpers.withBusinessRules<TInput>(...options.businessRules)
        : {}
    );
  },
};
