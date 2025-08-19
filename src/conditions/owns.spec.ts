import { owns } from "@/conditions/owns";
import { ContractError, ErrorCategory } from "@/core/errors";
import { AuthContext } from "@/core/types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// getResource関数をモック化
vi.mock("@/core/types", async () => {
  const actual = await vi.importActual("@/core/types");
  return {
    ...actual,
    getResource: vi.fn(),
  };
});

// モック関数をインポート後に取得
import { getResource } from "@/core/types";

describe("owns", () => {
  let ownerContext: AuthContext;
  let adminContext: AuthContext;
  let otherUserContext: AuthContext;
  let noUserContext: AuthContext;
  let noRolesContext: AuthContext;

  beforeEach(() => {
    // リソース所有者のコンテキスト
    ownerContext = {
      user: {
        id: "user123",
        username: "owner",
        roles: ["user"],
      },
      session: {
        id: "session456",
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        createdAt: new Date().toISOString(),
      },
    };

    // 管理者のコンテキスト
    adminContext = {
      user: {
        id: "admin123",
        username: "admin",
        roles: ["user", "admin"],
      },
      session: {
        id: "admin-session",
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        createdAt: new Date().toISOString(),
      },
    };

    // 他のユーザーのコンテキスト
    otherUserContext = {
      user: {
        id: "other456",
        username: "otheruser",
        roles: ["user"],
      },
      session: {
        id: "other-session",
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        createdAt: new Date().toISOString(),
      },
    };

    // ユーザーがいないコンテキスト
    noUserContext = {
      user: undefined,
      session: undefined,
    };

    // ロールが定義されていないユーザーのコンテキスト
    noRolesContext = {
      user: {
        id: "noroles123",
        username: "noroles",
        roles: undefined, // rolesがundefined
      },
      session: {
        id: "noroles-session",
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        createdAt: new Date().toISOString(),
      },
    };

    // デフォルトのモックリソース
    vi.mocked(getResource).mockResolvedValue({
      id: "resource123",
      userId: "user123", // ownerContextのユーザーIDと一致
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("function creation", () => {
    it("should return a function", () => {
      const condition = owns<{ resourceId: string }>("resourceId");
      expect(typeof condition).toBe("function");
    });

    it("should create different functions for different resource fields", () => {
      const condition1 = owns<{ documentId: string }>("documentId");
      const condition2 = owns<{ projectId: string }>("projectId");
      expect(condition1).not.toBe(condition2);
    });
  });

  describe("successful ownership validation", () => {
    it("should return true when user owns the resource", async () => {
      const condition = owns<{ resourceId: string }>("resourceId");
      const input = { resourceId: "resource123" };

      const result = await condition(input, ownerContext);

      expect(result).toBe(true);
      expect(vi.mocked(getResource)).toHaveBeenCalledWith("resource123");
      expect(vi.mocked(getResource)).toHaveBeenCalledTimes(1);
    });

    it("should return true when admin accesses any resource", async () => {
      // 管理者は他のユーザーのリソースにもアクセス可能
      vi.mocked(getResource).mockResolvedValue({
        id: "resource456",
        userId: "other456", // 異なるユーザーID
      });

      const condition = owns<{ resourceId: string }>("resourceId");
      const input = { resourceId: "resource456" };

      const result = await condition(input, adminContext);

      expect(result).toBe(true);
      // 管理者の場合、getResourceが呼ばれない（バイパスされる）
      expect(vi.mocked(getResource)).not.toHaveBeenCalled();
    });

    it("should work with different resource ID field names", async () => {
      const documentCondition = owns<{ documentId: string }>("documentId");
      const projectCondition = owns<{ projectId: string }>("projectId");
      const fileCondition = owns<{ fileId: string }>("fileId");

      const documentInput = { documentId: "doc123" };
      const projectInput = { projectId: "proj456" };
      const fileInput = { fileId: "file789" };

      await documentCondition(documentInput, ownerContext);
      await projectCondition(projectInput, ownerContext);
      await fileCondition(fileInput, ownerContext);

      expect(vi.mocked(getResource)).toHaveBeenCalledWith("doc123");
      expect(vi.mocked(getResource)).toHaveBeenCalledWith("proj456");
      expect(vi.mocked(getResource)).toHaveBeenCalledWith("file789");
      expect(vi.mocked(getResource)).toHaveBeenCalledTimes(3);
    });
  });

  describe("authentication failures", () => {
    it("should throw ContractError when user is not authenticated", async () => {
      const condition = owns<{ resourceId: string }>("resourceId");
      const input = { resourceId: "resource123" };

      await expect(condition(input, noUserContext)).rejects.toThrow(
        ContractError
      );
      await expect(condition(input, noUserContext)).rejects.toThrow(
        "User not authenticated for ownership check"
      );

      try {
        await condition(input, noUserContext);
      } catch (error) {
        expect(error).toBeInstanceOf(ContractError);
        expect((error as ContractError).code).toBe("AUTHENTICATION_REQUIRED");
        expect((error as ContractError).category).toBe(
          ErrorCategory.AUTHENTICATION
        );
      }

      expect(vi.mocked(getResource)).not.toHaveBeenCalled();
    });

    it("should throw ContractError when user ID is missing", async () => {
      const contextWithoutUserId = {
        user: {
          id: "", // 空のID
          username: "test",
          roles: ["user"],
        },
        session: ownerContext.session,
      };

      const condition = owns<{ resourceId: string }>("resourceId");
      const input = { resourceId: "resource123" };

      await expect(condition(input, contextWithoutUserId)).rejects.toThrow(
        "User not authenticated for ownership check"
      );
    });
  });

  describe("validation failures", () => {
    it("should throw ContractError when resource ID field is missing", async () => {
      const condition = owns<{ resourceId: string }>("resourceId");
      const input = {} as { resourceId: string }; // resourceIdフィールドがない

      await expect(condition(input, ownerContext)).rejects.toThrow(
        ContractError
      );
      await expect(condition(input, ownerContext)).rejects.toThrow(
        "Resource ID field 'resourceId' is missing or invalid in input"
      );

      try {
        await condition(input, ownerContext);
      } catch (error) {
        expect(error).toBeInstanceOf(ContractError);
        expect((error as ContractError).code).toBe("MISSING_RESOURCE_ID");
        expect((error as ContractError).category).toBe(
          ErrorCategory.VALIDATION
        );
      }

      expect(vi.mocked(getResource)).not.toHaveBeenCalled();
    });

    it("should throw ContractError when resource ID is null or undefined", async () => {
      const condition = owns<{ resourceId: string | null | undefined }>(
        "resourceId"
      );

      const nullInput = { resourceId: null };
      const undefinedInput = { resourceId: undefined };

      await expect(condition(nullInput, ownerContext)).rejects.toThrow(
        "Resource ID field 'resourceId' is missing or invalid in input"
      );
      await expect(condition(undefinedInput, ownerContext)).rejects.toThrow(
        "Resource ID field 'resourceId' is missing or invalid in input"
      );
    });

    it("should throw ContractError when resource ID is empty string", async () => {
      const condition = owns<{ resourceId: string }>("resourceId");
      const input = { resourceId: "" };

      await expect(condition(input, ownerContext)).rejects.toThrow(
        "Resource ID field 'resourceId' is missing or invalid in input"
      );
    });
  });

  describe("resource not found failures", () => {
    it("should throw ContractError when resource is not found", async () => {
      vi.mocked(getResource).mockResolvedValue(null);

      const condition = owns<{ resourceId: string }>("resourceId");
      const input = { resourceId: "nonexistent123" };

      await expect(condition(input, ownerContext)).rejects.toThrow(
        ContractError
      );
      await expect(condition(input, ownerContext)).rejects.toThrow(
        "Resource with ID nonexistent123 not found"
      );

      try {
        await condition(input, ownerContext);
      } catch (error) {
        expect(error).toBeInstanceOf(ContractError);
        expect((error as ContractError).code).toBe("RESOURCE_NOT_FOUND");
        expect((error as ContractError).category).toBe(
          ErrorCategory.BUSINESS_LOGIC
        );
      }

      expect(vi.mocked(getResource)).toHaveBeenCalledWith("nonexistent123");
    });

    it("should throw ContractError when resource is undefined", async () => {
      vi.mocked(getResource).mockResolvedValue(null);

      const condition = owns<{ resourceId: string }>("resourceId");
      const input = { resourceId: "undefined123" };

      await expect(condition(input, ownerContext)).rejects.toThrow(
        "Resource with ID undefined123 not found"
      );
    });
  });

  describe("ownership denial failures", () => {
    it("should throw ContractError when user does not own the resource", async () => {
      vi.mocked(getResource).mockResolvedValue({
        id: "resource123",
        userId: "other456", // 異なるユーザーID
      });

      const condition = owns<{ resourceId: string }>("resourceId");
      const input = { resourceId: "resource123" };

      await expect(condition(input, ownerContext)).rejects.toThrow(
        ContractError
      );
      await expect(condition(input, ownerContext)).rejects.toThrow(
        "User user123 does not own resource resource123"
      );

      try {
        await condition(input, ownerContext);
      } catch (error) {
        expect(error).toBeInstanceOf(ContractError);
        expect((error as ContractError).code).toBe("OWNERSHIP_DENIED");
        expect((error as ContractError).category).toBe(
          ErrorCategory.AUTHORIZATION
        );
      }

      expect(vi.mocked(getResource)).toHaveBeenCalledWith("resource123");
    });
  });

  describe("admin privilege handling", () => {
    it("should bypass ownership check for admin users", async () => {
      const condition = owns<{ resourceId: string }>("resourceId");
      const input = { resourceId: "any-resource" };

      const result = await condition(input, adminContext);

      expect(result).toBe(true);
      expect(vi.mocked(getResource)).not.toHaveBeenCalled(); // 管理者はリソース検索をバイパス
    });

    it("should work with users having multiple roles including admin", async () => {
      const multiRoleAdminContext = {
        ...adminContext,
        user: {
          ...adminContext.user!,
          roles: ["user", "moderator", "admin", "super-admin"],
        },
      };

      const condition = owns<{ resourceId: string }>("resourceId");
      const input = { resourceId: "any-resource" };

      const result = await condition(input, multiRoleAdminContext);

      expect(result).toBe(true);
      expect(vi.mocked(getResource)).not.toHaveBeenCalled();
    });

    it("should not treat non-admin roles as admin", async () => {
      const nonAdminContext = {
        ...ownerContext,
        user: {
          ...ownerContext.user!,
          roles: ["user", "moderator", "viewer", "administrator"], // 'admin'ではない
        },
      };

      const condition = owns<{ resourceId: string }>("resourceId");
      const input = { resourceId: "resource123" };

      const result = await condition(input, nonAdminContext);

      expect(result).toBe(true);
      expect(vi.mocked(getResource)).toHaveBeenCalledWith("resource123"); // 通常の所有権チェックが実行される
    });
  });

  describe("roles undefined handling", () => {
    it("should handle users with undefined roles (not admin)", async () => {
      const condition = owns<{ resourceId: string }>("resourceId");
      const input = { resourceId: "resource123" };

      // noRolesContextのユーザーIDに合わせてリソースのuserIdを設定
      vi.mocked(getResource).mockResolvedValue({
        id: "resource123",
        userId: "noroles123",
      });

      const result = await condition(input, noRolesContext);

      expect(result).toBe(true);
      expect(vi.mocked(getResource)).toHaveBeenCalledWith("resource123"); // 通常の所有権チェックが実行される
    });

    it("should not grant admin privileges to users with undefined roles", async () => {
      vi.mocked(getResource).mockResolvedValue({
        id: "resource123",
        userId: "other456", // 異なるユーザーID
      });

      const condition = owns<{ resourceId: string }>("resourceId");
      const input = { resourceId: "resource123" };

      // rolesがundefinedのユーザーは管理者権限を持たない
      await expect(condition(input, noRolesContext)).rejects.toThrow(
        "User noroles123 does not own resource resource123"
      );
    });

    it("should handle users with empty roles array", async () => {
      const emptyRolesContext = {
        ...ownerContext,
        user: {
          ...ownerContext.user!,
          roles: [], // 空の配列
        },
      };

      const condition = owns<{ resourceId: string }>("resourceId");
      const input = { resourceId: "resource123" };

      const result = await condition(input, emptyRolesContext);

      expect(result).toBe(true);
      expect(vi.mocked(getResource)).toHaveBeenCalledWith("resource123");
    });
  });

  describe("getResource error handling", () => {
    it("should wrap errors from getResource function in ContractError", async () => {
      const resourceError = new Error("Database connection failed");
      vi.mocked(getResource).mockRejectedValue(resourceError);

      const condition = owns<{ resourceId: string }>("resourceId");
      const input = { resourceId: "resource123" };

      await expect(condition(input, ownerContext)).rejects.toThrow(
        ContractError
      );
      await expect(condition(input, ownerContext)).rejects.toThrow(
        "Failed to check resource ownership: Database connection failed"
      );

      expect(vi.mocked(getResource)).toHaveBeenCalledWith("resource123");
    });

    it("should re-throw ContractError from getResource", async () => {
      const contractError = new ContractError(
        "Resource provider not configured",
        {
          code: "PROVIDER_NOT_CONFIGURED",
          category: ErrorCategory.AUTHENTICATION,
        }
      );
      vi.mocked(getResource).mockRejectedValue(contractError);

      const condition = owns<{ resourceId: string }>("resourceId");
      const input = { resourceId: "resource123" };

      await expect(condition(input, ownerContext)).rejects.toThrow(
        contractError
      );
    });
  });

  describe("input parameter variations", () => {
    it("should handle complex input objects", async () => {
      const condition = owns<{ "document.id": string }>("document.id");
      const input = {
        "document.id": "doc123",
        title: "Test Document",
        content: "Document content",
        metadata: {
          created: new Date(),
          author: "user123",
        },
      };

      const result = await condition(input, ownerContext);

      expect(result).toBe(true);
      expect(vi.mocked(getResource)).toHaveBeenCalledWith("doc123");
    });

    it("should handle numeric resource IDs", async () => {
      vi.mocked(getResource).mockResolvedValue({
        id: "12345",
        userId: "user123",
      });

      const condition = owns<{ resourceId: number }>("resourceId");
      const input = { resourceId: 12345 };

      const result = await condition(input, ownerContext);

      expect(result).toBe(true);
      expect(vi.mocked(getResource)).toHaveBeenCalledWith("12345");
    });
  });

  describe("integration scenarios", () => {
    it("should work in document editing scenario", async () => {
      const documentCondition = owns<{ documentId: string }>("documentId");
      const editInput = {
        documentId: "doc123",
        content: "Updated content",
        version: 2,
      };

      vi.mocked(getResource).mockResolvedValue({
        id: "doc123",
        userId: "user123",
      });

      const result = await documentCondition(editInput, ownerContext);

      expect(result).toBe(true);
      expect(vi.mocked(getResource)).toHaveBeenCalledWith("doc123");
    });

    it("should work in project management scenario", async () => {
      const projectCondition = owns<{ projectId: string }>("projectId");
      const taskInput = {
        projectId: "proj456",
        taskName: "New Task",
        assignee: "user789",
      };

      vi.mocked(getResource).mockResolvedValue({
        id: "proj456",
        userId: "user123",
      });

      const result = await projectCondition(taskInput, ownerContext);

      expect(result).toBe(true);
      expect(vi.mocked(getResource)).toHaveBeenCalledWith("proj456");
    });

    it("should deny access in multi-tenant scenario", async () => {
      const fileCondition = owns<{ fileId: string }>("fileId");
      const deleteInput = {
        fileId: "file789",
        permanent: true,
      };

      // 他のテナントのファイル
      vi.mocked(getResource).mockResolvedValue({
        id: "file789",
        userId: "tenant2-user456",
      });

      await expect(fileCondition(deleteInput, ownerContext)).rejects.toThrow(
        "User user123 does not own resource file789"
      );
    });

    it("should allow admin access in cross-tenant scenario", async () => {
      const fileCondition = owns<{ fileId: string }>("fileId");
      const adminInput = {
        fileId: "any-tenant-file",
        action: "admin-review",
      };

      // 管理者は任意のテナントのファイルにアクセス可能
      const result = await fileCondition(adminInput, adminContext);

      expect(result).toBe(true);
      expect(vi.mocked(getResource)).not.toHaveBeenCalled(); // バイパスされる
    });
  });
});
