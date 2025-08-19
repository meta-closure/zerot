import { ErrorCategory } from "@/core/errors";
import { ResourceProvider, SessionProvider } from "@/core/types";
import { Logger, logger as defaultLogger } from "@/utils/logger";

/**
 * Type-safe log levels
 */
export type LogLevel = "debug" | "info" | "warn" | "error";

/**
 * Environment types
 */
export type Environment = "development" | "production" | "testing";

/**
 * Validation result interface
 */
interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Configuration change event
 */
export interface ConfigChangeEvent {
  key?: keyof ZerotConfig;
  oldValue?: unknown;
  newValue?: unknown;
  timestamp: Date;
}

/**
 * Interface for rate limit storage backends.
 */
export interface RateLimitStore {
  get(key: string): Promise<{ count: number; lastReset: number } | null>;
  set(key: string, value: { count: number; lastReset: number }): Promise<void>;
  increment(key: string): Promise<number>;
  reset(key: string): Promise<void>;
  clear(): Promise<void>;
}

/**
 * Audit event interface
 */
export interface AuditEvent {
  action: string;
  userId: string;
  resourceId: string;
  timestamp: Date;
  input: unknown;
  output: unknown;
  success: boolean;
  metadata?: Record<string, unknown>;
}

/**
 * Interface for audit logging backends.
 */
export interface AuditLogger {
  log(event: AuditEvent): Promise<void>;
}

/**
 * Configuration change listener function
 */
export type ConfigChangeListener = (event: ConfigChangeEvent) => void;

/**
 * Configuration options for the Zerot library.
 * This interface defines all configurable aspects of the contract system.
 */
export interface ZerotConfig {
  // === Global Settings ===
  /**
   * Enable debug mode for additional logging and development features.
   * @default process.env.NODE_ENV === 'development'
   */
  enableDebugMode?: boolean;

  /**
   * Enable performance monitoring for contract executions.
   * @default false
   */
  enablePerformanceMonitoring?: boolean;

  /**
   * Default layer name when none is specified in contract options.
   * @default 'unknown'
   */
  defaultLayer?: string;

  /**
   * Enable strict validation mode (throws on validation warnings).
   * @default true
   */
  enableStrictValidation?: boolean;

  // === Rate Limiting Configuration ===
  /**
   * Default time window for rate limiting in milliseconds.
   * Must be positive.
   * @default 60000 (1 minute)
   */
  defaultRateLimitWindow?: number;

  /**
   * Maximum number of rate limit entries to keep in memory.
   * Should be between 100 and 100000 for optimal performance.
   * @default 10000
   */
  rateLimitMaxEntries?: number;

  /**
   * Custom rate limit storage backend.
   * @default In-memory Map storage
   */
  customRateLimitStore?: RateLimitStore;

  // === Retry Configuration ===
  /**
   * Default number of retry attempts for recoverable errors.
   * Must be non-negative, recommended max: 10
   * @default 0
   */
  defaultRetryAttempts?: number;

  /**
   * Default delay between retry attempts in milliseconds.
   * Must be non-negative, recommended range: 100-5000ms
   * @default 100
   */
  defaultRetryDelayMs?: number;

  /**
   * Error categories that should trigger retries by default.
   * @default [ErrorCategory.NETWORK, ErrorCategory.SYSTEM]
   */
  defaultRetryOnCategories?: ErrorCategory[];

  // === Logging Configuration ===
  /**
   * Minimum log level for contract-related logs.
   * @default 'info'
   */
  logLevel?: LogLevel;

  /**
   * Enable audit logging for contract executions.
   * @default true
   */
  enableAuditLogging?: boolean;

  /**
   * Custom logger instance for contract-related logs.
   * @default ConsoleLogger
   */
  customLogger?: Logger;

  /**
   * Custom audit logger backend.
   * @default Console-based audit logger
   */
  customAuditLogger?: AuditLogger;

  // === Security Configuration ===
  /**
   * Fields to redact from audit logs and error details.
   * @default ['password', 'token', 'secret', 'apiKey', 'privateKey', 'session']
   */
  sensitiveFields?: string[];

  /**
   * Enable automatic input sanitization in audit logs.
   * @default true
   */
  enableInputSanitization?: boolean;

  // === Performance Configuration ===
  /**
   * Maximum execution time for individual conditions (in milliseconds).
   * Must be positive, recommended range: 1000-10000ms
   * @default 5000 (5 seconds)
   */
  maxConditionExecutionTime?: number;

  /**
   * Enable condition result caching.
   * @default false
   */
  enableConditionCaching?: boolean;

  /**
   * Cache TTL for condition results in milliseconds.
   * Must be positive if caching is enabled
   * @default 5000 (5 seconds)
   */
  conditionCacheTtl?: number;

