import { ContractOptions } from "../core/types";
import { z } from "zod";

/**
 * Provides optimization utilities for the contract system.
 * This class aims to improve performance by caching compiled contracts and validation schemas,
 * and by separating static and dynamic checks for more efficient execution.
 */
export class OptimizedContractSystem {
  private static contractCache = new Map<string, Function>();
  private static conditionCache = new Map<string, any>();

  /**
   * Compiles and caches a contract based on its options.
   * If the contract has already been compiled and cached, the cached version is returned.
   * This helps in avoiding redundant compilation and optimization.
   * @param contractName - A unique name for the contract to be compiled.
   * @param options - The `ContractOptions` defining the contract's conditions.
   * @returns A compiled and optimized function representing the contract.
   */
  static compileContract(
    contractName: string,
    options: ContractOptions
  ): Function {
    if (this.contractCache.has(contractName)) {
      return this.contractCache.get(contractName)!;
    }

    const compiledContract = this.optimizeContract(options);
    this.contractCache.set(contractName, compiledContract);

    return compiledContract;
  }

  /**
   * Optimizes a contract by separating its conditions into static and dynamic checks.
   * Static checks can be performed synchronously, while dynamic checks (e.g., async operations)
   * are executed at runtime.
   * @param options - The `ContractOptions` to optimize.
   * @returns An optimized function that executes the contract's conditions.
   */
  private static optimizeContract(options: ContractOptions): Function {
    // Separate static and dynamic checks
    const staticChecks = this.extractStaticChecks(options.requires || []);
    const dynamicChecks = this.extractDynamicChecks(options.requires || []);

    return async (input: any, context: any) => {
      // Static checks are executed synchronously (at compile time conceptually)
      for (const check of staticChecks) {
        check(input, context);
      }

      // Only dynamic checks are executed at runtime
      for (const check of dynamicChecks) {
        await check(input, context);
      }
    };
  }

  /**
   * Caches and retrieves compiled validation schemas.
   * This prevents re-compilation of Zod schemas for repeated validations.
   * @param schemaKey - A unique key for the schema to be cached.
   * @param schema - The Zod schema to cache.
   * @returns The cached and bound `parse` function of the Zod schema.
   */
  static getCachedValidation(schemaKey: string, schema: z.ZodSchema) {
    if (!this.conditionCache.has(schemaKey)) {
      const compiledSchema = schema.parse.bind(schema);
      this.conditionCache.set(schemaKey, compiledSchema);
    }

    return this.conditionCache.get(schemaKey);
  }

  /**
   * Extracts static (synchronously evaluable) conditions from a list of conditions.
   * Conditions are considered static if they do not contain `await` and operate directly on `input`.
   * @param conditions - An array of contract conditions.
   * @returns An array of static condition functions.
   */
  private static extractStaticChecks(conditions: any[]): Function[] {
    return conditions.filter(
      (c) =>
        // Conditions that can be evaluated statically
        typeof c === "function" &&
        c.toString().includes("input.") &&
        !c.toString().includes("await")
    );
  }

  /**
   * Extracts dynamic (asynchronously evaluable) conditions from a list of conditions.
   * Conditions are considered dynamic if they contain `await` or are declared as `async`.
   * @param conditions - An array of contract conditions.
   * @returns An array of dynamic condition functions.
   */
  private static extractDynamicChecks(conditions: any[]): Function[] {
    return conditions.filter(
      (c) =>
        // Conditions that require dynamic evaluation
        typeof c === "function" &&
        (c.toString().includes("await") || c.toString().includes("async"))
    );
  }
}
