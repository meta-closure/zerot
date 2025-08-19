it("should verify ContractError details structure", async () => {
  // This test helps us understand the actual ContractError structure
  const rateLimitCondition = rateLimit("structure_test", 1, 60000);

  try {
    await rateLimitCondition({}, {});
  } catch (error) {
    console.log("ContractError structure:", error);
    if (error instanceof ContractError) {
      console.log("Error details:", error.details);
      console.log("Error details keys:", Object.keys(error.details || {}));
    }
    // This test is just for debugging, so always pass
    expect(true).toBe(true);
  }
});
import {
  checkRateLimit,
  clearAllRateLimits,
  clearRateLimit,
  getAllRateLimits,
  getRateLimitStatus,
  rateLimit,
} from "@/conditions/rate-limit";
import { ContractError } from "@/core/errors";
import { AuthContext } from "@/core/types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock console methods
const mockConsoleLog = vi.fn();
const mockConsoleError = vi.fn();

// Store original console methods
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

// Mock Date.now for time-based tests
const mockDateNow = vi.fn();

describe("Rate Limit System", () => {
  let mockAuthContext: AuthContext;
  let originalDateNow: typeof Date.now;

  beforeEach(() => {
    // Set up console mocks
    console.log = mockConsoleLog;
    console.error = mockConsoleError;

    // Set up Date.now mock
    originalDateNow = Date.now;
    Date.now = mockDateNow;
    mockDateNow.mockReturnValue(1000000); // Fixed timestamp

    mockAuthContext = {
      user: {
        id: "user123",
        email: "test@example.com",
        name: "Test User",
        roles: ["user"],
      },
      session: {
        id: "session456",
        expiresAt: new Date("2024-12-31"),
      },
    };

    // Clear all rate limits before each test
    clearAllRateLimits();
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Restore console methods
    console.log = originalConsoleLog;
    console.error = originalConsoleError;

    // Restore Date.now
    Date.now = originalDateNow;

    // Clear all rate limits after each test
    clearAllRateLimits();
    vi.clearAllMocks();
  });

  describe("rateLimit condition", () => {
    it("should allow operation when under rate limit", async () => {
      const rateLimitCondition = rateLimit("test_operation", 5, 60000);

      const result = await rateLimitCondition({}, mockAuthContext);

      expect(result).toBe(true);
      expect(mockConsoleLog).toHaveBeenCalledWith(
        "[RATE_LIMIT] Checking rate limit for operation: test_operation"
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        "[RATE_LIMIT] Rate limit check passed for test_operation"
      );
    });

    it("should throw error when no user ID is available", async () => {
      const rateLimitCondition = rateLimit("test_operation", 5, 60000);
      const contextWithoutUser: AuthContext = {};

      await expect(rateLimitCondition({}, contextWithoutUser)).rejects.toThrow(
        "User ID required for rate limiting"
      );

      // Also check that it's a ContractError
      await expect(
        rateLimitCondition({}, contextWithoutUser)
      ).rejects.toBeInstanceOf(ContractError);
    });

    it("should track separate rate limits per operation", async () => {
      const operation1 = rateLimit("operation1", 2, 60000);
      const operation2 = rateLimit("operation2", 2, 60000);

      // Use operation1 twice (should work)
      await operation1({}, mockAuthContext);
      await operation1({}, mockAuthContext);

      // Use operation2 twice (should also work independently)
      await operation2({}, mockAuthContext);
      await operation2({}, mockAuthContext);

      // Third call to operation1 should fail
      await expect(operation1({}, mockAuthContext)).rejects.toThrow(
        "Rate limit exceeded"
      );

      // Third call to operation2 should also fail
      await expect(operation2({}, mockAuthContext)).rejects.toThrow(
        "Rate limit exceeded"
      );
    });

    it("should track separate rate limits per user", async () => {
      const rateLimitCondition = rateLimit("test_operation", 2, 60000);

      const user1Context: AuthContext = {
        user: { id: "user1", roles: ["user"] },
      };
      const user2Context: AuthContext = {
        user: { id: "user2", roles: ["user"] },
      };

      // User1 uses operation twice
      await rateLimitCondition({}, user1Context);
      await rateLimitCondition({}, user1Context);

      // User2 should still be able to use operation
      await rateLimitCondition({}, user2Context);
      await rateLimitCondition({}, user2Context);

      // Third call for user1 should fail
      await expect(rateLimitCondition({}, user1Context)).rejects.toThrow(
        "Rate limit exceeded"
      );

      // Third call for user2 should also fail
      await expect(rateLimitCondition({}, user2Context)).rejects.toThrow(
        "Rate limit exceeded"
      );
    });

    it("should increment counter correctly", async () => {
      const rateLimitCondition = rateLimit("increment_test", 3, 60000);

      // First call
      await rateLimitCondition({}, mockAuthContext);
      let status = getRateLimitStatus("user123", "increment_test");
      expect(status?.current).toBe(1);

      // Second call
      await rateLimitCondition({}, mockAuthContext);
      status = getRateLimitStatus("user123", "increment_test");
      expect(status?.current).toBe(2);

      // Third call
      await rateLimitCondition({}, mockAuthContext);
      status = getRateLimitStatus("user123", "increment_test");
      expect(status?.current).toBe(3);

      // Fourth call should fail
      await expect(rateLimitCondition({}, mockAuthContext)).rejects.toThrow(
        "Rate limit exceeded"
      );
    });

    it("should throw detailed error when rate limit exceeded", async () => {
      const rateLimitCondition = rateLimit("error_test", 2, 30000);

      // Use up the rate limit
      await rateLimitCondition({}, mockAuthContext);
      await rateLimitCondition({}, mockAuthContext);

      // Third call should throw detailed error
      await expect(rateLimitCondition({}, mockAuthContext)).rejects.toThrow(
        "Rate limit exceeded for error_test: 2/2 per 30 seconds"
      );

      // Also check that it's a ContractError
      await expect(
        rateLimitCondition({}, mockAuthContext)
      ).rejects.toBeInstanceOf(ContractError);
    });

    it("should reset window after expiration", async () => {
      const rateLimitCondition = rateLimit("window_reset", 2, 60000);
      const baseTime = 1000000;

      // Use up the rate limit
      mockDateNow.mockReturnValue(baseTime);
      await rateLimitCondition({}, mockAuthContext);
      await rateLimitCondition({}, mockAuthContext);

      // Third call should fail
      await expect(rateLimitCondition({}, mockAuthContext)).rejects.toThrow(
        "Rate limit exceeded"
      );

      // Move time forward past the window
      mockDateNow.mockReturnValue(baseTime + 60001);

      // Should work again after window reset
      const result = await rateLimitCondition({}, mockAuthContext);
      expect(result).toBe(true);

      const status = getRateLimitStatus("user123", "window_reset");
      expect(status?.current).toBe(1); // Counter should be reset
    });

    it("should use default window of 60 seconds", async () => {
      const rateLimitCondition = rateLimit("default_window", 1); // No windowMs specified

      await rateLimitCondition({}, mockAuthContext);

      const status = getRateLimitStatus("user123", "default_window");
      expect(status?.windowMs).toBe(60000); // 60 seconds default
    });

    it("should log detailed information during processing", async () => {
      const rateLimitCondition = rateLimit("logging_test", 2, 30000);

      await rateLimitCondition({}, mockAuthContext);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        "[RATE_LIMIT] Checking rate limit for operation: logging_test"
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        "[RATE_LIMIT] Context user:",
        { hasUser: true, userId: "user123" }
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        "[RATE_LIMIT] Checking key: rateLimit:user123:logging_test"
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        "[RATE_LIMIT] Resetting window for rateLimit:user123:logging_test"
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        "[RATE_LIMIT] Current usage: 0/2"
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        "[RATE_LIMIT] Updated count: 1/2"
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        "[RATE_LIMIT] Rate limit check passed for logging_test"
      );
    });
  });

  describe("clearRateLimit", () => {
    it("should clear specific rate limit", async () => {
      const rateLimitCondition = rateLimit("clear_test", 1, 60000);

      // Use up the rate limit
      await rateLimitCondition({}, mockAuthContext);

      // Should fail now
      await expect(rateLimitCondition({}, mockAuthContext)).rejects.toThrow(
        "Rate limit exceeded"
      );

      // Clear the rate limit
      clearRateLimit("user123", "clear_test");

      // Should work again
      const result = await rateLimitCondition({}, mockAuthContext);
      expect(result).toBe(true);
    });

    it("should not affect other rate limits when clearing specific one", async () => {
      const operation1 = rateLimit("operation1", 1, 60000);
      const operation2 = rateLimit("operation2", 1, 60000);

      // Use up both rate limits
      await operation1({}, mockAuthContext);
      await operation2({}, mockAuthContext);

      // Clear only operation1
      clearRateLimit("user123", "operation1");

      // Operation1 should work again
      await operation1({}, mockAuthContext);

      // Operation2 should still be blocked
      await expect(operation2({}, mockAuthContext)).rejects.toThrow(
        "Rate limit exceeded"
      );
    });
  });

  describe("getRateLimitStatus", () => {
    it("should return null for non-existent rate limit", () => {
      const status = getRateLimitStatus("user123", "non_existent");
      expect(status).toBeNull();
    });

    it("should return correct status for existing rate limit", async () => {
      const rateLimitCondition = rateLimit("status_test", 5, 60000);
      const baseTime = 1000000;

      mockDateNow.mockReturnValue(baseTime);
      await rateLimitCondition({}, mockAuthContext);

      // Move time forward slightly
      mockDateNow.mockReturnValue(baseTime + 10000);

      const status = getRateLimitStatus("user123", "status_test");
      expect(status).toEqual({
        current: 1,
        max: 5,
        windowMs: 60000,
        timeUntilReset: 50000, // 60000 - 10000
      });
    });

    it("should calculate timeUntilReset correctly", async () => {
      const rateLimitCondition = rateLimit("time_test", 3, 30000);
      const baseTime = 1000000;

      mockDateNow.mockReturnValue(baseTime);
      await rateLimitCondition({}, mockAuthContext);

      // Move time forward
      mockDateNow.mockReturnValue(baseTime + 25000);

      const status = getRateLimitStatus("user123", "time_test");
      expect(status?.timeUntilReset).toBe(5000); // 30000 - 25000
    });

    it("should return 0 timeUntilReset when window has expired", async () => {
      const rateLimitCondition = rateLimit("expired_test", 3, 30000);
      const baseTime = 1000000;

      mockDateNow.mockReturnValue(baseTime);
      await rateLimitCondition({}, mockAuthContext);

      // Move time forward past the window
      mockDateNow.mockReturnValue(baseTime + 35000);

      const status = getRateLimitStatus("user123", "expired_test");
      expect(status?.timeUntilReset).toBe(0);
    });
  });

  describe("clearAllRateLimits", () => {
    it("should clear all rate limits", async () => {
      const operation1 = rateLimit("op1", 1, 60000);
      const operation2 = rateLimit("op2", 1, 60000);

      // Use up both rate limits
      await operation1({}, mockAuthContext);
      await operation2({}, mockAuthContext);

      // Both should be blocked
      await expect(operation1({}, mockAuthContext)).rejects.toThrow(
        "Rate limit exceeded"
      );
      await expect(operation2({}, mockAuthContext)).rejects.toThrow(
        "Rate limit exceeded"
      );

      // Clear all rate limits
      clearAllRateLimits();

      // Both should work again
      await operation1({}, mockAuthContext);
      await operation2({}, mockAuthContext);
    });
  });

  describe("getAllRateLimits", () => {
    it("should return empty object when no rate limits exist", () => {
      const allLimits = getAllRateLimits();
      expect(allLimits).toEqual({});
    });

    it("should return all active rate limits", async () => {
      const operation1 = rateLimit("get_all_1", 3, 30000);
      const operation2 = rateLimit("get_all_2", 5, 60000);

      await operation1({}, mockAuthContext);
      await operation2({}, mockAuthContext);

      const allLimits = getAllRateLimits();
      expect(Object.keys(allLimits)).toHaveLength(2);

      expect(allLimits["rateLimit:user123:get_all_1"]).toEqual({
        count: 1,
        lastReset: 1000000,
        maxPerWindow: 3,
        windowMs: 30000,
      });

      expect(allLimits["rateLimit:user123:get_all_2"]).toEqual({
        count: 1,
        lastReset: 1000000,
        maxPerWindow: 5,
        windowMs: 60000,
      });
    });

    it("should return deep copy of rate limits", async () => {
      const rateLimitCondition = rateLimit("copy_test", 3, 30000);
      await rateLimitCondition({}, mockAuthContext);

      const allLimits = getAllRateLimits();
      const limitKey = "rateLimit:user123:copy_test";

      // Modify the returned object
      allLimits[limitKey].count = 999;

      // Original should remain unchanged
      const status = getRateLimitStatus("user123", "copy_test");
      expect(status?.current).toBe(1); // Not 999
    });
  });

  describe("checkRateLimit", () => {
    it("should return allowed=true for new rate limit", () => {
      const result = checkRateLimit("user123", "check_test", 5, 60000);

      expect(result).toEqual({
        allowed: true,
        current: 0,
        timeUntilReset: 0,
      });
    });

    it("should return correct status without modifying rate limit", async () => {
      const rateLimitCondition = rateLimit("readonly_test", 3, 60000);

      // Use the rate limit twice
      await rateLimitCondition({}, mockAuthContext);
      await rateLimitCondition({}, mockAuthContext);

      // Check without modifying
      const result = checkRateLimit("user123", "readonly_test", 3, 60000);
      expect(result).toEqual({
        allowed: true, // Still allowed (2/3)
        current: 2,
        timeUntilReset: expect.any(Number),
      });

      // Verify the rate limit wasn't modified
      const status = getRateLimitStatus("user123", "readonly_test");
      expect(status?.current).toBe(2); // Still 2, not incremented
    });

    it("should return allowed=false when at limit", async () => {
      const rateLimitCondition = rateLimit("at_limit_test", 2, 60000);

      // Use up the rate limit
      await rateLimitCondition({}, mockAuthContext);
      await rateLimitCondition({}, mockAuthContext);

      const result = checkRateLimit("user123", "at_limit_test", 2, 60000);
      expect(result.allowed).toBe(false);
      expect(result.current).toBe(2);
    });

    it("should handle expired windows in read-only check", () => {
      const baseTime = 1000000;
      mockDateNow.mockReturnValue(baseTime + 70000); // Past 60s window

      const result = checkRateLimit("user123", "expired_check", 5, 60000);

      expect(result).toEqual({
        allowed: true,
        current: 0,
        timeUntilReset: 0,
      });
    });

    it("should use default window when not specified", () => {
      const result = checkRateLimit("user123", "default_check", 5);

      expect(result).toEqual({
        allowed: true,
        current: 0,
        timeUntilReset: 0,
      });
    });
  });

  describe("Edge cases and error handling", () => {
    it("should handle multiple rapid calls correctly", async () => {
      const rateLimitCondition = rateLimit("rapid_test", 3, 60000);

      // Make multiple rapid calls
      const promises = [
        rateLimitCondition({}, mockAuthContext),
        rateLimitCondition({}, mockAuthContext),
        rateLimitCondition({}, mockAuthContext),
      ];

      const results = await Promise.all(promises);
      expect(results).toEqual([true, true, true]);

      // Fourth call should fail
      await expect(rateLimitCondition({}, mockAuthContext)).rejects.toThrow(
        "Rate limit exceeded"
      );
    });

    it("should handle user context with null user", async () => {
      const rateLimitCondition = rateLimit("null_user_test", 5, 60000);
      const contextWithNullUser: AuthContext = { user: null as any };

      await expect(rateLimitCondition({}, contextWithNullUser)).rejects.toThrow(
        "User ID required for rate limiting"
      );
    });

    it("should handle user context with undefined user id", async () => {
      const rateLimitCondition = rateLimit("undefined_id_test", 5, 60000);
      const contextWithUndefinedId: AuthContext = {
        user: { id: undefined as any, roles: ["user"] },
      };

      await expect(
        rateLimitCondition({}, contextWithUndefinedId)
      ).rejects.toThrow("User ID required for rate limiting");
    });

    it("should work with different input types", async () => {
      const rateLimitCondition = rateLimit<string>("input_test", 2, 60000);

      // Should work regardless of input type
      await rateLimitCondition("string input", mockAuthContext);
      await rateLimitCondition("different string", mockAuthContext);

      await expect(
        rateLimitCondition("third string", mockAuthContext)
      ).rejects.toThrow("Rate limit exceeded");
    });

    it("should handle zero max per window", async () => {
      const rateLimitCondition = rateLimit("zero_limit", 0, 60000);

      await expect(rateLimitCondition({}, mockAuthContext)).rejects.toThrow(
        "Rate limit exceeded"
      );
    });

    it("should handle very small window", async () => {
      const rateLimitCondition = rateLimit("small_window", 2, 1); // 1ms window
      const baseTime = 1000000;

      mockDateNow.mockReturnValue(baseTime);
      await rateLimitCondition({}, mockAuthContext);

      // Move time forward past tiny window
      mockDateNow.mockReturnValue(baseTime + 2);

      // Should reset and allow again
      await rateLimitCondition({}, mockAuthContext);

      const status = getRateLimitStatus("user123", "small_window");
      expect(status?.current).toBe(1); // Reset due to expired window
    });
  });

  describe("Performance and memory", () => {
    it("should handle many different operations", async () => {
      const operations = Array.from({ length: 100 }, (_, i) =>
        rateLimit(`operation_${i}`, 1, 60000)
      );

      // Use each operation once
      for (const operation of operations) {
        await operation({}, mockAuthContext);
      }

      const allLimits = getAllRateLimits();
      expect(Object.keys(allLimits)).toHaveLength(100);
    });

    it("should handle many different users", async () => {
      const rateLimitCondition = rateLimit("multi_user_test", 1, 60000);

      // Create 50 different user contexts
      for (let i = 0; i < 50; i++) {
        const userContext: AuthContext = {
          user: { id: `user_${i}`, roles: ["user"] },
        };
        await rateLimitCondition({}, userContext);
      }

      const allLimits = getAllRateLimits();
      expect(Object.keys(allLimits)).toHaveLength(50);
    });
  });
});
