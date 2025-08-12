/**
 * Provides performance monitoring utilities for contract execution.
 * It measures the execution time and success/failure rates of contract methods.
 */
export class ContractPerformanceMonitor {
  private static metrics = new Map<
    string,
    {
      executions: number;
      totalTime: number;
      failures: number;
      avgTime: number;
    }
  >();

  /**
   * Measures the execution time of a given function (typically a contract method).
   * It updates internal metrics based on the success or failure of the function's execution.
   * @template T - The return type of the function being measured.
   * @param contractName - The name of the contract method being measured.
   * @param fn - The function to measure.
   * @returns The result of the executed function.
   */
  static measureContract<T>(
    contractName: string,
    fn: () => Promise<T> | T
  ): Promise<T> | T {
    const start = performance.now();

    const updateMetrics = (success: boolean) => {
      const duration = performance.now() - start;
      const current = this.metrics.get(contractName) || {
        executions: 0,
        totalTime: 0,
        failures: 0,
        avgTime: 0,
      };

      current.executions++;
      current.totalTime += duration;
      if (!success) current.failures++;
      current.avgTime = current.totalTime / current.executions;

      this.metrics.set(contractName, current);
    };

    try {
      const result = fn();

      if (result instanceof Promise) {
        return result
          .then((res) => {
            updateMetrics(true);
            return res;
          })
          .catch((err) => {
            updateMetrics(false);
            throw err;
          });
      }

      updateMetrics(true);
      return result;
    } catch (error) {
      updateMetrics(false);
      throw error;
    }
  }

  /**
   * Generates a performance report summarizing the metrics collected for each contract.
   * The report includes total executions, average time, failure rate, and total time for each contract.
   * @returns A JSON string representing the performance report, sorted by average time in descending order.
   */
  static getPerformanceReport(): string {
    const report = Array.from(this.metrics.entries())
      .map(([name, stats]) => ({
        contract: name,
        executions: stats.executions,
        avgTimeMs: parseFloat(stats.avgTime.toFixed(2)),
        failureRate: `${((stats.failures / stats.executions) * 100).toFixed(
          1
        )}%`,
        totalTimeMs: parseFloat(stats.totalTime.toFixed(2)),
      }))
      .sort((a, b) => b.avgTimeMs - a.avgTimeMs);

    return JSON.stringify(report, null, 2);
  }
}
