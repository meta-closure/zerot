# Zerot: Design by Contract for TypeScript

https://meta-closure.github.io/zerot/

[![pages-build-deployment](https://github.com/meta-closure/zerot/actions/workflows/pages/pages-build-deployment/badge.svg)](https://github.com/meta-closure/zerot/actions/workflows/pages/pages-build-deployment)

Zerot is a powerful TypeScript library that brings the principles of Design by Contract (DbC) to your applications, with a strong focus on robust backend logic and seamless integration with Next.js Server Actions and Middleware. It allows you to define clear pre-conditions, post-conditions, and invariants for your methods, ensuring predictable behavior and enhancing code reliability.

## Features

- **Contract Decorator (`@contract`):** Easily apply contracts to any method in your TypeScript classes.
- **Pre-conditions (`requires`):** Define conditions that must be met before a method executes. Includes input validation and authentication checks.
- **Post-conditions (`ensures`)::** Define conditions that must be true after a method completes successfully. Includes output validation and auditing.
- **Invariants (`invariants`):** Define conditions that must remain true throughout the method's execution, often related to object state.
- **Built-in Conditions:** A set of ready-to-use conditions for common scenarios like authentication, ownership, data validation (with Zod), rate limiting, and auditing.
- **Next.js Integration:**
  - `createServerAction`: A helper to wrap Next.js Server Actions, automatically handling contract violations and providing appropriate responses (e.g., redirects, error messages).
  - `withContractMiddleware`: A helper for Next.js Middleware to catch and handle contract violations at the middleware level.
- **Flexible Authentication Context:** Integrate with your existing authentication system by providing a session provider.
- **Error Handling:** Provides `ContractError` and `ContractViolationError` for structured error management.
- **Utilities:** Includes tools for debugging, performance monitoring, and optimizing contract systems.
- **Comprehensive JSDoc Documentation:** The entire codebase is thoroughly documented with JSDoc comments, providing detailed explanations for all functions, classes, interfaces, and types, enhancing developer experience and maintainability.
- **VSCode Extension:** Provides enhanced support for Zerot in VSCode, including syntax highlighting for `@contract` decorator and related keywords (`requires`, `ensures`, `invariants`), and built-in conditions (`auth`, `validates`, `rateLimit`, `auditLog`, `owns`, `returns`, `businessRule`). Future updates will include auto-completion and basic error detection for common Zerot usage patterns.

## Development

### Hot-Reloading

For development, you can use the `dev` script to enable hot-reloading. This will automatically restart the application when changes are detected in your source files.

To start the development server with hot-reloading:

```bash
npm run dev
```

## Installation

```bash
npm install zerot zod
# or
yarn add zerot zod
```

## Usage

### 1. Define your Authentication and Resource Contexts

First, set up a session provider and a resource provider that `Zerot` can use to retrieve the authentication context and resources for ownership checks. This is typically done once at your application's entry point.

```typescript
// lib/providers.ts
import {
  setSessionProvider,
  setResourceProvider,
  AuthContext,
} from "zerot/core";
import { getServerSession } from "./auth/config"; // Your actual session retrieval logic
import { getResourceFromDatabase } from "./data/resourceRepository"; // Your actual resource retrieval logic

export async function configureZerotProviders() {
  // Configure Session Provider
  setSessionProvider(async () => {
    const session = await getServerSession(); // Replace with your actual session logic (e.g., NextAuth.js)
    return {
      user: session?.user
        ? {
            id: session.user.id,
            roles: session.user.roles || [],
            email: session.user.email,
            // ... any other user properties
          }
        : undefined,
      session: session
        ? {
            id: session.sessionToken,
            expiresAt: new Date(session.expires),
            // ... any other session properties
          }
        : undefined,
      // Add any other custom context data here
    } as AuthContext;
  });

  // Configure Resource Provider for ownership checks
  setResourceProvider(async (resourceId: string) => {
    // Replace with your actual logic to fetch a resource by ID from your database or API
    // This function should return an object with 'id' and 'userId' properties, or null if not found.
    const resource = await getResourceFromDatabase(resourceId);
    return resource; // Assuming getResourceFromDatabase returns { id: string; userId: string } | null
  });
}

// In your main application entry point (e.g., layout.tsx or a global setup file)
// configureZerotProviders();
```

### 2. Apply Contracts to Methods

Use the `@contract` decorator on your class methods. You can define `requires`, `ensures`, and `invariants` using the built-in conditions or your custom logic.

```typescript
// lib/actions/users.ts (Example using Next.js Server Actions)
"use server"; // Required for Next.js Server Actions

import { contract } from "zerot/core";
import {
  auth,
  validates,
  rateLimit,
  auditLog,
  owns,
  returns,
  businessRule,
} from "zerot/conditions";
import type { AuthContext } from "zerot/core";
import { z } from "zod"; // Assuming you use Zod for validation

// Define your schemas (e.g., using Zod)
const userUpdateSchema = z.object({
  userId: z.string(),
  name: z.string().min(1),
  email: z.string().email(),
});
type UserUpdateInput = z.infer<typeof userUpdateSchema>;

const userOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  roles: z.array(z.string()),
});

// Mock user service
const userService = {
  updateUser: async (input: UserUpdateInput, context: AuthContext) => {
    console.log(
      `Updating user ${input.userId} with name ${input.name} and email ${input.email}`
    );
    console.log("Context:", context);
    // Simulate database update
    return {
      id: input.userId,
      name: input.name,
      email: input.email,
      roles: ["user"],
    };
  },
  // ... other user service methods
};

class UserActions {
  @contract({
    requires: [
      auth("user"), // Requires the user to be authenticated with 'user' role
      validates(userUpdateSchema), // Validates input against Zod schema
      rateLimit("updateProfile", 5), // Limits this action to 5 calls per period
    ],
    ensures: [
      returns(userOutputSchema), // Ensures the return value matches the schema
      auditLog("profile_update"), // Logs the action for auditing
    ],
    layer: "action", // Categorizes this contract as part of the action layer
  })
  async updateProfile(
    input: UserUpdateInput,
    context: AuthContext
  ): Promise<z.infer<typeof userOutputSchema>> {
    return userService.updateUser(input, context);
  }

  @contract({
    requires: [
      auth("admin"), // Requires the user to be an 'admin'
      validates(z.object({ userId: z.string() })),
      owns("userId"), // Requires the authenticated user to own the resource specified by 'userId'
      rateLimit("deleteProfile", 1),
    ],
    ensures: [auditLog("profile_deletion")],
    layer: "action",
  })
  async deleteProfile(
    input: { userId: string },
    context: AuthContext
  ): Promise<{ success: boolean }> {
    await userService.deleteUser(input.userId, context);
    return { success: true };
  }
}

export const userActions = new UserActions();
```

### 3. Integrate with Next.js Server Actions

Wrap your Server Action entry points with `createServerAction` to automatically handle contract violations.

```typescript
// lib/actions/users.ts (continued)
import { createServerAction, ContractViolationError } from "zerot";
import { redirect } from "next/navigation";

export const updateProfile = createServerAction(async (formData: FormData) => {
  const session = await getServerSession(); // Your session logic
  const context: AuthContext = {
    user: session?.user
      ? { id: session.user.id, roles: session.user.roles }
      : undefined,
    // ... other context properties
  };

  const input: UserUpdateInput = {
    userId: formData.get("userId") as string,
    name: formData.get("name") as string,
    email: formData.get("email") as string,
  };

  await userActions.updateProfile(input, context);
  // No explicit return needed for success, createServerAction handles it.
});

// Example usage in a React component:
// import { updateProfile } from "@/lib/actions/users";
// <form action={updateProfile}>...</form>
```

### 4. Integrate with Next.js Middleware

Use `withContractMiddleware` in your `middleware.ts` to handle contract violations globally.

```typescript
// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { withContractMiddleware } from "zerot";
import { configureAuthContext } from "./lib/auth/sessionProvider"; // Your session provider setup

// Configure the session provider once for the middleware
configureAuthContext();

async function middlewareHandler(request: NextRequest) {
  // Your middleware logic here
  // For example, check authentication or apply global rules
  // If a contract violation occurs in a deeper layer and bubbles up,
  // withContractMiddleware will catch it.
  return NextResponse.next();
}

export const middleware = withContractMiddleware(middlewareHandler);

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
```

## API Reference

### `contract(options: ContractOptions)`

A decorator to apply Design by Contract principles to methods.

- `options.requires`: An array of `ContractCondition` or `ContractValidator` functions.
- `options.ensures`: An array of `ContractEnsuresCondition` functions that run after the method.
- `options.invariants`: An array of `ContractInvariant` functions.
- `options.layer`: (Optional) A string indicating the layer of the application (e.g., "presentation", "action", "business", "data"). Used for error reporting.

**Note on Conditions:** `ContractCondition`, `ContractEnsuresCondition`, and `ContractInvariant` functions can return `true` (or a Promise resolving to `true`) for success, or a `ContractError` instance (or a Promise resolving to `ContractError`) to indicate a specific failure. Returning `false` is also supported but will result in a generic `ContractError`.

### Conditions

Zerot provides several built-in conditions:

- `auth(requiredRole?: string)`: Checks if a user is authenticated and optionally has a specific role.
- `owns(property: string)`: Checks if the authenticated user owns the resource identified by `property` in the input. Requires a resource provider to be set via `setResourceProvider`.
- `validates(schema: ZodSchema)`: Validates the input against a Zod schema. Can also transform the input.
- `returns(schema: ZodSchema)`: Validates the method's return value against a Zod schema. Returns `true` on success or a `ContractError` on failure.
- `rateLimit(key: string, limit: number, windowMs?: number)`: Implements rate limiting for the method.
- `auditLog(eventName: string)`: Logs an audit event after the method executes.
- `businessRule(ruleFn: (input: any, context: AuthContext) => boolean | Promise<boolean>)`: Allows defining custom business rules as conditions.

### Utilities

- `ContractDebugger`: Provides debugging capabilities for contracts.
- `ContractPerformanceMonitor`: Monitors the performance of contract executions.

### Integrations

- `createServerAction`: Wraps a Next.js Server Action to integrate with Zerot's contract system.
- `withContractMiddleware`: Wraps a Next.js Middleware function to handle `ContractViolationError`s.

### Types

- `AuthContext`: Interface for the authentication and session context.
- `ContractOptions`: Interface for the options passed to the `@contract` decorator.
- `ContractError`: Base error class for contract-related issues.
- `ContractViolationError`: An error indicating a contract violation, containing details about the violated contract.

## Contributing

Contributions are welcome! Please feel free to open issues or submit pull requests.

## License

This project is licensed under the MIT License.
