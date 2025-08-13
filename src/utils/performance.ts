import { Metrics } from "~/utils/metrics";

/**
 * Provides performance monitoring utilities for contract execution.
 * It measures the execution time and success/failure rates of contract methods.
 */
export class ContractPerformanceMonitor {
  /**
   * Measures the execution time of a given function (typically a contract method).
   * It updates internal metrics based on the success or failure of the function's execution.
   *
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

    const recordMetrics = (success: boolean) => {
      const duration = performance.now() - start;
      Metrics.record(`contract_execution_time_${contractName}`, duration, { success: String(success) });
      Metrics.increment(`contract_executions_${contractName}`, { success: String(success) });
      if (!success) {
        Metrics.increment(`contract_failures_${contractName}`);
      }
    };

    try {
      const result = fn();

      if (result instanceof Promise) {
        return result
          .then((res) => {
            recordMetrics(true);
            return res;
          })
          .catch((err) => {
            recordMetrics(false);
            throw err;
          });
      }

      recordMetrics(true);
      return result;
    } catch (error) {
      recordMetrics(false);
      throw error;
    }
  }

  /**
   * Generates a performance report summarizing the metrics collected for each contract.
   * @returns A JSON string representing the performance report, sorted by average time in descending order.
   */
  static getPerformanceReport(): string {
    const rawReport = JSON.parse(Metrics.getReport());
    const performanceReport: any[] = [];

    for (const key in rawReport) {
      if (key.startsWith('contract_execution_time_')) {
        const contractName = key.replace('contract_execution_time_', '');
        const executionTimeStats = rawReport[key];
        const executionCountMetric = rawReport[`contract_executions_${contractName}`];
        const failureCountMetric = rawReport[`contract_failures_${contractName}`];

        if (executionTimeStats && executionCountMetric) {
          const executions = executionCountMetric.total || 0;
          const failures = failureCountMetric ? failureCountMetric.total : 0;
          const totalTime = executionTimeStats.sum || 0;
          const avgTime = executionTimeStats.avg || 0;
          const failureRate = executions > 0 ? ((failures / executions) * 100).toFixed(1) : '0.0';

          performanceReport.push({
            contract: contractName,
            executions: executions,
            avgTimeMs: parseFloat(avgTime.toFixed(2)),
            failureRate: `${failureRate}%`,
            totalTimeMs: parseFloat(totalTime.toFixed(2)),
          });
        }
      }
    }

    performanceReport.sort((a, b) => b.avgTimeMs - a.avgTimeMs);

    return JSON.stringify(performanceReport, null, 2);
  }
}
