import { setSessionProvider, getAuthContext, AuthContext } from "zerot/core/types";

describe("types.ts", () => {
  beforeEach(() => {
    // Reset session provider before each test
    setSessionProvider(undefined as any); // Clear any previously set provider
  });

  describe("setSessionProvider and getAuthContext", () => {
    it("should set and retrieve the session context from a synchronous provider", async () => {
      const mockContext: AuthContext = { user: { id: "test-user", roles: ["guest"] } };
      setSessionProvider(() => mockContext);
      const context = await getAuthContext();
      expect(context).toEqual(mockContext);
    });

    it("should set and retrieve the session context from an asynchronous provider", async () => {
      const mockContext: AuthContext = { user: { id: "async-user", roles: ["admin"] } };
      setSessionProvider(async () => Promise.resolve(mockContext));
      const context = await getAuthContext();
      expect(context).toEqual(mockContext);
    });

    it("should return an empty context if no session provider is set", async () => {
      const context = await getAuthContext();
      expect(context).toEqual({});
    });

    it("should return the latest context if session provider is updated", async () => {
      const initialContext: AuthContext = { user: { id: "initial", roles: [] } };
      setSessionProvider(() => initialContext);
      let context = await getAuthContext();
      expect(context).toEqual(initialContext);

      const updatedContext: AuthContext = { user: { id: "updated", roles: ["user"] } };
      setSessionProvider(() => updatedContext);
      context = await getAuthContext();
      expect(context).toEqual(updatedContext);
    });
  });

  describe("AuthContext interface", () => {
    it("should allow custom properties on user and session", () => {
      const context: AuthContext = {
        user: {
          id: "user1",
          roles: ["role1"],
          customUserProp: "value1",
        },
        session: {
          id: "session1",
          expiresAt: new Date(),
          customSessionProp: 123,
        },
        globalCustomProp: true,
      };

      expect(context.user?.id).toBe("user1");
      expect(context.user?.roles).toEqual(["role1"]);
      expect((context.user as any).customUserProp).toBe("value1");
      expect(context.session?.id).toBe("session1");
      expect((context.session as any).customSessionProp).toBe(123);
      expect(context.globalCustomProp).toBe(true);
    });

    it("should allow empty user and session", () => {
      const context: AuthContext = {};
      expect(context.user).toBeUndefined();
      expect(context.session).toBeUndefined();
    });
  });
});
