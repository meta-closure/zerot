// src/templates/contract-helpers.ts

import { ContractOptions } from "zerot/core/types";
import { auth } from "zerot/conditions/auth";
import { owns } from "zerot/conditions/owns";
import { validates, returns } from "zerot/conditions/validation";
import { rateLimit } from "zerot/conditions/rate-limit";
import { auditLog } from "zerot/conditions/audit";
import { businessRule } from "zerot/conditions/business-rules";
import { z } from "zod";

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
      invariants: []
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
      if (contract.layer) result.layer = contract.layer;
      if (contract.retryAttempts !== undefined) result.retryAttempts = contract.retryAttempts;
      if (contract.retryDelayMs !== undefined) result.retryDelayMs = contract.retryDelayMs;
      if (contract.retryOnCategories) result.retryOnCategories = contract.retryOnCategories;
    }

    return result;
  },

  /**
   * Create a base authenticated contract.
   */
  authenticated(role: string = "user"): Partial<ContractOptions> {
    return {
      requires: [auth(role)]
    };
  },

  /**
   * Create a base ownership-required contract.
   */
  withOwnership(resourceField: string): Partial<ContractOptions> {
    return {
      requires: [owns(resourceField)]
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
      requires: [validates(inputSchema)]
    };
    
    if (outputSchema) {
      contract.ensures = [returns(outputSchema)];
    }
    
    return contract;
  },

  /**
   * Create a rate-limited contract.
   */
  rateLimited(operation: string, limit: number, windowMs?: number): Partial<ContractOptions> {
    return {
      requires: [rateLimit(operation, limit, windowMs)]
    };
  },

  /**
   * Create an audited contract.
   */
  audited(action: string): Partial<ContractOptions> {
    return {
      ensures: [auditLog(action)]
    };
  },

  /**
   * Create a contract with retry configuration.
   */
  withRetry(attempts: number, delayMs?: number): Partial<ContractOptions> {
    return {
      retryAttempts: attempts,
      retryDelayMs: delayMs
    };
  },

  /**
   * Create a contract with custom business rules.
   */
  withBusinessRules(...rules: Array<{
    description: string;
    rule: (input: any, context: any) => boolean | Promise<boolean>;
  }>): Partial<ContractOptions> {
    return {
      requires: rules.map(r => businessRule(r.description, r.rule))
    };
  }
};

/**
 * Extended contract templates with more specific use cases.
 */
export const ExtendedContractTemplates = {
  /**
   * CRUD operation with full validation and security.
   */
  secureCRUD<TInput, TOutput>(options: {
    role?: string;
    resourceField?: string;
    inputSchema: z.ZodSchema<TInput>;
    outputSchema: z.ZodSchema<TOutput>;
    operation: string;
    rateLimit?: number;
  }): ContractOptions {
    return ContractHelpers.combine(
      ContractHelpers.authenticated(options.role),
      options.resourceField ? ContractHelpers.withOwnership(options.resourceField) : {},
      ContractHelpers.validated(options.inputSchema, options.outputSchema),
      options.rateLimit ? ContractHelpers.rateLimited(options.operation, options.rateLimit) : {},
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
  businessLogic(options: {
    rules: Array<{
      description: string;
      rule: (input: any, context: any) => boolean | Promise<boolean>;
    }>;
    retryAttempts?: number;
    auditAction: string;
  }): ContractOptions {
    return ContractHelpers.combine(
      ContractHelpers.withBusinessRules(...options.rules),
      options.retryAttempts ? ContractHelpers.withRetry(options.retryAttempts) : {},
      ContractHelpers.audited(options.auditAction),
      { layer: "business" }
    );
  },

  /**
   * Admin-only operation with comprehensive logging.
   */
  adminOperation(options: {
    operation: string;
    inputSchema?: z.ZodSchema;
    rateLimit?: number;
    retryAttempts?: number;
  }): ContractOptions {
    return ContractHelpers.combine(
      ContractHelpers.authenticated("admin"),
      options.inputSchema ? ContractHelpers.validated(options.inputSchema) : {},
      options.rateLimit ? ContractHelpers.rateLimited(`admin_${options.operation}`, options.rateLimit) : {},
      options.retryAttempts ? ContractHelpers.withRetry(options.retryAttempts) : {},
      ContractHelpers.audited(`admin_${options.operation}`),
      { layer: "action" }
    );
  }
};
