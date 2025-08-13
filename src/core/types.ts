import { z } from "zod";
import { ContractError, ErrorCategory } from "./errors";

/**
 * Type guard to check if a condition is a validator.
 * Validators have an `isValidator` property set to true and can transform input.
 * @template TInput - The expected type of the input to the method.
 * @template TContext - The expected type of the authentication context.
 * @param condition - The condition to check.
 * @returns true if the condition is a validator, false otherwise.
 */
export function isValidator<TInput = any, TContext = any>(
  condition: ContractCondition<TInput, TContext> | ContractValidator<TInput, any>
): condition is ContractValidator<TInput, any> {
  return typeof condition === 'function' && 
         'isValidator' in condition && 
         condition.isValidator === true;
}

/**
 * Defines a contract condition function.
 * @template TInput - The expected type of the input to the method.
 * @template TContext - The expected type of the authentication context.
 * @param input - The input to the method.
 * @param context - The authentication context.
 * @returns A boolean indicating if the condition passes, or a Promise resolving to a boolean, or a ContractError/Promise of ContractError if the condition fails with a specific error.
 */
export type ContractCondition<TInput = any, TContext = any> = (
  input: TInput,
  context: TContext
) => boolean | Promise<boolean> | ContractError | Promise<ContractError>;

/**
 * Defines a contract validator function.
 * Validators can transform the input.
 * Note: Validators are expected to throw ContractError on failure, not return it.
 * @template TInput - The expected type of the input to be validated.
 * @template TOutput - The expected type of the transformed output.
 * @param input - The input to be validated and potentially transformed.
 * @returns The transformed input.
 */
export type ContractValidator<TInput = unknown, TOutput = any> = ((input: TInput) => TOutput) & { isValidator?: boolean };

/**
 * Defines a contract ensures condition function (post-condition).
 * @template TOutput - The expected type of the output of the method.
 * @template TInput - The expected type of the original input to the method.
 * @template TContext - The expected type of the authentication context.
 * @param output - The output of the method.
 * @param input - The original input to the method.
 * @param context - The authentication context.
 * @returns A boolean indicating if the condition passes, or a Promise resolving to a boolean, or a ContractError/Promise of ContractError if the condition fails with a specific error.
 */
export type ContractEnsuresCondition<TOutput = any, TInput = any, TContext = any> = (
  output: TOutput,
  input: TInput,
  context: TContext
) => boolean | Promise<boolean> | ContractError | Promise<ContractError>;

/**
 * Defines a contract invariant condition function.
 * Invariants check conditions that must hold true both before and after method execution.
 * @template TInput - The expected type of the input to the method.
 * @template TOutput - The expected type of the output of the method.
 * @param input - The input to the method.
 * @param output - The output of the method.
 * @returns A boolean indicating if the invariant holds true, or a Promise resolving to a boolean, or a ContractError/Promise of ContractError if it fails.
 */
export type ContractInvariant<TInput = any, TOutput = any> = (
  input: TInput,
  output: TOutput
) => boolean | Promise<boolean> | ContractError | Promise<ContractError>;

/**
 * Options for the `@contract` decorator.
 * @template TInput - The expected type of the input to the method.
 * @template TOutput - The expected type of the output of the method.
 * @template TContext - The expected type of the authentication context.
 */
export interface ContractOptions<TInput = any, TOutput = any, TContext = AuthContext> {
  /**
   * An array of pre-conditions that must pass before the method executes.
   */
  requires?: Array<ContractCondition<TInput, TContext> | ContractValidator<TInput, any>>;
  /**
   * An array of post-conditions that must pass after the method executes successfully.
   */
  ensures?: Array<ContractEnsuresCondition<TOutput, TInput, TContext>>;
  /**
   * An array of invariant conditions that must hold true before and after method execution.
   */
  invariants?: Array<ContractInvariant<TInput, TOutput>>;
  /**
   * The layer of the application where the contract is applied (e.g., "presentation", "action", "business", "data", "unknown", "test").
   */
  layer?: "presentation" | "action" | "business" | "data" | "unknown" | "test";

  /**
   * The maximum number of retry attempts for recoverable errors. Defaults to 0 (no retries).
   */
  retryAttempts?: number;

  /**
   * The delay in milliseconds between retry attempts. Defaults to 100ms.
   */
  retryDelayMs?: number;

  /**
   * An array of ErrorCategory values that should trigger a retry.
   * If not provided, it will retry on errors where `isRecoverable` is true.
   */
  retryOnCategories?: ErrorCategory[];
}

/**
 * Generic authentication context type.
 * Provides information about the authenticated user and session.
 */
export interface AuthContext {
  /**
   * User information, if authenticated.
   */
  user?: {
    id: string;
    [key: string]: any; // Allows for extension with custom user data including roles
  };
  /**
   * Session information, if available.
   */
  session?: {
    id: string;
    expiresAt: Date;
    [key: string]: any; // Allows for extension with custom session data
  };
  /**
   * Allows for custom data to be added to the context.
   */
  [key: string]: any;
}

/**
 * Abstract type for a session provider function.
 * This function is responsible for retrieving the authentication context.
 */
export type SessionProvider = () => Promise<AuthContext> | AuthContext | null | undefined;

/**
 * Abstract type for a resource provider function.
 * This function is responsible for retrieving a resource by its ID.
 */
export type ResourceProvider = (resourceId: string) => Promise<{ id: string; userId: string } | null>;

/**
 * Internal variable to hold the session provider instance.
 */
let _sessionProvider: SessionProvider | undefined;

/**
 * Internal variable to hold the resource provider instance.
 */
let _resourceProvider: ResourceProvider | undefined;

/**
 * Sets the global session provider.
 * This function should be called once at the application's entry point to configure
 * how the authentication context is retrieved.
 * @param provider - The function that provides the authentication context.
 */
export function setSessionProvider(provider: SessionProvider | undefined) {
  _sessionProvider = provider;
}

/**
 * Sets the global resource provider.
 * This function should be called once at the application's entry point to configure
 * how resources are retrieved for ownership checks.
 * @param provider - The function that provides resource details by ID.
 */
export function setResourceProvider(provider: ResourceProvider) {
  _resourceProvider = provider;
}

/**
 * Retrieves the current authentication context.
 * If a session provider is set, it will be used to get the context.
 * Otherwise, an empty context is returned, allowing authentication conditions to handle it.
 * Handles errors gracefully by returning an empty context.
 * @returns A Promise that resolves to the authentication context.
 */
export async function getAuthContext(): Promise<AuthContext> {
  if (!_sessionProvider) {
    // Return an empty context by default, allowing authentication conditions to check for it.
    return {};
  }

  try {
    const result = await _sessionProvider();
    
    // Handle null or undefined results by returning empty context
    if (result == null) {
      return {};
    }
    
    return result;
  } catch (error) {
    // Return empty context on any error (synchronous or asynchronous)
    return {};
  }
}

/**
 * Retrieves a resource using the configured resource provider.
 * @param resourceId - The ID of the resource to retrieve.
 * @returns A Promise that resolves to the resource object or null if not found.
 * @throws {Error} If no resource provider has been set.
 */
export async function getResource(resourceId: string): Promise<{ id: string; userId: string } | null> {
  if (!_resourceProvider) {
    throw new Error("Resource provider not set. Call setResourceProvider to configure how resources are retrieved.");
  }
  return await _resourceProvider(resourceId);
}
