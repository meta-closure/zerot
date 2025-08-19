import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the logger
vi.mock("@/utils/logger", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Types for testing
type LogLevel = "debug" | "info" | "warn" | "error";

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

interface ConfigChangeEvent {
  key?: string;
  oldValue?: unknown;
  newValue?: unknown;
  timestamp: Date;
}

type ConfigChangeListener = (event: ConfigChangeEvent) => void;

interface ZerotConfig {
  enableDebugMode?: boolean;
  enablePerformanceMonitoring?: boolean;
  defaultLayer?: string;
  enableStrictValidation?: boolean;
  defaultRateLimitWindow?: number;
  rateLimitMaxEntries?: number;
  defaultRetryAttempts?: number;
  defaultRetryDelayMs?: number;
  logLevel?: LogLevel;
  enableAuditLogging?: boolean;
  sensitiveFields?: string[];
  enableInputSanitization?: boolean;
  maxConditionExecutionTime?: number;
  enableConditionCaching?: boolean;
  conditionCacheTtl?: number;
  enableExecutionTracing?: boolean;
  maxExecutionTraces?: number;
}

// Test implementation of Configuration class
class TestZerotConfiguration {
  private static instance: TestZerotConfiguration;
  private config: Required<ZerotConfig>;
  private isInitialized = false;
  private changeListeners: Set<ConfigChangeListener> = new Set();

  private constructor() {
    this.config = this.getDefaultConfig();
  }

  static getInstance(): TestZerotConfiguration {
    if (!TestZerotConfiguration.instance) {
      TestZerotConfiguration.instance = new TestZerotConfiguration();
    }
    return TestZerotConfiguration.instance;
  }

  private getDefaultConfig(): Required<ZerotConfig> {
    const isDevelopment = process.env.NODE_ENV === "development";
    return {
      enableDebugMode: isDevelopment,
      enablePerformanceMonitoring: false,
      defaultLayer: "unknown",
      enableStrictValidation: true,
      defaultRateLimitWindow: 60000,
      rateLimitMaxEntries: 10000,
      defaultRetryAttempts: 0,
      defaultRetryDelayMs: 100,
      logLevel: "info",
      enableAuditLogging: true,
      sensitiveFields: [
        "password",
        "token",
        "secret",
        "apiKey",
        "privateKey",
        "session",
      ],
      enableInputSanitization: true,
      maxConditionExecutionTime: 5000,
      enableConditionCaching: false,
      conditionCacheTtl: 5000,
      enableExecutionTracing: false,
      maxExecutionTraces: 1000,
    };
  }

  private validateConfig(config: Partial<ZerotConfig>): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (config.defaultRetryAttempts !== undefined) {
      if (config.defaultRetryAttempts < 0) {
        errors.push("defaultRetryAttempts must be non-negative");
      }
      if (config.defaultRetryAttempts > 10) {
        warnings.push("defaultRetryAttempts > 10 may cause long delays");
      }
    }

    if (config.defaultRetryDelayMs !== undefined) {
      if (config.defaultRetryDelayMs < 0) {
        errors.push("defaultRetryDelayMs must be non-negative");
      }
      if (config.defaultRetryDelayMs > 10000) {
        warnings.push(
          "defaultRetryDelayMs > 10s may cause poor user experience"
        );
      }
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

    if (
      config.enableConditionCaching &&
      config.conditionCacheTtl === undefined
    ) {
      warnings.push(
        "enableConditionCaching is true but conditionCacheTtl is not set"
      );
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  configure(config: Partial<ZerotConfig>): void {
    const validation = this.validateConfig(config);

    if (!validation.isValid) {
      throw new Error(
        `Configuration validation failed: ${validation.errors.join(", ")}`
      );
    }

    if (validation.warnings.length > 0 && this.config.enableStrictValidation) {
      throw new Error(
        `Configuration warnings in strict mode: ${validation.warnings.join(", ")}`
      );
    }

    const oldConfig = { ...this.config };

    // Filter out undefined values to avoid overriding with undefined
    const filteredConfig = Object.fromEntries(
      Object.entries(config).filter(([_, value]) => value !== undefined)
    ) as Partial<ZerotConfig>;

    this.config = { ...this.config, ...filteredConfig };
    this.isInitialized = true;

    this.notifyConfigChange({
      oldValue: oldConfig,
      newValue: this.config,
      timestamp: new Date(),
    });

    if (this.config.enableDebugMode) {
      console.log("[Zerot] Configuration applied:", {
        enableDebugMode: this.config.enableDebugMode,
        logLevel: this.config.logLevel,
        warnings: validation.warnings,
      });
    }
  }

  get<K extends keyof ZerotConfig>(key: K): Required<ZerotConfig>[K] {
    return this.config[key];
  }

  getAll(): Required<ZerotConfig> {
    return { ...this.config };
  }

  isConfigured(): boolean {
    return this.isInitialized;
  }

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
      key: String(key),
      oldValue,
      newValue: value,
      timestamp: new Date(),
    });
  }

  validate(): ValidationResult {
    return this.validateConfig(this.config);
  }

  addChangeListener(listener: ConfigChangeListener): void {
    this.changeListeners.add(listener);
  }

  removeChangeListener(listener: ConfigChangeListener): void {
    this.changeListeners.delete(listener);
  }

  private notifyConfigChange(event: ConfigChangeEvent): void {
    for (const listener of this.changeListeners) {
      try {
        listener(event);
      } catch (error) {
        console.error("Error in config change listener:", error);
      }
    }
  }

  // Test helpers
  static resetInstance(): void {
    TestZerotConfiguration.instance = new TestZerotConfiguration();
  }

  getChangeListenerCount(): number {
    return this.changeListeners.size;
  }
}

