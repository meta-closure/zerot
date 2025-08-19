import { auth } from "@/conditions/auth";
import { ContractError, ErrorCategory } from "@/core/errors";
import { AuthContext } from "@/core/types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("auth", () => {
  let mockContext: AuthContext;
  let expiredContext: AuthContext;
  let noUserContext: AuthContext;
  let noSessionContext: AuthContext;

  beforeEach(() => {
    // 有効なユーザーコンテキスト
    mockContext = {
      user: {
        id: "user123",
        username: "testuser",
        roles: ["user", "moderator"],
      },
      session: {
        id: "session456",
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1時間後に期限切れ
        createdAt: new Date().toISOString(),
      },
    };

    // 期限切れセッションのコンテキスト
    expiredContext = {
      user: {
        id: "user123",
        username: "testuser",
        roles: ["user"],
      },
      session: {
        id: "session456",
        expiresAt: new Date(Date.now() - 60 * 60 * 1000), // 1時間前に期限切れ
        createdAt: new Date().toISOString(),
      },
    };

    // ユーザーがいないコンテキスト
    noUserContext = {
      session: {
        id: "session456",
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        createdAt: new Date().toISOString(),
      },
    };

    // セッションがないコンテキスト
    noSessionContext = {
      user: {
        id: "user123",
        username: "testuser",
        roles: ["user"],
      },
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("function creation", () => {
    it("should return a function", () => {
      const condition = auth();
      expect(typeof condition).toBe("function");
    });

    it("should create different functions for different roles", () => {
      const condition1 = auth("admin");
      const condition2 = auth("user");
      expect(condition1).not.toBe(condition2);
    });
  });

  describe("successful authentication", () => {
    it("should return true for valid user without role requirement", async () => {
      const condition = auth();
      const result = await condition({}, mockContext);
      expect(result).toBe(true);
    });

    it("should return true when user has required role", async () => {
      const condition = auth("user");
      const result = await condition({}, mockContext);
      expect(result).toBe(true);
    });

    it("should return true when user has multiple roles including required one", async () => {
      const condition = auth("moderator");
      const result = await condition({}, mockContext);
      expect(result).toBe(true);
    });

    it("should work with admin role", async () => {
      const adminContext = {
        ...mockContext,
        user: {
          ...mockContext.user!,
          roles: ["user", "admin"],
        },
      };

      const condition = auth("admin");
      const result = await condition({}, adminContext);
      expect(result).toBe(true);
    });
  });

  describe("authentication failures", () => {
    it("should throw ContractError when user is not logged in", async () => {
      const condition = auth();

      await expect(condition({}, noUserContext)).rejects.toThrow(ContractError);
      await expect(condition({}, noUserContext)).rejects.toThrow(
        "User must be logged in"
      );

      try {
        await condition({}, noUserContext);
      } catch (error) {
        expect(error).toBeInstanceOf(ContractError);
        expect((error as ContractError).code).toBe("AUTHENTICATION_REQUIRED");
        expect((error as ContractError).category).toBe(
          ErrorCategory.AUTHENTICATION
        );
      }
    });

    it("should throw ContractError when session is missing", async () => {
      const condition = auth();

      await expect(condition({}, noSessionContext)).rejects.toThrow(
        ContractError
      );
      await expect(condition({}, noSessionContext)).rejects.toThrow(
        "Session has expired"
      );

      try {
        await condition({}, noSessionContext);
      } catch (error) {
        expect(error).toBeInstanceOf(ContractError);
        expect((error as ContractError).code).toBe("SESSION_EXPIRED");
        expect((error as ContractError).category).toBe(
          ErrorCategory.AUTHENTICATION
        );
      }
    });

    it("should throw ContractError when session is expired", async () => {
      const condition = auth();

      await expect(condition({}, expiredContext)).rejects.toThrow(
        ContractError
      );
      await expect(condition({}, expiredContext)).rejects.toThrow(
        "Session has expired"
      );

      try {
        await condition({}, expiredContext);
      } catch (error) {
        expect(error).toBeInstanceOf(ContractError);
        expect((error as ContractError).code).toBe("SESSION_EXPIRED");
        expect((error as ContractError).category).toBe(
          ErrorCategory.AUTHENTICATION
        );
      }
    });
  });

  describe("authorization failures", () => {
    it("should throw ContractError when user lacks required role", async () => {
      const condition = auth("admin");

      await expect(condition({}, mockContext)).rejects.toThrow(ContractError);
      await expect(condition({}, mockContext)).rejects.toThrow(
        "Required role: admin, User roles: user, moderator"
      );

      try {
        await condition({}, mockContext);
      } catch (error) {
        expect(error).toBeInstanceOf(ContractError);
        expect((error as ContractError).code).toBe("INSUFFICIENT_ROLE");
        expect((error as ContractError).category).toBe(
          ErrorCategory.AUTHORIZATION
        );
      }
    });

    it("should throw ContractError with detailed role information", async () => {
      const singleRoleContext = {
        ...mockContext,
        user: {
          ...mockContext.user!,
          roles: ["user"],
        },
      };

      const condition = auth("admin");

      try {
        await condition({}, singleRoleContext);
      } catch (error) {
        expect(error).toBeInstanceOf(ContractError);
        expect((error as ContractError).message).toBe(
          "Required role: admin, User roles: user"
        );
      }
    });

    it("should handle empty roles array", async () => {
      const noRolesContext = {
        ...mockContext,
        user: {
          ...mockContext.user!,
          roles: [],
        },
      };

      const condition = auth("user");

      try {
        await condition({}, noRolesContext);
      } catch (error) {
        expect(error).toBeInstanceOf(ContractError);
        expect((error as ContractError).message).toBe(
          "Required role: user, User roles: "
        );
      }
    });
  });

  describe("edge cases", () => {
    it("should handle session expiry at exact current time", async () => {
      const nowExpiryContext = {
        ...mockContext,
        session: {
          ...mockContext.session!,
          expiresAt: new Date(), // 現在時刻と同じ
        },
      };

      const condition = auth();

      // 厳密に言えば現在時刻より少し後になるため、テストの安定性のために少し待つ
      await new Promise((resolve) => setTimeout(resolve, 1));

      await expect(condition({}, nowExpiryContext)).rejects.toThrow(
        "Session has expired"
      );
    });

    it("should handle malformed session expiry date", async () => {
      const malformedExpiryContext = {
        ...mockContext,
        session: {
          ...mockContext.session!,
          expiresAt: null as any, // null日付
        },
      };

      const condition = auth();

      // nullの日付は無効として扱われ、期限切れエラーになる
      await expect(condition({}, malformedExpiryContext)).rejects.toThrow(
        "Session has expired"
      );
    });

    it("should handle case-sensitive role matching", async () => {
      const condition = auth("Admin"); // 大文字のA

      await expect(condition({}, mockContext)).rejects.toThrow(ContractError);
      await expect(condition({}, mockContext)).rejects.toThrow(
        "Required role: Admin"
      );
    });

    it("should handle roles with special characters", async () => {
      const specialRoleContext = {
        ...mockContext,
        user: {
          ...mockContext.user!,
          roles: ["super-admin", "power_user", "role:with:colons"],
        },
      };

      const condition1 = auth("super-admin");
      const condition2 = auth("power_user");
      const condition3 = auth("role:with:colons");

      const result1 = await condition1({}, specialRoleContext);
      const result2 = await condition2({}, specialRoleContext);
      const result3 = await condition3({}, specialRoleContext);

      expect(result1).toBe(true);
      expect(result2).toBe(true);
      expect(result3).toBe(true);
    });
  });

  describe("input parameter handling", () => {
    it("should accept any input parameter", async () => {
      const condition = auth();

      const result1 = await condition("string input", mockContext);
      const result2 = await condition({ key: "object input" }, mockContext);
      const result3 = await condition(123, mockContext);
      const result4 = await condition(null, mockContext);

      expect(result1).toBe(true);
      expect(result2).toBe(true);
      expect(result3).toBe(true);
      expect(result4).toBe(true);
    });
  });

  describe("integration scenarios", () => {
    it("should work in typical admin access scenario", async () => {
      const adminContext = {
        user: {
          id: "admin001",
          username: "admin",
          roles: ["user", "admin", "super-admin"],
        },
        session: {
          id: "admin-session",
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24時間後
          createdAt: new Date().toISOString(),
        },
      };

      const adminCondition = auth("admin");
      const result = await adminCondition(
        { action: "delete", resourceId: "critical-data" },
        adminContext
      );

      expect(result).toBe(true);
    });

    it("should work in typical user access scenario", async () => {
      const userCondition = auth("user");
      const result = await userCondition({ userId: "user123" }, mockContext);

      expect(result).toBe(true);
    });

    it("should fail in privilege escalation attempt", async () => {
      const userOnlyContext = {
        user: {
          id: "user456",
          username: "normaluser",
          roles: ["user"],
        },
        session: {
          id: "user-session",
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
          createdAt: new Date().toISOString(),
        },
      };

      const adminCondition = auth("admin");

      await expect(
        adminCondition({ action: "admin-only" }, userOnlyContext)
      ).rejects.toThrow(ContractError);
      await expect(
        adminCondition({ action: "admin-only" }, userOnlyContext)
      ).rejects.toThrow("Required role: admin");
    });
  });
});
