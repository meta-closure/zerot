import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { owns } from "~/conditions/owns";
import { ContractError, ErrorCategory } from "~/core/errors";
import { AuthContext } from "~/core/types";

// getResource関数をモック化 - ホイスティング問題を避けるため変数参照を削除
vi.mock("~/core/types", async () => {
  const actual = await vi.importActual("../core/types");
  return {
    ...actual,
    getResource: vi.fn(),
  };
});

// モック関数をインポート後に取得
import { getResource } from "~/core/types";
const mockGetResource = vi.mocked(getResource);

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
    mockGetResource.mockResolvedValue({
      id: "resource123",
      userId: "user123", // ownerContextのユーザーIDと一致
    } as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("function creation", () => {
    it("should return a function", () => {
      const condition = owns("resourceId");
      expect(typeof condition).toBe("function");
    });

    it("should create different functions for different resource fields", () => {
      const condition1 = owns("documentId");
      const condition2 = owns("projectId");
      expect(condition1).not.toBe(condition2);
    });
  });

  describe("successful ownership validation", () => {
    it("should return true when user owns the resource", async () => {
      const condition = owns("resourceId");
      const input = { resourceId: "resource123" };

      const result = await condition(input, ownerContext);

      expect(result).toBe(true);
      expect(mockGetResource).toHaveBeenCalledWith("resource123");
      expect(mockGetResource).toHaveBeenCalledTimes(1);
    });

    it("should return true when admin accesses any resource", async () => {
      // 管理者は他のユーザーのリソースにもアクセス可能
      mockGetResource.mockResolvedValue({
        id: "resource456",
        userId: "other456", // 異なるユーザーID
      } as any);

      const condition = owns("resourceId");
      const input = { resourceId: "resource456" };

      const result = await condition(input, adminContext);

      expect(result).toBe(true);
      // 管理者の場合、getResourceが呼ばれない（バイパスされる）
      expect(mockGetResource).not.toHaveBeenCalled();
    });

    it("should work with different resource ID field names", async () => {
      const documentCondition = owns("documentId");
      const projectCondition = owns("projectId");
      const fileCondition = owns("fileId");

      const documentInput = { documentId: "doc123" };
      const projectInput = { projectId: "proj456" };
      const fileInput = { fileId: "file789" };

      await documentCondition(documentInput, ownerContext);
      await projectCondition(projectInput, ownerContext);
      await fileCondition(fileInput, ownerContext);

      expect(mockGetResource).toHaveBeenCalledWith("doc123");
      expect(mockGetResource).toHaveBeenCalledWith("proj456");
      expect(mockGetResource).toHaveBeenCalledWith("file789");
      expect(mockGetResource).toHaveBeenCalledTimes(3);
    });
  });

  describe("authentication failures", () => {
    it("should throw ContractError when user is not authenticated", async () => {
      const condition = owns("resourceId");
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

      expect(mockGetResource).not.toHaveBeenCalled();
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

      const condition = owns("resourceId");
      const input = { resourceId: "resource123" };

      await expect(condition(input, contextWithoutUserId)).rejects.toThrow(
        "User not authenticated for ownership check"
      );
    });
  });

  describe("validation failures", () => {
    it("should throw ContractError when resource ID field is missing", async () => {
      const condition = owns("resourceId");
      const input = {}; // resourceIdフィールドがない

      await expect(condition(input, ownerContext)).rejects.toThrow(
        ContractError
      );
      await expect(condition(input, ownerContext)).rejects.toThrow(
        "Resource ID field 'resourceId' is missing in input"
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

      expect(mockGetResource).not.toHaveBeenCalled();
    });

    it("should throw ContractError when resource ID is null or undefined", async () => {
      const condition = owns("resourceId");

      const nullInput = { resourceId: null };
      const undefinedInput = { resourceId: undefined };

      await expect(condition(nullInput, ownerContext)).rejects.toThrow(
        "Resource ID field 'resourceId' is missing in input"
      );
      await expect(condition(undefinedInput, ownerContext)).rejects.toThrow(
        "Resource ID field 'resourceId' is missing in input"
      );
    });

    it("should throw ContractError when resource ID is empty string", async () => {
      const condition = owns("resourceId");
      const input = { resourceId: "" };

      await expect(condition(input, ownerContext)).rejects.toThrow(
        "Resource ID field 'resourceId' is missing in input"
      );
    });
  });

  describe("resource not found failures", () => {
    it("should throw ContractError when resource is not found", async () => {
      mockGetResource.mockResolvedValue(null);

      const condition = owns("resourceId");
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

      expect(mockGetResource).toHaveBeenCalledWith("nonexistent123");
    });

    it("should throw ContractError when resource is undefined", async () => {
      mockGetResource.mockResolvedValue(null);

      const condition = owns("resourceId");
      const input = { resourceId: "undefined123" };

      await expect(condition(input, ownerContext)).rejects.toThrow(
        "Resource with ID undefined123 not found"
      );
    });
  });

  describe("ownership denial failures", () => {
    it("should throw ContractError when user does not own the resource", async () => {
      mockGetResource.mockResolvedValue({
        id: "resource123",
        userId: "other456", // 異なるユーザーID
      } as any);

      const condition = owns("resourceId");
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

      expect(mockGetResource).toHaveBeenCalledWith("resource123");
    });

    it("should handle case where resource userId is null", async () => {
      mockGetResource.mockResolvedValue({
        id: "resource123",
        userId: null, // nullのuserID
      } as any);

      const condition = owns("resourceId");
      const input = { resourceId: "resource123" };

      await expect(condition(input, ownerContext)).rejects.toThrow(
        "User user123 does not own resource resource123"
      );
    });
  });

  describe("admin privilege handling", () => {
    it("should bypass ownership check for admin users", async () => {
      const condition = owns("resourceId");
      const input = { resourceId: "any-resource" };

      const result = await condition(input, adminContext);

      expect(result).toBe(true);
      expect(mockGetResource).not.toHaveBeenCalled(); // 管理者はリソース検索をバイパス
    });

    it("should work with users having multiple roles including admin", async () => {
      const multiRoleAdminContext = {
        ...adminContext,
        user: {
          ...adminContext.user!,
          roles: ["user", "moderator", "admin", "super-admin"],
        },
      };

      const condition = owns("resourceId");
      const input = { resourceId: "any-resource" };

      const result = await condition(input, multiRoleAdminContext);

      expect(result).toBe(true);
      expect(mockGetResource).not.toHaveBeenCalled();
    });

    it("should not treat non-admin roles as admin", async () => {
      const nonAdminContext = {
        ...ownerContext,
        user: {
          ...ownerContext.user!,
          roles: ["user", "moderator", "viewer", "administrator"], // 'admin'ではない
        },
      };

      const condition = owns("resourceId");
      const input = { resourceId: "resource123" };

      const result = await condition(input, nonAdminContext);

      expect(result).toBe(true);
      expect(mockGetResource).toHaveBeenCalledWith("resource123"); // 通常の所有権チェックが実行される
    });
  });

  describe("roles undefined handling", () => {
    it("should handle users with undefined roles (not admin)", async () => {
      const condition = owns("resourceId");
      const input = { resourceId: "resource123" };

      // noRolesContextのユーザーIDに合わせてリソースのuserIdを設定
      mockGetResource.mockResolvedValue({
        id: "resource123",
        userId: "noroles123",
      } as any);

      const result = await condition(input, noRolesContext);

      expect(result).toBe(true);
      expect(mockGetResource).toHaveBeenCalledWith("resource123"); // 通常の所有権チェックが実行される
    });

    it("should not grant admin privileges to users with undefined roles", async () => {
      mockGetResource.mockResolvedValue({
        id: "resource123",
        userId: "other456", // 異なるユーザーID
      } as any);

      const condition = owns("resourceId");
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

      const condition = owns("resourceId");
      const input = { resourceId: "resource123" };

      const result = await condition(input, emptyRolesContext);

      expect(result).toBe(true);
      expect(mockGetResource).toHaveBeenCalledWith("resource123");
    });
  });

  describe("getResource error handling", () => {
    it("should propagate errors from getResource function", async () => {
      const resourceError = new Error("Database connection failed");
      mockGetResource.mockRejectedValue(resourceError);

      const condition = owns("resourceId");
      const input = { resourceId: "resource123" };

      await expect(condition(input, ownerContext)).rejects.toThrow(
        resourceError
      );
      expect(mockGetResource).toHaveBeenCalledWith("resource123");
    });

    it("should handle getResource throwing ContractError", async () => {
      const contractError = new ContractError(
        "Resource provider not configured",
        {
          code: "PROVIDER_NOT_CONFIGURED",
          category: ErrorCategory.AUTHENTICATION,
        }
      );
      mockGetResource.mockRejectedValue(contractError);

      const condition = owns("resourceId");
      const input = { resourceId: "resource123" };

      await expect(condition(input, ownerContext)).rejects.toThrow(
        contractError
      );
    });
  });

  describe("input parameter variations", () => {
    it("should handle complex input objects", async () => {
      const condition = owns("document.id"); // ネストしたフィールド名
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
      expect(mockGetResource).toHaveBeenCalledWith("doc123");
    });

    it("should handle numeric resource IDs", async () => {
      mockGetResource.mockResolvedValue({
        id: 12345,
        userId: "user123",
      } as any);

      const condition = owns("resourceId");
      const input = { resourceId: 12345 };

      const result = await condition(input, ownerContext);

      expect(result).toBe(true);
      expect(mockGetResource).toHaveBeenCalledWith(12345);
    });

    it("should handle special characters in resource field names", async () => {
      const specialFieldNames = [
        "resource-id",
        "resource_id",
        "resourceId$",
        "resource.id",
      ];

      for (const fieldName of specialFieldNames) {
        mockGetResource.mockClear();

        const condition = owns(fieldName);
        const input = { [fieldName]: "special123" };

        await condition(input, ownerContext);
        expect(mockGetResource).toHaveBeenCalledWith("special123");
      }
    });
  });

  describe("integration scenarios", () => {
    it("should work in document editing scenario", async () => {
      const documentCondition = owns("documentId");
      const editInput = {
        documentId: "doc123",
        content: "Updated content",
        version: 2,
      };

      mockGetResource.mockResolvedValue({
        id: "doc123",
        userId: "user123",
      } as any);

      const result = await documentCondition(editInput, ownerContext);

      expect(result).toBe(true);
      expect(mockGetResource).toHaveBeenCalledWith("doc123");
    });

    it("should work in project management scenario", async () => {
      const projectCondition = owns("projectId");
      const taskInput = {
        projectId: "proj456",
        taskName: "New Task",
        assignee: "user789",
      };

      mockGetResource.mockResolvedValue({
        id: "proj456",
        userId: "user123",
      } as any);

      const result = await projectCondition(taskInput, ownerContext);

      expect(result).toBe(true);
      expect(mockGetResource).toHaveBeenCalledWith("proj456");
    });

    it("should deny access in multi-tenant scenario", async () => {
      const fileCondition = owns("fileId");
      const deleteInput = {
        fileId: "file789",
        permanent: true,
      };

      // 他のテナントのファイル
      mockGetResource.mockResolvedValue({
        id: "file789",
        userId: "tenant2-user456",
      } as any);

      await expect(fileCondition(deleteInput, ownerContext)).rejects.toThrow(
        "User user123 does not own resource file789"
      );
    });

    it("should allow admin access in cross-tenant scenario", async () => {
      const fileCondition = owns("fileId");
      const adminInput = {
        fileId: "any-tenant-file",
        action: "admin-review",
      };

      // 管理者は任意のテナントのファイルにアクセス可能
      const result = await fileCondition(adminInput, adminContext);

      expect(result).toBe(true);
      expect(mockGetResource).not.toHaveBeenCalled(); // バイパスされる
    });
  });

  describe("performance and concurrency", () => {
    it("should handle concurrent ownership checks", async () => {
      const condition = owns("resourceId");

      const promises = Array.from({ length: 5 }, (_, i) =>
        condition({ resourceId: `resource${i}` }, ownerContext)
      );

      const results = await Promise.all(promises);

      expect(results).toEqual(Array(5).fill(true));
      expect(mockGetResource).toHaveBeenCalledTimes(5);
    });

    it("should handle slow getResource calls", async () => {
      mockGetResource.mockImplementation(async (resourceId) => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return {
          id: resourceId,
          userId: "user123",
        } as any;
      });

      const condition = owns("resourceId");
      const input = { resourceId: "slow-resource" };

      const startTime = Date.now();
      const result = await condition(input, ownerContext);
      const endTime = Date.now();

      expect(result).toBe(true);
      expect(endTime - startTime).toBeGreaterThanOrEqual(90);
    });
  });
});