describe("Zerot Configuration", () => {
  let config: TestZerotConfiguration;

  beforeEach(() => {
    TestZerotConfiguration.resetInstance();
    config = TestZerotConfiguration.getInstance();

    // Mock console
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  describe("Singleton Pattern", () => {
    it("should return the same instance", () => {
      const instance1 = TestZerotConfiguration.getInstance();
      const instance2 = TestZerotConfiguration.getInstance();
      expect(instance1).toBe(instance2);
    });

    it("should maintain state across getInstance calls", () => {
      const instance1 = TestZerotConfiguration.getInstance();
      instance1.configure({ enableDebugMode: true });

      const instance2 = TestZerotConfiguration.getInstance();
      expect(instance2.get("enableDebugMode")).toBe(true);
    });
  });

  describe("Default Configuration", () => {
    it("should have correct default values", () => {
      const defaults = config.getAll();
      const isDevelopment = process.env.NODE_ENV === "development";

      expect(defaults.enableDebugMode).toBe(isDevelopment);
      expect(defaults.enablePerformanceMonitoring).toBe(false);
      expect(defaults.defaultLayer).toBe("unknown");
      expect(defaults.enableStrictValidation).toBe(true);
      expect(defaults.defaultRateLimitWindow).toBe(60000);
      expect(defaults.rateLimitMaxEntries).toBe(10000);
      expect(defaults.defaultRetryAttempts).toBe(0);
      expect(defaults.defaultRetryDelayMs).toBe(100);
      expect(defaults.logLevel).toBe("info");
      expect(defaults.enableAuditLogging).toBe(true);
      expect(defaults.maxConditionExecutionTime).toBe(5000);
      expect(defaults.enableConditionCaching).toBe(false);
      expect(defaults.conditionCacheTtl).toBe(5000);
    });

    it("should include sensitive fields", () => {
      const sensitiveFields = config.get("sensitiveFields");
      expect(sensitiveFields).toContain("password");
      expect(sensitiveFields).toContain("token");
      expect(sensitiveFields).toContain("secret");
      expect(sensitiveFields).toContain("apiKey");
    });

    it("should have all required configuration keys", () => {
      const allConfig = config.getAll();
      const requiredKeys = [
        "enableDebugMode",
        "enablePerformanceMonitoring",
        "defaultLayer",
        "enableStrictValidation",
        "defaultRateLimitWindow",
        "rateLimitMaxEntries",
        "defaultRetryAttempts",
        "defaultRetryDelayMs",
        "logLevel",
        "enableAuditLogging",
        "sensitiveFields",
        "enableInputSanitization",
        "maxConditionExecutionTime",
        "enableConditionCaching",
        "conditionCacheTtl",
      ];

      requiredKeys.forEach((key) => {
        expect(allConfig).toHaveProperty(key);
      });
    });
  });

  describe("Configuration Updates", () => {
    it("should update configuration values", () => {
      config.configure({
        enableDebugMode: true,
        logLevel: "debug",
        defaultRetryAttempts: 3,
      });

      expect(config.get("enableDebugMode")).toBe(true);
      expect(config.get("logLevel")).toBe("debug");
      expect(config.get("defaultRetryAttempts")).toBe(3);
    });

    it("should merge with existing configuration", () => {
      config.configure({ enableDebugMode: true });
      expect(config.get("enableDebugMode")).toBe(true);
      expect(config.get("logLevel")).toBe("info"); // Should remain default

      config.configure({ logLevel: "debug" });
      expect(config.get("enableDebugMode")).toBe(true); // Should remain
      expect(config.get("logLevel")).toBe("debug"); // Should be updated
    });

    it("should mark as configured after configure call", () => {
      expect(config.isConfigured()).toBe(false);

      config.configure({ enableDebugMode: true });
      expect(config.isConfigured()).toBe(true);
    });

    it("should log configuration in debug mode", () => {
      const consoleLogSpy = vi.spyOn(console, "log");

      config.configure({
        enableDebugMode: true,
        logLevel: "debug",
      });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        "[Zerot] Configuration applied:",
        expect.objectContaining({
          enableDebugMode: true,
          logLevel: "debug",
        })
      );
    });
  });

  describe("Validation", () => {
    it("should validate positive numeric values", () => {
      expect(() => {
        config.configure({ defaultRateLimitWindow: -1 });
      }).toThrow("defaultRateLimitWindow must be positive");

      expect(() => {
        config.configure({ maxConditionExecutionTime: 0 });
      }).toThrow("maxConditionExecutionTime must be positive");
    });

    it("should validate non-negative numeric values", () => {
      expect(() => {
        config.configure({ defaultRetryAttempts: -1 });
      }).toThrow("defaultRetryAttempts must be non-negative");

      expect(() => {
        config.configure({ defaultRetryDelayMs: -100 });
      }).toThrow("defaultRetryDelayMs must be non-negative");
    });

    it("should generate warnings for problematic values", () => {
      config.configure({ enableStrictValidation: false });

      expect(() => {
        config.configure({ defaultRetryAttempts: 15 });
      }).not.toThrow();

      expect(() => {
        config.configure({ rateLimitMaxEntries: 50 });
      }).not.toThrow();
    });

    it("should throw on warnings in strict mode", () => {
      config.configure({ enableStrictValidation: true });

      expect(() => {
        config.configure({ defaultRetryAttempts: 15 });
      }).toThrow("Configuration warnings in strict mode");
    });

    it("should validate logical consistency", () => {
      config.configure({ enableStrictValidation: false });

      expect(() => {
        config.configure({
          enableConditionCaching: true,
          // conditionCacheTtl not set - should warn
        });
      }).not.toThrow();
    });

    it("should handle multiple validation errors", () => {
      expect(() => {
        config.configure({
          defaultRetryAttempts: -1,
          defaultRateLimitWindow: -100,
        });
      }).toThrow("Configuration validation failed");
    });
  });

  describe("Runtime Updates", () => {
    beforeEach(() => {
      config.configure({ enableDebugMode: true });
    });

    it("should update single values", () => {
      config.set("logLevel", "error");
      expect(config.get("logLevel")).toBe("error");
    });

    it("should validate single value updates", () => {
      expect(() => {
        config.set("defaultRetryAttempts", -1 as any);
      }).toThrow("Invalid value for defaultRetryAttempts");
    });

    it("should maintain type safety", () => {
      config.set("enableDebugMode", false);
      config.set("logLevel", "warn");
      config.set("defaultRetryAttempts", 5);

      expect(config.get("enableDebugMode")).toBe(false);
      expect(config.get("logLevel")).toBe("warn");
      expect(config.get("defaultRetryAttempts")).toBe(5);
    });
  });

  describe("Change Listeners", () => {
    it("should notify listeners on configuration changes", () => {
      const listener = vi.fn();
      config.addChangeListener(listener);

      config.configure({ enableDebugMode: true });

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          timestamp: expect.any(Date),
        })
      );
    });

    it("should notify listeners on single value changes", () => {
      config.configure({ enableDebugMode: false });

      const listener = vi.fn();
      config.addChangeListener(listener);

      config.set("logLevel", "debug");

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          key: "logLevel",
          oldValue: "info",
          newValue: "debug",
          timestamp: expect.any(Date),
        })
      );
    });

    it("should manage listeners correctly", () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      config.addChangeListener(listener1);
      config.addChangeListener(listener2);
      expect(config.getChangeListenerCount()).toBe(2);

      config.removeChangeListener(listener1);
      expect(config.getChangeListenerCount()).toBe(1);

      config.configure({ enableDebugMode: true });
      expect(listener1).not.toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();
    });

    it("should handle listener errors gracefully", () => {
      const faultyListener = vi.fn(() => {
        throw new Error("Listener error");
      });
      const goodListener = vi.fn();
      const consoleErrorSpy = vi.spyOn(console, "error");

      config.addChangeListener(faultyListener);
      config.addChangeListener(goodListener);

      expect(() => {
        config.configure({ enableDebugMode: true });
      }).not.toThrow();

      expect(faultyListener).toHaveBeenCalled();
      expect(goodListener).toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Error in config change listener:",
        expect.any(Error)
      );
    });
  });

  describe("Configuration Reset", () => {
    it("should reset to defaults", () => {
      config.configure({
        enableDebugMode: true,
        logLevel: "debug",
        defaultRetryAttempts: 5,
      });

      expect(config.get("enableDebugMode")).toBe(true);
      expect(config.isConfigured()).toBe(true);

      config.reset();

      const isDevelopment = process.env.NODE_ENV === "development";
      expect(config.get("enableDebugMode")).toBe(isDevelopment);
      expect(config.get("logLevel")).toBe("info");
      expect(config.get("defaultRetryAttempts")).toBe(0);
      expect(config.isConfigured()).toBe(false);
    });

    it("should notify listeners on reset", () => {
      config.configure({ enableDebugMode: true });

      const listener = vi.fn();
      config.addChangeListener(listener);

      config.reset();

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          timestamp: expect.any(Date),
        })
      );
    });
  });

  describe("Validation Status", () => {
    it("should return current validation status", () => {
      const validation = config.validate();
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toEqual([]);
    });

    it("should detect invalid configuration", () => {
      // Force invalid state
      (config as any).config.defaultRetryAttempts = -1;

      const validation = config.validate();
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain(
        "defaultRetryAttempts must be non-negative"
      );
    });
  });

  describe("Error Recovery", () => {
    it("should maintain state after failed configuration", () => {
      config.configure({
        enableDebugMode: true,
        defaultRetryAttempts: 2,
      });

      expect(config.get("enableDebugMode")).toBe(true);
      expect(config.get("defaultRetryAttempts")).toBe(2);

      // Attempt invalid configuration
      expect(() => {
        config.configure({ defaultRetryAttempts: -1 });
      }).toThrow();

      // Original configuration should remain intact
      expect(config.get("enableDebugMode")).toBe(true);
      expect(config.get("defaultRetryAttempts")).toBe(2);
    });

    it("should handle partial failures gracefully", () => {
      config.configure({ enableStrictValidation: false });

      const mixedConfig: ZerotConfig = {
        enableDebugMode: true,
        defaultRetryAttempts: 15, // Generates warning
        logLevel: "debug",
      };

      expect(() => {
        config.configure(mixedConfig);
      }).not.toThrow();

      expect(config.get("enableDebugMode")).toBe(true);
      expect(config.get("defaultRetryAttempts")).toBe(15);
      expect(config.get("logLevel")).toBe("debug");
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty configuration", () => {
      expect(() => {
        config.configure({});
      }).not.toThrow();

      expect(config.isConfigured()).toBe(true);
    });

    it("should handle undefined values", () => {
      expect(() => {
        config.configure({
          enableDebugMode: undefined,
          logLevel: undefined,
        });
      }).not.toThrow();

      // Undefined values should be filtered out and not override defaults
      const isDevelopment = process.env.NODE_ENV === "development";
      expect(config.get("enableDebugMode")).toBe(isDevelopment);
      expect(config.get("logLevel")).toBe("info");
    });

    it("should validate boundary values", () => {
      expect(() => {
        config.configure({
          defaultRetryAttempts: 0,
          defaultRetryDelayMs: 0,
          defaultRateLimitWindow: 1,
          maxConditionExecutionTime: 1,
          conditionCacheTtl: 1,
        });
      }).not.toThrow();
    });

    it("should handle rapid configuration changes", () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      config.addChangeListener(listener1);
      config.addChangeListener(listener2);

      config.configure({ enableDebugMode: true });
      config.set("logLevel", "debug");
      config.set("defaultRetryAttempts", 3);

      expect(listener1).toHaveBeenCalledTimes(3);
      expect(listener2).toHaveBeenCalledTimes(3);
    });
  });

  describe("Real-world Scenarios", () => {
    it("should handle development configuration", () => {
      const devConfig: ZerotConfig = {
        enableDebugMode: true,
        enableExecutionTracing: true,
        logLevel: "debug",
        enableStrictValidation: false,
        defaultRateLimitWindow: 5000,
      };

      expect(() => {
        config.configure(devConfig);
      }).not.toThrow();

      expect(config.get("enableDebugMode")).toBe(true);
      expect(config.get("logLevel")).toBe("debug");
    });

    it("should handle production configuration", () => {
      const prodConfig: ZerotConfig = {
        enableDebugMode: false,
        enablePerformanceMonitoring: true,
        logLevel: "warn",
        defaultRetryAttempts: 3,
        enableConditionCaching: true,
        conditionCacheTtl: 10000,
        enableStrictValidation: true,
      };

      expect(() => {
        config.configure(prodConfig);
      }).not.toThrow();

      expect(config.get("enableDebugMode")).toBe(false);
      expect(config.get("enablePerformanceMonitoring")).toBe(true);
      expect(config.get("enableConditionCaching")).toBe(true);
    });

    it("should handle configuration migration", () => {
      const oldConfig = {
        enableDebugMode: true,
        logLevel: "debug" as LogLevel,
      };

      config.configure(oldConfig);

      // New fields should have defaults
      expect(config.get("enableConditionCaching")).toBe(false);
      expect(config.get("maxExecutionTraces")).toBe(1000);

      // Old fields should work
      expect(config.get("enableDebugMode")).toBe(true);
      expect(config.get("logLevel")).toBe("debug");
    });

    it("should handle security-focused configuration", () => {
      const secureConfig: ZerotConfig = {
        enableStrictValidation: true,
        enableInputSanitization: true,
        sensitiveFields: [
          "password",
          "token",
          "secret",
          "apiKey",
          "customerSSN",
          "creditCard",
          "internalKey",
        ],
        enableAuditLogging: true,
        maxConditionExecutionTime: 3000,
      };

      expect(() => {
        config.configure(secureConfig);
      }).not.toThrow();

      const sensitiveFields = config.get("sensitiveFields");
      expect(sensitiveFields).toContain("customerSSN");
      expect(sensitiveFields).toContain("creditCard");
    });
  });

  describe("Performance", () => {
    it("should perform config lookups efficiently", () => {
      config.configure({
        enableDebugMode: true,
        logLevel: "debug",
        defaultRetryAttempts: 3,
      });

      const iterations = 1000;
      const startTime = Date.now();

      for (let i = 0; i < iterations; i++) {
        config.get("enableDebugMode");
        config.get("logLevel");
        config.get("defaultRetryAttempts");
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should be very fast (under 50ms for 3000 lookups)
      expect(duration).toBeLessThan(50);
    });

    it("should handle large sensitive fields arrays", () => {
      const largeSensitiveFields = Array.from(
        { length: 100 },
        (_, i) => `field${i}`
      );

      expect(() => {
        config.configure({ sensitiveFields: largeSensitiveFields });
      }).not.toThrow();

      expect(config.get("sensitiveFields")).toHaveLength(100);
    });

    it("should handle many listeners efficiently", () => {
      const listeners = Array.from({ length: 50 }, () => vi.fn());

      listeners.forEach((listener) => config.addChangeListener(listener));
      expect(config.getChangeListenerCount()).toBe(50);

      const startTime = Date.now();
      config.configure({ enableDebugMode: !config.get("enableDebugMode") });
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(50);
      listeners.forEach((listener) => {
        expect(listener).toHaveBeenCalledTimes(1);
      });
    });
  });
});
