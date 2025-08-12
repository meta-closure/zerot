export { contract } from "./core/contract";
export { ContractError, ContractViolationError } from "./core/errors";
export type {
  AuthContext,
  ContractOptions,
  ContractEnsuresCondition,
  ContractInvariant,
  ContractValidator,
  ContractCondition,
  SessionProvider,
} from "./core/types";
export { setSessionProvider } from "./core/types";

// Conditions
export { auth } from "./conditions/auth";
export { owns } from "./conditions/owns";
export { validates, returns } from "./conditions/validation";
export { rateLimit } from "./conditions/rate-limit";
export { auditLog } from "./conditions/audit";
export { businessRule } from "./conditions/business-rules";

// Templates
export { ContractTemplates } from "./templates/contract-templates";
export { smartContract } from "./templates/smart-contract";

// Utils (Debugger, Performance, Optimizer)
export { ContractDebugger } from "./utils/debugger";
export { ContractPerformanceMonitor } from "./utils/performance";
export { OptimizedContractSystem } from "./utils/optimizer";

// Integrations
export { createServerAction } from "./integrations/server-actions";
export { withContractMiddleware } from "./integrations/nextjs";
