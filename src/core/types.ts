import { z } from "zod";

/**
 * Defines a contract condition function.
 * @param input - The input to the method.
 * @param context - The authentication context.
 * @returns A boolean indicating if the condition passes, or a Promise resolving to a boolean.
 */
export type ContractCondition = (
  input: any,
  context: any
) => boolean | Promise<boolean>;

/**
 * Defines a contract validator function.
 * Validators can transform the input.
 * @param input - The input to be validated and potentially transformed.
 * @returns The transformed input.
 */
export type ContractValidator = ((input: unknown) => any) & { isValidator?: boolean };

/**
 * Defines a contract ensures condition function (post-condition).
 * @param output - The output of the method.
 * @param input - The original input to the method.
 * @param context - The authentication context.
 * @returns A boolean indicating if the condition passes, or a Promise resolving to a boolean.
 */
export type ContractEnsuresCondition = (
  output: any,
  input: any,
  context: any
) => boolean | Promise<boolean>;

/**
 * Defines a contract invariant condition function.
 * Invariants check conditions that must hold true before and after method execution.
 * @param input - The input to the method.
 * @param output - The output of the method.
 * @returns A boolean indicating if the invariant holds true.
 */
export type ContractInvariant = (input: any, output: any) => boolean;

/**
 * Options for the `@contract` decorator.
 */
export interface ContractOptions {
  /**
   * An array of pre-conditions that must pass before the method executes.
   */
  requires?: Array<ContractCondition | ContractValidator>;
  /**
   * An array of post-conditions that must pass after the method executes successfully.
   */
  ensures?: Array<ContractEnsuresCondition>;
  /**
   * An array of invariant conditions that must hold true before and after method execution.
   */
  invariants?: Array<ContractInvariant>;
  /**
   * The layer of the application where the contract is applied (e.g., "business", "data").
   */
  layer?: "presentation" | "action" | "business" | "data" | "unknown" | "test";
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
    roles: string[];
    [key: string]: any; // Allows for extension with custom user data
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
export type SessionProvider = () => Promise<AuthContext> | AuthContext;

/**
 * Internal variable to hold the session provider instance.
 */
let _sessionProvider: SessionProvider | undefined;

/**
 * Sets the global session provider.
 * This function should be called once at the application's entry point to configure
 * how the authentication context is retrieved.
 * @param provider - The function that provides the authentication context.
 */
export function setSessionProvider(provider: SessionProvider) {
  _sessionProvider = provider;
}

/**
 * Retrieves the current authentication context.
 * If a session provider is set, it will be used to get the context.
 * Otherwise, an empty context is returned, allowing authentication conditions to handle it.
 * @returns A Promise that resolves to the authentication context.
 */
export async function getAuthContext(): Promise<AuthContext> {
  if (!_sessionProvider) {
    // Return an empty context by default, allowing authentication conditions to check for it.
    return {};
  }
  return await _sessionProvider();
}