  // === Provider Configuration ===
  /**
   * Session provider function for authentication context.
   */
  sessionProvider?: SessionProvider;

  /**
   * Resource provider function for ownership checks.
   */
  resourceProvider?: ResourceProvider;

  // === Development Configuration ===
  /**
   * Enable contract execution tracing for debugging.
   * @default false
   */
  enableExecutionTracing?: boolean;

  /**
   * Maximum number of execution traces to keep in memory.
   * @default 1000
   */
  maxExecutionTraces?: number;

  /**
   * Enable automatic contract test generation.
   * @default false
   */
  enableAutoTestGeneration?: boolean;
}

/**
 * Default rate limit store implementation using in-memory Map with LRU eviction.
 */
class MemoryRateLimitStore implements RateLimitStore {
  private store = new Map<string, { count: number; lastReset: number }>();
  private accessOrder = new Map<string, number>(); // Track access order for LRU
  private accessCounter = 0;
  private readonly maxEntries: number;

  constructor(maxEntries = 10000) {
    this.maxEntries = Math.max(100, maxEntries); // Minimum 100 entries
  }

  async get(key: string): Promise<{ count: number; lastReset: number } | null> {
    const value = this.store.get(key);
    if (value) {
      this.accessOrder.set(key, ++this.accessCounter);
    }
    return value ?? null;
  }

  async set(
    key: string,
    value: { count: number; lastReset: number }
  ): Promise<void> {
    // LRU eviction if we exceed max entries
    if (this.store.size >= this.maxEntries && !this.store.has(key)) {
      this.evictLRU();
    }

    this.store.set(key, value);
    this.accessOrder.set(key, ++this.accessCounter);
  }

  async increment(key: string): Promise<number> {
    const current = await this.get(key);
    if (current) {
      current.count++;
      await this.set(key, current);
      return current.count;
    } else {
      const newValue = { count: 1, lastReset: Date.now() };
      await this.set(key, newValue);
      return 1;
    }
  }

  async reset(key: string): Promise<void> {
    this.store.delete(key);
    this.accessOrder.delete(key);
  }

  async clear(): Promise<void> {
    this.store.clear();
    this.accessOrder.clear();
    this.accessCounter = 0;
  }

  private evictLRU(): void {
    let oldestKey: string | undefined;
    let oldestAccess = Infinity;

    for (const [key, access] of this.accessOrder) {
      if (access < oldestAccess) {
        oldestAccess = access;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.store.delete(oldestKey);
      this.accessOrder.delete(oldestKey);
    }
  }
}

/**
 * Enhanced audit logger with error handling and formatting.
 */
class ConsoleAuditLogger implements AuditLogger {
  async log(event: AuditEvent): Promise<void> {
    try {
      if (process.env.NODE_ENV === "development") {
        console.log("AUDIT LOG:", JSON.stringify(event, null, 2));
      } else {
        // Production: structured logging
        console.log(
          JSON.stringify({
            timestamp: event.timestamp.toISOString(),
            level: "audit",
            action: event.action,
            userId: event.userId,
            resourceId: event.resourceId,
            success: event.success,
            metadata: event.metadata,
          })
        );
      }
    } catch (error) {
      console.error("Failed to log audit event:", error);
    }
  }
}

/**
 * Enhanced configuration manager with validation and change tracking.
 */
class ZerotConfiguration {
  private static instance: ZerotConfiguration;
  private config: Required<ZerotConfig>;
  private isInitialized = false;
  private changeListeners: Set<ConfigChangeListener> = new Set();

  private constructor() {
    this.config = this.getDefaultConfig();
  }

  /**
   * Get the singleton instance of ZerotConfiguration.
   */
  static getInstance(): ZerotConfiguration {
    if (!ZerotConfiguration.instance) {
      ZerotConfiguration.instance = new ZerotConfiguration();
    }
    return ZerotConfiguration.instance;
  }

  /**
   * Load configuration from environment variables.
   */
  private loadFromEnvironment(): Partial<ZerotConfig> {
    return {
      enableDebugMode: process.env.ZEROT_DEBUG === "true",
      logLevel: this.parseLogLevel(process.env.ZEROT_LOG_LEVEL),
      defaultRetryAttempts: this.parsePositiveInt(
        process.env.ZEROT_RETRY_ATTEMPTS,
        0
      ),
      defaultRateLimitWindow: this.parsePositiveInt(
        process.env.ZEROT_RATE_LIMIT_WINDOW,
        60000
      ),
      enableAuditLogging: process.env.ZEROT_AUDIT_LOGGING !== "false",
    };
  }

  private parseLogLevel(value?: string): LogLevel | undefined {
    if (!value) return undefined;
    const logLevels: LogLevel[] = ["debug", "info", "warn", "error"];
    return logLevels.includes(value as LogLevel)
      ? (value as LogLevel)
      : undefined;
  }

