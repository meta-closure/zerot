/**
 * Exports the main `contract` decorator for applying pre-conditions, post-conditions, and invariants.
 * @module core/contract
 */
export { contract } from "./core/contract";

/**
 * Exports custom error classes used within the contract system.
 * `ContractError` is the base error, and `ContractViolationError` indicates a contract breach.
 * @module core/errors
 */
export {
  ContractError,
  ContractViolationError,
  ErrorCategory,
} from "./core/errors";

/**
 * Exports core types and interfaces used throughout the contract system,
 * including `AuthContext`, `ContractOptions`, and various condition types.
 * @module core/types
 */
export type {
  AuthContext,
  ContractCondition,
  ContractEnsuresCondition,
  ContractInvariant,
  ContractOptions,
  ContractValidator,
  ResourceProvider,
  SessionProvider,
} from "./core/types";

/**
 * Exports utility functions for working with authentication context and resources.
 * @module core/types
 */
export { getAuthContext, getResource } from "./core/types";

/**
 * Exports adapter-related classes and utilities for framework integration.
 * @module core/adapters
 */
export { AdapterRegistry, BaseAdapter } from "./core/adapters/base";
export type { ZerotAdapter } from "./core/adapters/base";

/**
 * Exports Next.js adapter for integration with Next.js applications.
 * @module core/adapters/nextjs
 */
export {
  createNextjsAdapter,
  NextjsAdapter,
  withZerotContext,
} from "./core/adapters/nextjs";

/**
 * Exports request context management utilities.
 * @module core/context
 */
export {
  clearRequestContext,
  createRequestContext,
  getRequestContext,
  setRequestContext,
  withRequestContext,
} from "./core/context";

// Conditions

/**
 * Exports the `auth` condition for authentication and role-based access control.
 * @module conditions/auth
 */
export { auth } from "./conditions/auth";

/**
 * Exports the `owns` condition for checking resource ownership.
 * @module conditions/owns
 */
export { owns } from "./conditions/owns";

/**
 * Exports `validates` for input validation using Zod schemas and `returns` for output validation.
 * @module conditions/validation
 */
export { returns, validates } from "./conditions/validation";

/**
 * Exports the `rateLimit` condition for controlling operation frequency.
 * @module conditions/rate-limit
 */
export {
  clearAllRateLimits,
  clearRateLimit,
  getRateLimitStatus,
  rateLimit,
} from "./conditions/rate-limit";

/**
 * Exports the `auditLog` condition for logging audit events.
 * @module conditions/audit
 */
export { auditLog, auditLogFailure } from "./conditions/audit";

/**
 * Exports the `businessRule` condition for custom business logic validation.
 * @module conditions/business-rules
 */
export { businessRule } from "./conditions/business-rules";

// Templates

/**
 * Exports `ContractTemplates` which provides predefined contract configurations for common use cases.
 * @module templates/contract-templates
 */
export { ContractTemplates } from "./templates/contract-templates";

/**
 * Exports contract helpers for combining and building contracts functionally.
 * @module templates/contract-helpers
 */
export {
  ContractFactory,
  ContractHelpers,
  ExtendedContractTemplates,
} from "./templates/contract-helpers";

/**
 * Exports `smartContract` for automatically inferring contract conditions based on operation patterns.
 * @module templates/smart-contract
 */
export { smartContract } from "./templates/smart-contract";

// Configuration

/**
 * Exports configuration utilities and presets.
 * @module config
 */
export {
  configureZerot,
  getZerotConfig,
  isZerotConfigured,
  zerotConfig,
  ZerotPresets,
} from "./config";

export type {
  AuditEvent,
  AuditLogger,
  RateLimitStore,
  ZerotConfig,
} from "./config";

// Note: The following exports are commented out as the corresponding modules
// were not provided in the conversation. Uncomment them when these modules are available.

// Utils (Debugger, Performance, Optimizer)
// /**
//  * Exports `ContractDebugger` for logging and reporting contract execution history in development.
//  * @module utils/debugger
//  */
// export { ContractDebugger } from "./utils/debugger";

// /**
//  * Exports `ContractPerformanceMonitor` for measuring and reporting contract execution performance.
//  * @module utils/performance
//  */
// export { ContractPerformanceMonitor } from "./utils/performance";

// /**
//  * Exports `OptimizedContractSystem` for advanced contract optimization features.
//  * @module utils/optimizer
//  */
// export { OptimizedContractSystem } from "./utils/optimizer";

// Integrations
// /**
//  * Exports `createServerAction` for integrating contracts with Next.js Server Actions.
//  * @module integrations/server-actions
//  */
// export { createServerAction } from "./integrations/server-actions";

// /**
//  * Exports `withContractMiddleware` for integrating contracts with Next.js Middleware.
//  * @module integrations/nextjs
//  */
// export { withContractMiddleware } from "./integrations/nextjs";
