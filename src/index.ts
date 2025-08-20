/**
 * Zerot: Design by Contract for TypeScript
 * Main entry point with all exports
 */

// ===== CORE CONTRACT SYSTEM =====

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
 * Exports core types and interfaces used throughout the contract system.
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
export { getAuthContext, getResource, isValidator } from "./core/types";

// ===== FRAMEWORK INTEGRATION =====

/**
 * Exports adapter-related classes and utilities for framework integration.
 * @module core/adapters/base
 */
export { AdapterRegistry, BaseAdapter } from "./core/adapters/base";
export type { ZerotAdapter } from "./core/adapters/base";

/**
 * Exports Next.js adapter for integration with Next.js applications.
 * @module core/adapters/nextjs
 */
export {
  createCookieOnlyAdapter,
  createCustomSessionAdapter,
  createJWTAdapter,
  createNextjsAdapter,
  createZerotApiHandler,
  isNextjsEnvironment,
  logAdapterStatus,
  NextjsAdapter,
  NextjsSessionUtils,
  withZerotContext,
} from "./core/adapters/nextjs";

export type { NextjsAdapterOptions } from "./core/adapters/nextjs";

// ===== REQUEST CONTEXT MANAGEMENT =====

/**
 * Exports request context management utilities.
 * @module core/context
 */
export {
  clearRequestContext,
  createRequestContext,
  getAuthContextFromRequest,
  getContextValue,
  getRequestContext,
  getRequestContextSafe,
  getRequestMetadata,
  hasRequestContext,
  setContextValue,
  setRequestContext,
  updateRequestContext,
  withRequestContext,
} from "./core/context";

export type { RequestContext } from "./core/context";

// ===== BUILT-IN SECURITY CONDITIONS =====

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
 * Exports the `rateLimit` condition for controlling operation frequency and utility functions.
 * @module conditions/rate-limit
 */
export {
  checkRateLimit,
  clearAllRateLimits,
  clearRateLimit,
  getAllRateLimits,
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

// ===== CONTRACT TEMPLATES =====

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

// ===== CONFIGURATION =====

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
  ConfigChangeEvent,
  ConfigChangeListener,
  Environment,
  LogLevel,
  RateLimitStore,
  ZerotConfig,
} from "./config";

// ===== DEVELOPMENT & DEBUGGING TOOLS =====

/**
 * Exports contract debugging utilities for development mode.
 * @module utils/debugger
 */
export { ContractDebugger } from "./utils/debugger";

/**
 * Exports performance monitoring utilities.
 * @module utils/performance
 */
export { ContractPerformanceMonitor } from "./utils/performance";

/**
 * Exports metrics collection utilities.
 * @module utils/metrics
 */
export { Metrics } from "./utils/metrics";

/**
 * Exports utility functions for delays and common operations.
 * @module utils/delay
 */
export { delay } from "./utils/delay";

/**
 * Exports logging utilities.
 * @module utils/logger
 */
export { logger } from "./utils/logger";
export type { Logger } from "./utils/logger";

/**
 * Exports contract optimization utilities.
 * @module utils/optimizer
 */
export { OptimizedContractSystem } from "./utils/optimizer";

// ===== PACKAGE METADATA =====

/**
 * Package version and metadata
 */
export const VERSION = "1.0.2";
export const PACKAGE_NAME = "zerot";
