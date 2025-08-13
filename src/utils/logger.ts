/**
 * Defines the interface for a logger.
 * This interface ensures consistency across different logging implementations.
 */
export interface Logger {
  /**
   * Logs an informational message.
   * @param message - The message to log.
   * @param metadata - Optional metadata to include with the log.
   */
  info(message: string, metadata?: Record<string, any>): void;
  /**
   * Logs a warning message.
   * @param message - The message to log.
   * @param metadata - Optional metadata to include with the log.
   */
  warn(message: string, metadata?: Record<string, any>): void;
  /**
   * Logs an error message.
   * @param message - The message to log.
   * @param metadata - Optional metadata to include with the log.
   */
  error(message: string, metadata?: Record<string, any>): void;
  /**
   * Logs a debug message. This is typically only active in development environments.
   * @param message - The message to log.
   * @param metadata - Optional metadata to include with the log.
   */
  debug(message: string, metadata?: Record<string, any>): void;
}

/**
 * A concrete implementation of the Logger interface that logs messages to the console.
 * Log entries are formatted as JSON strings.
 */
class ConsoleLogger implements Logger {
  /**
   * Internal helper method to format and log messages.
   * @param level - The log level (e.g., "info", "warn", "error", "debug").
   * @param message - The message to log.
   * @param metadata - Optional metadata to include with the log.
   */
  private log(level: string, message: string, metadata?: Record<string, any>): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: level.toUpperCase(),
      message,
      ...(metadata && Object.keys(metadata).length > 0 && { metadata }),
    };
    console.log(JSON.stringify(logEntry));
  }

  /**
   * Logs an informational message.
   * @param message - The message to log.
   * @param metadata - Optional metadata to include with the log.
   */
  info(message: string, metadata?: Record<string, any>): void {
    this.log("info", message, metadata);
  }

  /**
   * Logs a warning message.
   * @param message - The message to log.
   * @param metadata - Optional metadata to include with the log.
   */
  warn(message: string, metadata?: Record<string, any>): void {
    this.log("warn", message, metadata);
  }

  /**
   * Logs an error message.
   * @param message - The message to log.
   * @param metadata - Optional metadata to include with the log.
   */
  error(message: string, metadata?: Record<string, any>): void {
    this.log("error", message, metadata);
  }

  /**
   * Logs a debug message. This method only logs if `process.env.NODE_ENV` is "development".
   * @param message - The message to log.
   * @param metadata - Optional metadata to include with the log.
   */
  debug(message: string, metadata?: Record<string, any>): void {
    if (process.env.NODE_ENV === "development") {
      this.log("debug", message, metadata);
    }
  }
}

/**
 * The default logger instance, using ConsoleLogger.
 */
export const logger: Logger = new ConsoleLogger();
