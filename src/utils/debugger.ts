import { logger } from "@/utils/logger";

/**
 * Supported contract execution layers
 */
type ContractLayer =
  | "controller"
  | "service"
  | "repository"
  | "middleware"
  | "validator";

/**
 * Status of contract execution
 */
type ExecutionStatus = "success" | "failure";

/**
 * Sensitive field names that should be excluded from logs
 */
type SensitiveField = "password" | "token" | "secret" | "apiKey" | "privateKey";

/**
 * Contract execution history entry
 */
interface ContractExecution<TInput = unknown, TOutput = unknown> {
  contractName: string;
  layer: ContractLayer;
  timestamp: Date;
  input: TInput;
  output?: TOutput;
  status: ExecutionStatus;
  error?: Error;
}

/**
 * Layer statistics for contract executions
 */
interface LayerStats {
  success: number;
  failure: number;
}

/**
 * Contract execution report
 */
interface ContractReport {
  total: number;
  success: number;
  failure: number;
  successRate: string;
  layerStats: Record<ContractLayer, LayerStats>;
}

/**
 * Global window extensions for development
 */
declare global {
  interface Window {
    __contractDebugger?: typeof ContractDebugger;
  }
}

/**
 * Provides debugging utilities for contract execution.
 * It logs contract execution history and provides a summary report.
 * This class is primarily intended for use in development environments.
 */
export class ContractDebugger {
  private static contractHistory: Array<ContractExecution> = [];

  /**
   * Logs the execution of a contract method.
   * This method is active only in development environments.
   * @param contractName - The full name of the contract method (e.g., "UserService.createUser").
   * @param layer - The layer of the application where the contract is applied.
   * @param input - The input arguments passed to the contract method.
   * @param output - The output returned by the contract method (if successful).
   * @param error - Any error that occurred during contract execution (if failed).
   */
  static logContractExecution<TInput = unknown, TOutput = unknown>(
    contractName: string,
    layer: ContractLayer,
    input: TInput,
    output?: TOutput,
    error?: Error
  ): void {
    const execution: ContractExecution<TInput, TOutput> = {
      contractName,
      layer,
      timestamp: new Date(),
      input: this.sanitizeForLog(input),
      output: output ? this.sanitizeForLog(output) : undefined,
      status: error ? "failure" : "success",
      error,
    };

    this.contractHistory.push(execution);

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

    const layerStats = this.contractHistory.reduce(
      (acc, h) => {
        if (!acc[h.layer]) {
          acc[h.layer] = { success: 0, failure: 0 };
        }
        acc[h.layer][h.status]++;
        return acc;
      },
      {} as Record<ContractLayer, LayerStats>
    );

    const report: ContractReport = {
      total: this.contractHistory.length,
      success: successCount,
      failure: failureCount,
      successRate:
        this.contractHistory.length > 0
          ? `${((successCount / this.contractHistory.length) * 100).toFixed(1)}%`
          : "0.0%",
      layerStats,
    };

    return JSON.stringify(report, null, 2);
  }

  /**
   * Gets the raw contract execution history
   * @returns Array of contract executions
   */
  static getHistory(): ReadonlyArray<ContractExecution> {
    return [...this.contractHistory];
  }

  /**
   * Clears the contract execution history
   */
  static clearHistory(): void {
    this.contractHistory = [];
  }

  /**
   * Gets contract executions filtered by layer
   * @param layer - The layer to filter by
   * @returns Array of contract executions for the specified layer
   */
  static getHistoryByLayer(
    layer: ContractLayer
  ): ReadonlyArray<ContractExecution> {
    return this.contractHistory.filter((h) => h.layer === layer);
  }

  /**
   * Gets contract executions filtered by status
   * @param status - The status to filter by
   * @returns Array of contract executions with the specified status
   */
  static getHistoryByStatus(
    status: ExecutionStatus
  ): ReadonlyArray<ContractExecution> {
    return this.contractHistory.filter((h) => h.status === status);
  }

  /**
   * Sanitizes data by removing sensitive information before logging.
   * @param data - The data to sanitize.
   * @returns The sanitized data.
   */
  private static sanitizeForLog<T>(data: T): T {
    if (typeof data !== "object" || data === null) {
      return data;
    }

    if (Array.isArray(data)) {
      return data.map((item) => this.sanitizeForLog(item)) as T;
    }

    // Type guard to check if the object has string keys
    if (this.isRecord(data)) {
      const sanitized: Record<string, unknown> = {};

      for (const [key, value] of Object.entries(data)) {
        if (this.isSensitiveField(key)) {
          sanitized[key] = "[REDACTED]";
        } else if (typeof value === "object" && value !== null) {
          sanitized[key] = this.sanitizeForLog(value);
        } else {
          sanitized[key] = value;
        }
      }

      return sanitized as T;
    }

    return data;
  }

  /**
   * Type guard to check if a value is a record (object with string keys)
   */
  private static isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }

  /**
   * Type guard to check if a field name is sensitive
   */
  private static isSensitiveField(
    fieldName: string
  ): fieldName is SensitiveField {
    const sensitiveFields: SensitiveField[] = [
      "password",
      "token",
      "secret",
      "apiKey",
      "privateKey",
    ];
    return sensitiveFields.includes(fieldName as SensitiveField);
  }
}

// Global contract monitor for development environment
if (typeof window !== "undefined") {
  window.__contractDebugger = ContractDebugger;
}
