/**
 * Exports the main `contract` decorator for applying pre-conditions, post-conditions, and invariants.
 * @module core/contract
 */
export { contract } from "zerot/core/contract";

/**
 * Exports custom error classes used within the contract system.
 * `ContractError` is the base error, and `ContractViolationError` indicates a contract breach.
 * @module core/errors
 */
export { ContractError, ContractViolationError } from "zerot/core/errors";

/**
 * Exports core types and interfaces used throughout the contract system,
 * including `AuthContext`, `ContractOptions`, and various condition types.
 * @module core/types
 */
export type {
  AuthContext,
  ContractOptions,
  ContractEnsuresCondition,
  ContractInvariant,
  ContractValidator,
  ContractCondition,
  SessionProvider,
} from "zerot/core/types";

/**
 * Exports the function to set the global session provider.
 * @module core/types
 */
export { setSessionProvider } from "zerot/core/types";

// Conditions

/**
 * Exports the `auth` condition for authentication and role-based access control.
 * @module conditions/auth
 */
export { auth } from "zerot/conditions/auth";

/**
 * Exports the `owns` condition for checking resource ownership.
 * @module conditions/owns
 */
export { owns } from "zerot/conditions/owns";

/**
 * Exports `validates` for input validation using Zod schemas and `returns` for output validation.
 * @module conditions/validation
 */
export { validates, returns } from "zerot/conditions/validation";

/**
 * Exports the `rateLimit` condition for controlling operation frequency.
 * @module conditions/rate-limit
 */
export { rateLimit } from "zerot/conditions/rate-limit";

/**
 * Exports the `auditLog` condition for logging audit events.
 * @module conditions/audit
 */
export { auditLog } from "zerot/conditions/audit";

/**
 * Exports the `businessRule` condition for custom business logic validation.
 * @module conditions/business-rules
 */
export { businessRule } from "zerot/conditions/business-rules";

// Templates

/**
 * Exports `ContractTemplates` which provides predefined contract configurations for common use cases.
 * @module templates/contract-templates
 */
export { ContractTemplates } from "zerot/templates/contract-templates";

/**
 * Exports `smartContract` for automatically inferring contract conditions based on operation patterns.
 * @module templates/smart-contract
 */
export { smartContract } from "zerot/templates/smart-contract";

// Utils (Debugger, Performance, Optimizer)

/**
 * Exports `ContractDebugger` for logging and reporting contract execution history in development.
 * @module utils/debugger
 */
export { ContractDebugger } from "zerot/utils/debugger";

/**
 * Exports `ContractPerformanceMonitor` for measuring and reporting contract execution performance.
 * @module utils/performance
 */
export { ContractPerformanceMonitor } from "zerot/utils/performance";

/**
 * Exports `OptimizedContractSystem` for advanced contract optimization features.
 * @module utils/optimizer
 */
export { OptimizedContractSystem } from "zerot/utils/optimizer";

// Configuration (No explicit exports from config/index.ts in the provided file, but kept for structure)

// Integrations

/**
 * Exports `createServerAction` for integrating contracts with Next.js Server Actions.
 * @module integrations/server-actions
 */
export { createServerAction } from "zerot/integrations/server-actions";

/**
 * Exports `withContractMiddleware` for integrating contracts with Next.js Middleware.
 * @module integrations/nextjs
 */
export { withContractMiddleware } from "zerot/integrations/nextjs";
