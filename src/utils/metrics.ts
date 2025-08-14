/**
 * Defines the structure for a single metric entry.
 */
interface MetricEntry {
  value: number;
  timestamp: number;
  labels?: Record<string, string>;
}

/**
 * A generic metrics collection utility.
 * It provides methods to increment counters, record values, and generate reports.
 */
export class Metrics {
  private static metrics = new Map<
    string,
    {
      type: "counter" | "gauge" | "histogram";
      data: MetricEntry[];
    }
  >();

  /**
   * Increments a counter metric.
   * @param name - The name of the counter.
   * @param labels - Optional labels to associate with this metric.
   */
  static increment(name: string, labels?: Record<string, string>): void {
    this.ensureMetric(name, "counter");
    const metric = this.metrics.get(name)!;
    const currentValue =
      metric.data.length > 0 ? metric.data[metric.data.length - 1].value : 0;
    metric.data.push({
      value: currentValue + 1,
      timestamp: performance.now(),
      labels,
    });
  }

  /**
   * Sets a gauge metric to a specific value.
   * @param name - The name of the gauge.
   * @param value - The value to set the gauge to.
   * @param labels - Optional labels to associate with this metric.
   */
  static gauge(
    name: string,
    value: number,
    labels?: Record<string, string>
  ): void {
    this.ensureMetric(name, "gauge");
    const metric = this.metrics.get(name)!;
    metric.data.push({ value, timestamp: performance.now(), labels });
  }

  /**
   * Records a value for a histogram metric (e.g., duration).
   * @param name - The name of the histogram.
   * @param value - The value to record.
   * @param labels - Optional labels to associate with this metric.
   */
  static record(
    name: string,
    value: number,
    labels?: Record<string, string>
  ): void {
    this.ensureMetric(name, "histogram");
    const metric = this.metrics.get(name)!;
    metric.data.push({ value, timestamp: performance.now(), labels });
  }

  /**
   * Ensures a metric exists in the map with the specified type.
   * @param name - The name of the metric.
   * @param type - The type of the metric ('counter', 'gauge', 'histogram').
   * @private
   */
  private static ensureMetric(
    name: string,
    type: "counter" | "gauge" | "histogram"
  ): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, { type, data: [] });
    } else if (this.metrics.get(name)!.type !== type) {
      console.warn(
        `Metric '${name}' already exists with type '${this.metrics.get(name)!.type}'. Cannot re-register with type '${type}'.`
      );
    }
  }

  /**
   * Generates a report for all collected metrics.
   * @returns A JSON string representing the metrics report.
   */
  static getReport(): string {
    const report: Record<string, any> = {};
    this.metrics.forEach((metric, name) => {
      if (metric.type === "counter") {
        report[name] = {
          type: "counter",
          total:
            metric.data.length > 0
              ? metric.data[metric.data.length - 1].value
              : 0,
          entries: metric.data.map((d) => ({
            value: d.value,
            timestamp: d.timestamp,
            labels: d.labels,
          })),
        };
      } else if (metric.type === "gauge") {
        report[name] = {
          type: "gauge",
          current:
            metric.data.length > 0
              ? metric.data[metric.data.length - 1].value
              : undefined,
          entries: metric.data.map((d) => ({
            value: d.value,
            timestamp: d.timestamp,
            labels: d.labels,
          })),
        };
      } else if (metric.type === "histogram") {
        const values = metric.data.map((d) => d.value);
        const sum = values.reduce((a, b) => a + b, 0);
        const count = values.length;
        const avg = count > 0 ? sum / count : 0;
        report[name] = {
          type: "histogram",
          count,
          sum: parseFloat(sum.toFixed(2)),
          avg: parseFloat(avg.toFixed(2)),
          min:
            count > 0 ? parseFloat(Math.min(...values).toFixed(2)) : undefined,
          max:
            count > 0 ? parseFloat(Math.max(...values).toFixed(2)) : undefined,
          entries: metric.data.map((d) => ({
            value: d.value,
            timestamp: d.timestamp,
            labels: d.labels,
          })),
        };
      }
    });

    return JSON.stringify(report, null, 2);
  }

  /**
   * Clears all collected metrics.
   */
  static clear(): void {
    this.metrics.clear();
  }
}