  private parsePositiveInt(
    value?: string,
    defaultValue?: number
  ): number | undefined {
    if (!value) return defaultValue;
    const parsed = parseInt(value, 10);
    return !isNaN(parsed) && parsed >= 0 ? parsed : defaultValue;
  }

  /**
   * Get the default configuration values.
   */
  private getDefaultConfig(): Required<ZerotConfig> {
    const envConfig = this.loadFromEnvironment();

    return {
      // Global settings
      enableDebugMode:
        envConfig.enableDebugMode ?? process.env.NODE_ENV === "development",
      enablePerformanceMonitoring: false,
      defaultLayer: "unknown",
      enableStrictValidation: true,

      // Rate limiting
      defaultRateLimitWindow: envConfig.defaultRateLimitWindow ?? 60000,
      rateLimitMaxEntries: 10000,
      customRateLimitStore: new MemoryRateLimitStore(10000),

      // Retry settings
      defaultRetryAttempts: envConfig.defaultRetryAttempts ?? 0,
      defaultRetryDelayMs: 100,
      defaultRetryOnCategories: [ErrorCategory.NETWORK, ErrorCategory.SYSTEM],

      // Logging
      logLevel: envConfig.logLevel ?? "info",
      enableAuditLogging: envConfig.enableAuditLogging ?? true,
      customLogger: defaultLogger,
      customAuditLogger: new ConsoleAuditLogger(),

      // Security
      sensitiveFields: [
        "password",
        "token",
        "secret",
        "apiKey",
        "privateKey",
        "session",
        "authorization",
        "credential",
        "key",
      ],
      enableInputSanitization: true,

      // Performance
      maxConditionExecutionTime: 5000,
      enableConditionCaching: false,
      conditionCacheTtl: 5000,

      // Providers
      sessionProvider: async () => ({}),
      resourceProvider: async () => null,

      // Development
      enableExecutionTracing: false,
      maxExecutionTraces: 1000,
      enableAutoTestGeneration: false,
    };
  }

  /**
   * Enhanced configuration validation with warnings.
   */
  private validateConfig(config: Partial<ZerotConfig>): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate numeric constraints
    if (
      config.defaultRetryAttempts !== undefined &&
      config.defaultRetryAttempts < 0
    ) {
      errors.push("defaultRetryAttempts must be non-negative");
    }
    if (
      config.defaultRetryAttempts !== undefined &&
      config.defaultRetryAttempts > 10
    ) {
      warnings.push("defaultRetryAttempts > 10 may cause long delays");
    }

    if (
      config.defaultRetryDelayMs !== undefined &&
      config.defaultRetryDelayMs < 0
    ) {
      errors.push("defaultRetryDelayMs must be non-negative");
    }
    if (
      config.defaultRetryDelayMs !== undefined &&
      config.defaultRetryDelayMs > 10000
    ) {
      warnings.push("defaultRetryDelayMs > 10s may cause poor user experience");
    }

    if (
      config.defaultRateLimitWindow !== undefined &&
      config.defaultRateLimitWindow <= 0
    ) {
      errors.push("defaultRateLimitWindow must be positive");
    }

    if (config.rateLimitMaxEntries !== undefined) {
      if (config.rateLimitMaxEntries < 100) {
        warnings.push("rateLimitMaxEntries < 100 may cause frequent evictions");
      }
      if (config.rateLimitMaxEntries > 100000) {
        warnings.push("rateLimitMaxEntries > 100000 may cause memory issues");
      }
    }

    if (
      config.maxConditionExecutionTime !== undefined &&
      config.maxConditionExecutionTime <= 0
    ) {
      errors.push("maxConditionExecutionTime must be positive");
    }

    if (
      config.conditionCacheTtl !== undefined &&
      config.conditionCacheTtl <= 0
    ) {
      errors.push("conditionCacheTtl must be positive");
    }

