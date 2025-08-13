import { logger } from "~/utils/logger";
import { ContractViolationError } from "~/core/errors";

/**
 * Provides debugging utilities for contract execution.
 * It logs contract execution history and provides a summary report.
 * This class is primarily intended for use in development environments.
 */
export class ContractDebugger {
  private static contractHistory: Array<{
    contractName: string;
    layer: string;
    timestamp: Date;
    input: any;
    output?: any;
    status: "success" | "failure";
    error?: any;
  }> = [];

  /**
   * Logs the execution of a contract method.
   * This method is active only in development environments.
   * @param contractName - The full name of the contract method (e.g., "UserService.createUser").
   * @param layer - The layer of the application where the contract is applied.
   * @param input - The input arguments passed to the contract method.
   * @param output - The output returned by the contract method (if successful).
   * @param error - Any error that occurred during contract execution (if failed).
   */
  static logContractExecution(
    contractName: string,
    layer: string,
    input: any,
    output?: any,
    error?: any
  ) {
    this.contractHistory.push({
      contractName,
      layer,
      timestamp: new Date(),
      input: this.sanitizeForLog(input),
      output: this.sanitizeForLog(output),
      status: error ? "failure" : "success",
      error,
    });

    const metadata = {
      layer,
      input: this.sanitizeForLog(input),
      ...(output && { output: this.sanitizeForLog(output) }),
      ...(error && { error: error.message }),
    };

    if (error) {
      logger.error(`Contract [${layer}] ${contractName} failed`, metadata);
    } else {
      logger.debug(`Contract [${layer}] ${contractName} executed`, metadata);
    }
  }

  /**
   * Generates a report summarizing the contract execution history.
   * This report includes total executions, success/failure counts, success rate, and stats per layer.
   * @returns A JSON string representing the contract execution report.
   */
  static getContractReport(): string {
    const successCount = this.contractHistory.filter(
      (h) => h.status === "success"
    ).length;
    const failureCount = this.contractHistory.filter(
      (h) => h.status === "failure"
    ).length;

    const layerStats = this.contractHistory.reduce((acc, h) => {
      acc[h.layer] = acc[h.layer] || { success: 0, failure: 0 };
      acc[h.layer][h.status]++;
      return acc;
    }, {} as Record<string, { success: number; failure: number }>);

    return JSON.stringify(
      {
        total: this.contractHistory.length,
        success: successCount,
        failure: failureCount,
        successRate: `${(
          (successCount / this.contractHistory.length) *
          100
        ).toFixed(1)}%`,
        layerStats,
      },
      null,
      2
    );
  }

  /**
   * Sanitizes data by removing sensitive information before logging.
   * @param data - The data to sanitize.
   * @returns The sanitized data.
   */
  private static sanitizeForLog(data: any): any {
    if (typeof data !== "object" || data === null) {
      return data;
    }

    const sanitized = { ...data };
    // Exclude sensitive information
    delete sanitized.password;
    delete sanitized.token;
    delete sanitized.secret;

    return sanitized;
  }
}

// Global contract monitor for development environment
if (typeof window !== "undefined") {
  (window as any).__contractDebugger = ContractDebugger;
}
