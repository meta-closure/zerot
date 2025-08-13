/**
 * Defines the interface for a logger.
 * This interface ensures consistency across different logging implementations.
 */
import { zerotConfig } from "../config";

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
  private log(level: 'debug' | 'info' | 'warn' | 'error', message: string, metadata?: Record<string, any>): void {
    const currentLogLevel = zerotConfig.get('logLevel');
    const levels = {
      'debug': 0,
      'info': 1,
      'warn': 2,
      'error': 3
    };

    if (levels[level] >= levels[currentLogLevel]) {
      const logEntry = {
        timestamp: new Date().toISOString(),
        level: level.toUpperCase(),
        message,
        ...(metadata && Object.keys(metadata).length > 0 && { metadata }),
      };
      console.log(JSON.stringify(logEntry));
    }
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
   * Logs a debug message. This method only logs if `enableDebugMode` is true in config.
   * @param message - The message to log.
   * @param metadata - Optional metadata to include with the log.
   */
  debug(message: string, metadata?: Record<string, any>): void {
    if (zerotConfig.get('enableDebugMode')) {
      this.log("debug", message, metadata);
    }
  }
}

/**
 * The default logger instance, using ConsoleLogger.
 */
export const logger: Logger = new ConsoleLogger();