    // Logical validation
    if (
      config.enableConditionCaching &&
      config.conditionCacheTtl === undefined
    ) {
      warnings.push(
        "enableConditionCaching is true but conditionCacheTtl is not set"
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Configure Zerot with enhanced validation and change tracking.
   */
  configure(config: Partial<ZerotConfig>): void {
    try {
      const validation = this.validateConfig(config);

      if (!validation.isValid) {
        throw new Error(
          `Configuration validation failed: ${validation.errors.join(", ")}`
        );
      }

      if (
        validation.warnings.length > 0 &&
        this.config.enableStrictValidation
      ) {
        throw new Error(
          `Configuration warnings in strict mode: ${validation.warnings.join(", ")}`
        );
      }

      const oldConfig = { ...this.config };
      this.config = { ...this.config, ...config };
      this.isInitialized = true;

      // Notify listeners
      this.notifyConfigChange({
        oldValue: oldConfig,
        newValue: this.config,
        timestamp: new Date(),
      });

      // Log configuration in debug mode
      if (this.config.enableDebugMode) {
        console.log("[Zerot] Configuration applied:", {
          enableDebugMode: this.config.enableDebugMode,
          enablePerformanceMonitoring: this.config.enablePerformanceMonitoring,
          defaultLayer: this.config.defaultLayer,
          enableAuditLogging: this.config.enableAuditLogging,
          logLevel: this.config.logLevel,
          warnings: validation.warnings,
        });
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to configure Zerot: ${errorMessage}`);
    }
  }

  /**
   * Add a configuration change listener.
   */
  addChangeListener(listener: ConfigChangeListener): void {
    this.changeListeners.add(listener);
  }

  /**
   * Remove a configuration change listener.
   */
  removeChangeListener(listener: ConfigChangeListener): void {
    this.changeListeners.delete(listener);
  }

  /**
   * Notify all change listeners.
   */
  private notifyConfigChange(event: ConfigChangeEvent): void {
    for (const listener of this.changeListeners) {
      try {
        listener(event);
      } catch (error) {
        console.error("Error in config change listener:", error);
      }
    }
  }

  /**
   * Get a configuration value by key.
   */
  get<K extends keyof ZerotConfig>(key: K): Required<ZerotConfig>[K] {
    return this.config[key];
  }

  /**
   * Get all configuration values.
   */
  getAll(): Required<ZerotConfig> {
    return { ...this.config };
  }

  /**
   * Check if Zerot has been configured.
   */
  isConfigured(): boolean {
    return this.isInitialized;
  }

  /**
   * Reset configuration to defaults.
   */
  reset(): void {
    const oldConfig = { ...this.config };
    this.config = this.getDefaultConfig();
    this.isInitialized = false;
    this.notifyConfigChange({
      oldValue: oldConfig,
      newValue: this.config,
      timestamp: new Date(),
    });
  }

  /**
   * Update a specific configuration value at runtime with validation.
   */
  set<K extends keyof ZerotConfig>(
    key: K,
    value: Required<ZerotConfig>[K]
  ): void {
    const partialConfig = { [key]: value } as Partial<ZerotConfig>;
    const validation = this.validateConfig(partialConfig);

    if (!validation.isValid) {
      throw new Error(
        `Invalid value for ${String(key)}: ${validation.errors.join(", ")}`
      );
    }

    const oldValue = this.config[key];
    this.config[key] = value;

    this.notifyConfigChange({
      key,
      oldValue,
      newValue: value,
      timestamp: new Date(),
    });
  }

  /**
   * Get configuration validation status.
   */
  validate(): ValidationResult {
    return this.validateConfig(this.config);
  }
}

// Export instances and functions (same as before)
export const zerotConfig = ZerotConfiguration.getInstance();

export function configureZerot(config: ZerotConfig): void {
  zerotConfig.configure(config);
}

export function getZerotConfig(): Required<ZerotConfig> {
  return zerotConfig.getAll();
}

export function isZerotConfigured(): boolean {
  return zerotConfig.isConfigured();
}

// Enhanced presets with better defaults
export const ZerotPresets = {
  development: (): ZerotConfig => ({
    enableDebugMode: true,
    enablePerformanceMonitoring: true,
    enableExecutionTracing: true,
    logLevel: "debug",
    enableAuditLogging: true,
    defaultRetryAttempts: 1,
    enableConditionCaching: false,
    enableStrictValidation: false, // Allow warnings in dev
  }),

  production: (): ZerotConfig => ({
    enableDebugMode: false,
    enablePerformanceMonitoring: true,
    enableExecutionTracing: false,
    logLevel: "warn",
    enableAuditLogging: true,
    defaultRetryAttempts: 3,
    enableConditionCaching: true,
    conditionCacheTtl: 10000,
    enableStrictValidation: true,
  }),

  testing: (): ZerotConfig => ({
    enableDebugMode: false,
    enablePerformanceMonitoring: false,
    enableExecutionTracing: false,
    logLevel: "error",
    enableAuditLogging: false,
    defaultRetryAttempts: 0,
    enableConditionCaching: false,
    defaultRateLimitWindow: 1000,
    enableStrictValidation: true,
  }),

  secure: (): ZerotConfig => ({
    enableStrictValidation: true,
    enableInputSanitization: true,
    sensitiveFields: [
      "password",
      "token",
      "secret",
      "apiKey",
      "privateKey",
      "session",
      "authorization",
      "credential",
      "key",
      "oauth",
      "jwt",
      "bearer",
    ],
    enableAuditLogging: true,
    maxConditionExecutionTime: 3000,
    defaultRetryAttempts: 1, // Fewer retries for security
  }),
};
