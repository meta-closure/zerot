// src/config/index.ts

import { 
    SessionProvider, 
    ResourceProvider, 
    setSessionProvider, 
    setResourceProvider 
  } from "zerot/core/types";
import { ErrorCategory } from "zerot/core/errors";
import { Logger, logger as defaultLogger } from "zerot/utils/logger";

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
   * Interface for audit logging backends.
   */
  export interface AuditLogger {
    log(event: {
      action: string;
      userId: string;
      resourceId: string;
      timestamp: Date;
      input: any;
      output: any;
      success: boolean;
      metadata?: Record<string, any>;
    }): Promise<void>;
  }
  
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
     * @default 60000 (1 minute)
     */
    defaultRateLimitWindow?: number;
  
    /**
     * Maximum number of rate limit entries to keep in memory.
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
     * @default 0
     */
    defaultRetryAttempts?: number;
  
    /**
     * Default delay between retry attempts in milliseconds.
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
    logLevel?: 'debug' | 'info' | 'warn' | 'error';
  
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
   * Default rate limit store implementation using in-memory Map.
   */
  class MemoryRateLimitStore implements RateLimitStore {
    private store = new Map<string, { count: number; lastReset: number }>();
    private maxEntries: number;
  
    constructor(maxEntries: number = 10000) {
      this.maxEntries = maxEntries;
    }
  
    async get(key: string): Promise<{ count: number; lastReset: number } | null> {
      return this.store.get(key) || null;
    }
  
    async set(key: string, value: { count: number; lastReset: number }): Promise<void> {
      // Simple LRU eviction if we exceed max entries
      if (this.store.size >= this.maxEntries && !this.store.has(key)) {
        const firstKey = this.store.keys().next().value;
        if (firstKey) {
          this.store.delete(firstKey);
        }
      }
      this.store.set(key, value);
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
    }
  
    async clear(): Promise<void> {
      this.store.clear();
    }
  }
  
  /**
   * Default audit logger implementation using console.
   */
  class ConsoleAuditLogger implements AuditLogger {
    async log(event: Parameters<AuditLogger['log']>[0]): Promise<void> {
      if (process.env.NODE_ENV === "development") {
        console.log("AUDIT LOG:", JSON.stringify(event, null, 2));
      }
      // In production, you might want to send to a logging service
      // Example: await logToExternalService(event);
    }
  }
  
  /**
   * Singleton configuration manager for Zerot library.
   * Provides centralized configuration management with type safety and validation.
   */
  class ZerotConfiguration {
    private static instance: ZerotConfiguration;
    private config: Required<ZerotConfig>;
    private isInitialized = false;
  
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
     * Get the default configuration values.
     */
    private getDefaultConfig(): Required<ZerotConfig> {
      return {
        // Global settings
        enableDebugMode: process.env.NODE_ENV === 'development',
        enablePerformanceMonitoring: false,
        defaultLayer: 'unknown',
        enableStrictValidation: true,
  
        // Rate limiting
        defaultRateLimitWindow: 60000, // 1 minute
        rateLimitMaxEntries: 10000,
        customRateLimitStore: new MemoryRateLimitStore(10000),
  
        // Retry settings
        defaultRetryAttempts: 0,
        defaultRetryDelayMs: 100,
        defaultRetryOnCategories: [ErrorCategory.NETWORK, ErrorCategory.SYSTEM],
  
        // Logging
        logLevel: 'info',
        enableAuditLogging: true,
        customLogger: defaultLogger,
        customAuditLogger: new ConsoleAuditLogger(),
  
        // Security
        sensitiveFields: ['password', 'token', 'secret', 'apiKey', 'privateKey', 'session'],
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
        enableAutoTestGeneration: false
      };
    }
  
    /**
     * Configure Zerot with the provided options.
     * This method should be called once during application initialization.
     * 
     * @param config Partial configuration object
     * @throws Error if configuration validation fails
     */
    configure(config: Partial<ZerotConfig>): void {
      try {
        // Validate configuration
        this.validateConfig(config);
  
        // Merge with defaults
        this.config = { ...this.config, ...config };
  
        // Apply provider configurations
        if (config.sessionProvider) {
          setSessionProvider(config.sessionProvider);
        }
        if (config.resourceProvider) {
          setResourceProvider(config.resourceProvider);
        }
  
        // Mark as initialized
        this.isInitialized = true;
  
        // Log configuration in debug mode
        if (this.config.enableDebugMode) {
          console.log('[Zerot] Configuration applied:', {
            enableDebugMode: this.config.enableDebugMode,
            enablePerformanceMonitoring: this.config.enablePerformanceMonitoring,
            defaultLayer: this.config.defaultLayer,
            enableAuditLogging: this.config.enableAuditLogging,
            logLevel: this.config.logLevel
          });
        }
      } catch (error) {
        throw new Error(`Failed to configure Zerot: ${(error as Error).message}`);
      }
    }
  
    /**
     * Validate the provided configuration.
     */
    private validateConfig(config: Partial<ZerotConfig>): void {
      if (config.defaultRetryAttempts !== undefined && config.defaultRetryAttempts < 0) {
        throw new Error('defaultRetryAttempts must be non-negative');
      }
  
      if (config.defaultRetryDelayMs !== undefined && config.defaultRetryDelayMs < 0) {
        throw new Error('defaultRetryDelayMs must be non-negative');
      }
  
      if (config.defaultRateLimitWindow !== undefined && config.defaultRateLimitWindow <= 0) {
        throw new Error('defaultRateLimitWindow must be positive');
      }
  
      if (config.maxConditionExecutionTime !== undefined && config.maxConditionExecutionTime <= 0) {
        throw new Error('maxConditionExecutionTime must be positive');
      }
  
      if (config.conditionCacheTtl !== undefined && config.conditionCacheTtl <= 0) {
        throw new Error('conditionCacheTtl must be positive');
      }
  
      if (config.logLevel && !['debug', 'info', 'warn', 'error'].includes(config.logLevel)) {
        throw new Error('logLevel must be one of: debug, info, warn, error');
      }
    }
  
    /**
     * Get a configuration value by key.
     * 
     * @param key Configuration key
     * @returns Configuration value
     */
    get<K extends keyof ZerotConfig>(key: K): Required<ZerotConfig>[K] {
      return this.config[key];
    }
  
    /**
     * Get all configuration values.
     * 
     * @returns Complete configuration object
     */
    getAll(): Required<ZerotConfig> {
      return { ...this.config };
    }
  
    /**
     * Check if Zerot has been configured.
     * 
     * @returns True if configure() has been called
     */
    isConfigured(): boolean {
      return this.isInitialized;
    }
  
    /**
     * Reset configuration to defaults.
     * This is primarily useful for testing.
     */
    reset(): void {
      this.config = this.getDefaultConfig();
      this.isInitialized = false;
  
      // Reset providers
      setSessionProvider(this.config.sessionProvider);
      setResourceProvider(this.config.resourceProvider);
    }
  
    /**
     * Update a specific configuration value at runtime.
     * Use with caution - some changes may not take effect immediately.
     * 
     * @param key Configuration key
     * @param value New value
     */
    set<K extends keyof ZerotConfig>(key: K, value: Required<ZerotConfig>[K]): void {
      this.config[key] = value;
  
      // Apply special handling for certain keys
      if (key === 'sessionProvider') {
        setSessionProvider(value as SessionProvider);
      } else if (key === 'resourceProvider') {
        setResourceProvider(value as ResourceProvider);
      }
    }
  }
  
  /**
   * Global configuration instance.
   * Use this to access Zerot configuration throughout your application.
   */
  export const zerotConfig = ZerotConfiguration.getInstance();
  
  /**
   * Convenience function for initial Zerot configuration.
   * This should be called once during application startup.
   * 
   * @param config Configuration options
   * 
   * @example
   * ```typescript
   * // At application startup (e.g., in main.ts or app initialization)
   * import { configureZerot } from 'zerot/config';
   * 
   * await configureZerot({
   *   enableDebugMode: process.env.NODE_ENV === 'development',
   *   enablePerformanceMonitoring: true,
   *   sessionProvider: async () => {
   *     // Your session logic here
   *     return await getAuthContext();
   *   },
   *   resourceProvider: async (resourceId) => {
   *     // Your resource logic here
   *     return await getResourceFromDB(resourceId);
   *   },
   *   defaultRetryAttempts: 3,
   *   enableAuditLogging: true
   * });
   * ```
   */
  export function configureZerot(config: ZerotConfig): void {
    zerotConfig.configure(config);
  }
  
  /**
   * Get the current Zerot configuration.
   * 
   * @returns Current configuration object
   */
  export function getZerotConfig(): Required<ZerotConfig> {
    return zerotConfig.getAll();
  }
  
  /**
   * Check if Zerot has been properly configured.
   * 
   * @returns True if Zerot is configured and ready to use
   */
  export function isZerotConfigured(): boolean {
    return zerotConfig.isConfigured();
  }
  
  /**
   * Configuration presets for common scenarios.
   */
  export const ZerotPresets = {
    /**
     * Development preset with debugging enabled.
     */
    development: (): ZerotConfig => ({
      enableDebugMode: true,
      enablePerformanceMonitoring: true,
      enableExecutionTracing: true,
      logLevel: 'debug',
      enableAuditLogging: true,
      defaultRetryAttempts: 1,
      enableConditionCaching: false // Disable caching in dev for predictability
    }),
  
    /**
     * Production preset with performance optimizations.
     */
    production: (): ZerotConfig => ({
      enableDebugMode: false,
      enablePerformanceMonitoring: true,
      enableExecutionTracing: false,
      logLevel: 'warn',
      enableAuditLogging: true,
      defaultRetryAttempts: 3,
      enableConditionCaching: true,
      conditionCacheTtl: 10000 // 10 seconds
    }),
  
    /**
     * Testing preset with consistent behavior.
     */
    testing: (): ZerotConfig => ({
      enableDebugMode: false,
      enablePerformanceMonitoring: false,
      enableExecutionTracing: false,
      logLevel: 'error',
      enableAuditLogging: false,
      defaultRetryAttempts: 0,
      enableConditionCaching: false,
      defaultRateLimitWindow: 1000 // Shorter window for faster tests
    }),
  
    /**
     * High-security preset with strict validation.
     */
    secure: (): ZerotConfig => ({
      enableStrictValidation: true,
      enableInputSanitization: true,
      sensitiveFields: [
        'password', 'token', 'secret', 'apiKey', 'privateKey', 
        'session', 'authorization', 'credential', 'key'
      ],
      enableAuditLogging: true,
      maxConditionExecutionTime: 3000 // Stricter timeout
    })
  };
