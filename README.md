# Zerot: Design by Contract for TypeScript

[![npm version](https://badge.fury.io/js/zerot.svg)](https://badge.fury.io/js/zerot)
[![npm downloads](https://img.shields.io/npm/dm/zerot.svg)](https://www.npmjs.com/package/zerot)
[![license](https://img.shields.io/npm/l/zerot.svg)](https://github.com/meta-closure/zerot/blob/main/LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)

> **🚀 A powerful TypeScript library that brings Design by Contract (DbC) principles to your applications with zero-trust architecture and AI-friendly development patterns.**

Zerot enables you to define clear **pre-conditions**, **post-conditions**, and **invariants** for your methods, ensuring predictable behavior, enhanced security, and improved code reliability. Perfect for building robust backend APIs, Next.js applications, and enterprise-grade systems.

## ✨ Features

### 🎯 Core Contract System

- **`@contract` Decorator**: Apply contracts to any TypeScript method with elegant syntax
- **Pre-conditions (`requires`)**: Input validation, authentication, and business rules
- **Post-conditions (`ensures`)**: Output validation, audit logging, and state verification
- **Invariants**: Conditions that must hold throughout method execution
- **Type Safety**: Full TypeScript support with generic type inference

### 🛡️ Built-in Security Conditions

- **`auth(role?)`**: Authentication and role-based access control
- **`owns(resourceField)`**: Resource ownership verification
- **`rateLimit(operation, limit)`**: Built-in rate limiting with configurable stores
- **`auditLog(action)`**: Comprehensive audit trail logging
- **`businessRule(description, rule)`**: Custom business logic validation

### 🔧 Advanced Features

- **Input/Output Validation**: Zod schema integration with automatic transformation
- **Performance Monitoring**: Built-in metrics and execution time tracking
- **Error Handling**: Intelligent error classification and recovery strategies
- **Template System**: Pre-built contract templates for common patterns
- **Framework Integration**: First-class support for Next.js, Express, and more
- **Zero Configuration**: Sensible defaults with extensive customization options

### 🌟 Developer Experience

- **AI-Friendly**: Structured error messages and clear contract documentation
- **Type-Safe**: Full TypeScript support with intelligent type inference
- **Testing Support**: Built-in test utilities and contract verification
- **Debug Mode**: Detailed execution tracing and performance insights
- **Hot Reload**: Development-friendly with fast refresh support

## 🚀 Quick Start

### Installation

```bash
npm install zerot
# or
yarn add zerot
# or
pnpm add zerot
```

### Basic Setup

```typescript
import { configureZerot } from "zerot/config";

// Configure Zerot once at application startup
await configureZerot({
  sessionProvider: async () => {
    // Return current user session from your auth system
    const session = await getCurrentSession();
    return {
      user: session?.user
        ? {
            id: session.user.id,
            roles: session.user.roles || ["user"],
          }
        : undefined,
    };
  },
});
```

### Your First Contract

```typescript
import { contract, auth, validates, returns, auditLog } from "zerot";
import { z } from "zod";

const UserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  age: z.number().min(13),
});

const UserOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  createdAt: z.date(),
});

class UserService {
  @contract({
    requires: [
      auth("user"), // Must be authenticated
      validates(UserSchema), // Input validation
    ],
    ensures: [
      returns(UserOutputSchema), // Output validation
      auditLog("user_created"), // Audit logging
    ],
    layer: "business",
  })
  async createUser(input: z.infer<typeof UserSchema>) {
    // Your business logic here
    const user = await this.userRepository.create({
      ...input,
      id: generateId(),
      createdAt: new Date(),
    });

    return user;
  }
}
```

## 📚 Core Concepts

### Contracts Structure

Every contract has three optional sections:

```typescript
@contract({
  requires: [    // Pre-conditions (validated before method execution)
    auth("user"),
    validates(InputSchema),
    businessRule("Custom validation", (input) => input.isValid),
  ],
  ensures: [     // Post-conditions (validated after method execution)
    returns(OutputSchema),
    auditLog("action_performed"),
  ],
  invariants: [  // Conditions that must hold before AND after
    systemHealthCheck,
  ],
  layer: "business",     // Optional: application layer classification
  retryAttempts: 3,      // Optional: retry failed operations
})
```

### Condition Types

#### Pre-conditions (`requires`)

Validate inputs and context before method execution:

- Authentication checks
- Input validation
- Business rule verification
- Rate limiting
- Resource access control

#### Post-conditions (`ensures`)

Validate outputs and side effects after method execution:

- Output schema validation
- Audit logging
- State consistency checks
- Notification sending

#### Invariants

Conditions that must be true both before and after method execution:

- System health checks
- Database consistency
- Global state validation

## 🔐 Built-in Conditions

### Authentication & Authorization

```typescript
// Authentication
auth(); // Any authenticated user
auth("admin"); // Must have 'admin' role
auth("user"); // Must have 'user' role

// Resource ownership
owns("documentId"); // User must own the document
owns("projectId"); // User must own the project
```

### Input & Output Validation

```typescript
import { z } from "zod";

// Input validation with Zod
validates(UserSchema);

// Input validation with transformation
validates(UserSchema, (user) => ({
  ...user,
  fullName: `${user.firstName} ${user.lastName}`,
}));

// Output validation
returns(UserOutputSchema);
```

### Rate Limiting

```typescript
// Rate limiting
rateLimit("api_call", 100); // 100 requests per minute
rateLimit("upload", 5, 60000); // 5 uploads per minute
rateLimit("login", 3, 300000); // 3 login attempts per 5 minutes
```

### Business Rules

```typescript
// Simple business rules
businessRule("Amount must be positive", (input) => input.amount > 0);

// Async business rules
businessRule("User must have sufficient balance", async (input, context) => {
  const balance = await getBalance(context.user.id);
  return balance >= input.amount;
});
```

### Audit Logging

```typescript
// Simple audit log
auditLog("user_created");

// Detailed audit log
auditLog("sensitive_data_accessed", {
  sensitivity: "high",
  dataType: "personal_info",
});
```

## 🎨 Contract Templates

Zerot provides pre-built templates for common patterns:

### CRUD Operations

```typescript
import { ContractTemplates } from "zerot/templates";

class UserService {
  // Basic CRUD with authentication
  @contract(
    ContractTemplates.crud({
      role: "user",
      operation: "create",
      inputSchema: UserSchema,
      outputSchema: UserOutputSchema,
    })
  )
  async createUser(input: UserInput) {
    /* ... */
  }

  // Secured CRUD with ownership check
  @contract(
    ContractTemplates.secureCRUD({
      role: "user",
      operation: "update",
      resourceField: "userId",
      inputSchema: UserUpdateSchema,
      outputSchema: UserOutputSchema,
    })
  )
  async updateUser(input: UserUpdateInput) {
    /* ... */
  }
}
```

### API Endpoints

```typescript
class APIController {
  // Public API endpoint
  @contract(
    ContractTemplates.publicAPI("get_users", {
      rateLimit: 100,
      outputSchema: UsersListSchema,
    })
  )
  async getUsers() {
    /* ... */
  }

  // Admin-only endpoint
  @contract(
    ContractTemplates.adminOnly("user_management", {
      inputSchema: AdminActionSchema,
      auditLevel: "high",
    })
  )
  async adminAction(input: AdminActionInput) {
    /* ... */
  }
}
```

### Extended Templates

```typescript
import { ExtendedContractTemplates } from "zerot/templates";

class ServiceLayer {
  // Database operations with retry
  @contract(
    ExtendedContractTemplates.databaseOperation({
      operation: "user_query",
      retryAttempts: 3,
      timeoutMs: 5000,
    })
  )
  async searchUsers(query: string) {
    /* ... */
  }

  // Secure operations with full validation
  @contract(
    ExtendedContractTemplates.secureCRUD({
      role: "user",
      resourceField: "userId",
      inputSchema: UserUpdateSchema,
      outputSchema: UserOutputSchema,
      operation: "update_profile",
      rateLimit: 10,
    })
  )
  async updateProfile(input: UserUpdateInput) {
    /* ... */
  }
}
```

### Functional Composition

```typescript
import { ContractHelpers } from "zerot/templates";

// Compose contracts functionally
@contract(
  ContractHelpers.combine(
    ContractHelpers.authenticated("user"),
    ContractHelpers.validated(InputSchema, OutputSchema),
    ContractHelpers.rateLimited("operation", 10),
    ContractHelpers.audited("user_action"),
    ContractHelpers.withRetry(3, 1000),
    { layer: "business" }
  )
)
async complexOperation(input: InputType) { /* ... */ }
```

## 🔧 Configuration

Zerot requires configuration before use. Call `configureZerot()` once during application startup.

### Quick Start Configuration

```typescript
import { configureZerot } from "zerot/config";

// Minimal setup - just provide session information
await configureZerot({
  sessionProvider: async () => {
    const session = await getCurrentSession();
    return {
      user: session?.user
        ? {
            id: session.user.id,
            roles: session.user.roles || ["user"],
          }
        : undefined,
    };
  },
});
```

### Environment Presets

Use predefined configurations optimized for different environments:

```typescript
import { configureZerot, ZerotPresets } from "zerot/config";

// Development - debugging enabled, verbose logging
await configureZerot({
  ...ZerotPresets.development(),
  sessionProvider: async () => await getCurrentSession(),
});

// Production - optimized for performance and security
await configureZerot({
  ...ZerotPresets.production(),
  sessionProvider: async () => await getCurrentSession(),
  resourceProvider: async (id) => await getResourceFromDB(id),
});

// Testing - consistent behavior, minimal logging
await configureZerot({
  ...ZerotPresets.testing(),
  sessionProvider: () => ({
    user: { id: "test-user", roles: ["user"] },
  }),
});

// High Security - strict validation, enhanced audit logging
await configureZerot({
  ...ZerotPresets.secure(),
  sessionProvider: async () => await getCurrentSession(),
  resourceProvider: async (id) => await getResourceFromDB(id),
});
```

### Full Configuration Example

```typescript
await configureZerot({
  // ===== CORE PROVIDERS (Required) =====

  sessionProvider: async () => {
    const session = await getSession();
    return {
      user: session?.user
        ? {
            id: session.user.id,
            roles: session.user.roles || ["user"],
            email: session.user.email,
            departmentId: session.user.departmentId,
            permissions: session.user.permissions,
          }
        : undefined,

      session: session
        ? {
            id: session.id,
            expiresAt: new Date(session.expires),
            ipAddress: session.ipAddress,
            userAgent: session.userAgent,
          }
        : undefined,
    };
  },

  resourceProvider: async (resourceId: string) => {
    const resource = await db.resource.findUnique({
      where: { id: resourceId },
      select: {
        id: true,
        userId: true,
        teamId: true,
        organizationId: true,
        isPublic: true,
      },
    });

    return resource
      ? {
          id: resource.id,
          userId: resource.userId,
          teamId: resource.teamId,
          organizationId: resource.organizationId,
          isPublic: resource.isPublic,
        }
      : null;
  },

  // ===== DEVELOPMENT & DEBUGGING =====

  enableDebugMode: process.env.NODE_ENV === "development",
  enablePerformanceMonitoring: true,
  enableExecutionTracing: true,
  logLevel: "info", // 'debug' | 'info' | 'warn' | 'error'

  // ===== SECURITY SETTINGS =====

  enableAuditLogging: true,
  enableInputSanitization: true,
  enableStrictValidation: true,

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
    "pin",
  ],

  // ===== PERFORMANCE OPTIMIZATION =====

  enableConditionCaching: true,
  conditionCacheTtl: 10000, // 10 seconds
  maxConditionExecutionTime: 5000, // 5 seconds timeout

  // ===== RATE LIMITING =====

  defaultRateLimitWindow: 60000, // 1 minute
  rateLimitMaxEntries: 50000,

  // Optional: Custom rate limit store (Redis, database, etc.)
  customRateLimitStore: new RedisRateLimitStore({
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT || "6379"),
  }),

  // ===== RETRY & ERROR HANDLING =====

  defaultRetryAttempts: 3,
  defaultRetryDelayMs: 1000, // 1 second base delay
  defaultRetryOnCategories: [
    ErrorCategory.NETWORK,
    ErrorCategory.SYSTEM,
    ErrorCategory.RATE_LIMIT,
  ],

  // ===== CUSTOM LOGGERS =====

  customLogger: {
    debug: (message, meta) => logger.debug(message, meta),
    info: (message, meta) => logger.info(message, meta),
    warn: (message, meta) => logger.warn(message, meta),
    error: (message, meta) => logger.error(message, meta),
  },

  customAuditLogger: new DatabaseAuditLogger({
    connectionString: process.env.AUDIT_DB_URL,
    tableName: "audit_logs",
    batchSize: 100,
    flushInterval: 5000,
  }),
});
```

### Configuration Options Reference

| Category                      | Option                                   | Type                         | Default                           | Description                          |
| ----------------------------- | ---------------------------------------- | ---------------------------- | --------------------------------- | ------------------------------------ |
| **Core Providers**            |
| `sessionProvider`             | `SessionProvider`                        | **Required**                 | -                                 | Function to get current user session |
| `resourceProvider`            | `ResourceProvider`                       | Optional                     | `async () => null`                | Function to get resource by ID       |
| **Development**               |
| `enableDebugMode`             | `boolean`                                | `NODE_ENV === 'development'` | Enable debug logging              |
| `enablePerformanceMonitoring` | `boolean`                                | `false`                      | Track performance metrics         |
| `enableExecutionTracing`      | `boolean`                                | `false`                      | Enable contract execution tracing |
| `logLevel`                    | `'debug' \| 'info' \| 'warn' \| 'error'` | `'info'`                     | Minimum log level                 |
| **Security**                  |
| `enableAuditLogging`          | `boolean`                                | `true`                       | Enable audit trail logging        |
| `enableInputSanitization`     | `boolean`                                | `true`                       | Sanitize sensitive fields         |
| `enableStrictValidation`      | `boolean`                                | `true`                       | Enable strict validation          |
| `sensitiveFields`             | `string[]`                               | `['password', 'token', ...]` | Fields to sanitize                |
| **Performance**               |
| `enableConditionCaching`      | `boolean`                                | `false`                      | Cache condition results           |
| `conditionCacheTtl`           | `number`                                 | `5000`                       | Cache TTL (ms)                    |
| `maxConditionExecutionTime`   | `number`                                 | `5000`                       | Max execution time (ms)           |
| **Rate Limiting**             |
| `defaultRateLimitWindow`      | `number`                                 | `60000`                      | Default window (ms)               |
| `rateLimitMaxEntries`         | `number`                                 | `10000`                      | Max entries in store              |
| `customRateLimitStore`        | `RateLimitStore`                         | `MemoryRateLimitStore`       | Custom store backend              |
| **Retry & Errors**            |
| `defaultRetryAttempts`        | `number`                                 | `0`                          | Default retry attempts            |
| `defaultRetryDelayMs`         | `number`                                 | `100`                        | Delay between retries (ms)        |
| `defaultRetryOnCategories`    | `ErrorCategory[]`                        | `[NETWORK, SYSTEM]`          | Error types to retry              |

### Runtime Configuration Access

```typescript
import { zerotConfig, getZerotConfig, isZerotConfigured } from "zerot/config";

// Check if configured
if (!isZerotConfigured()) {
  throw new Error("Zerot must be configured before use");
}

// Get specific configuration
const debugMode = zerotConfig.get("enableDebugMode");

// Get all configuration
const config = getZerotConfig();

// Update at runtime (use sparingly)
zerotConfig.set("enableDebugMode", true);
```

### Custom Providers

#### Session Provider Implementation

```typescript
const sessionProvider: SessionProvider = async () => {
  try {
    const session = await getSessionFromJWT(request.headers.authorization);

    if (!session) {
      return { user: undefined, session: undefined };
    }

    const userData = await getUserById(session.userId);

    return {
      user: {
        id: userData.id,
        email: userData.email,
        roles: userData.roles || ["user"],
        departmentId: userData.departmentId,
        organizationId: userData.organizationId,
        permissions: userData.permissions || [],
        isEmailVerified: userData.isEmailVerified,
        isPremium: userData.subscription?.isPremium || false,
      },

      session: {
        id: session.id,
        expiresAt: new Date(session.expiresAt),
        ipAddress: session.ipAddress,
        userAgent: session.userAgent,
        createdAt: new Date(session.createdAt),
      },
    };
  } catch (error) {
    console.error("Session provider error:", error);
    return { user: undefined, session: undefined };
  }
};
```

#### Resource Provider Implementation

```typescript
const resourceProvider: ResourceProvider = async (resourceId: string) => {
  try {
    // Handle different resource ID formats
    const [resourceType, id] = resourceId.includes(":")
      ? resourceId.split(":")
      : ["default", resourceId];

    let resource;

    switch (resourceType) {
      case "user":
        resource = await db.user.findUnique({
          where: { id },
          select: { id: true, organizationId: true, isActive: true },
        });
        break;

      case "project":
        resource = await db.project.findUnique({
          where: { id },
          select: {
            id: true,
            userId: true,
            teamId: true,
            organizationId: true,
            visibility: true,
          },
        });
        break;

      default:
        resource = await db.resource.findUnique({
          where: { id },
          select: { id: true, userId: true, teamId: true },
        });
    }

    return resource || null;
  } catch (error) {
    console.error("Resource provider error:", error);
    return null;
  }
};
```

#### Custom Rate Limit Store

```typescript
import Redis from "ioredis";

class RedisRateLimitStore implements RateLimitStore {
  private redis = new Redis(process.env.REDIS_URL);

  async get(key: string) {
    const data = await this.redis.get(key);
    return data ? JSON.parse(data) : null;
  }

  async set(key: string, value: { count: number; lastReset: number }) {
    await this.redis.setex(key, 3600, JSON.stringify(value));
  }

  async increment(key: string): Promise<number> {
    return await this.redis.incr(key);
  }

  async reset(key: string) {
    await this.redis.del(key);
  }

  async clear() {
    await this.redis.flushdb();
  }
}
```

## 🌐 Framework Integration

### Next.js Integration

#### App Router Setup

```typescript
// lib/zerot-config.ts
import { configureZerot } from "zerot/config";
import { getServerSession } from "next-auth";

export async function initializeZerot() {
  await configureZerot({
    sessionProvider: async () => {
      const session = await getServerSession();
      return {
        user: session?.user
          ? {
              id: session.user.id,
              roles: session.user.roles || ["user"],
            }
          : undefined,
      };
    },
    resourceProvider: async (id) => {
      return await getResourceFromDB(id);
    },
  });
}

// middleware.ts
import { withContractMiddleware } from "zerot/integrations/nextjs";
import { initializeZerot } from "./lib/zerot-config";

await initializeZerot();

async function middleware(request: NextRequest) {
  return NextResponse.next();
}

export default withContractMiddleware(middleware);

// app/actions.ts
("use server");

import { createServerAction } from "zerot/integrations/server-actions";

class UserActions {
  @contract({
    requires: [auth("user"), validates(UserSchema)],
    ensures: [returns(UserOutputSchema), auditLog("user_created")],
  })
  async createUser(input: UserInput) {
    return await userService.create(input);
  }
}

export const createUser = createServerAction(new UserActions().createUser);
```

#### API Routes

```typescript
// app/api/users/route.ts
import { contract, auth, validates, returns } from "zerot";

class UserAPI {
  @contract({
    requires: [auth("admin"), validates(UserSchema)],
    ensures: [returns(UserOutputSchema)],
    layer: "presentation",
  })
  async POST(request: Request) {
    const data = await request.json();
    return await userService.createUser(data);
  }
}

const userAPI = new UserAPI();
export { userAPI as POST };
```

### Express.js Integration

```typescript
import express from "express";
import { configureZerot } from "zerot/config";

// Configure Zerot
await configureZerot({
  sessionProvider: async () => {
    return getCurrentUser();
  },
});

const app = express();

class UserController {
  @contract({
    requires: [auth("user"), validates(UserSchema)],
    ensures: [auditLog("user_created")],
  })
  async createUser(input: UserInput) {
    return await userService.create(input);
  }
}

const userController = new UserController();

app.post("/users", async (req, res) => {
  try {
    const result = await userController.createUser(req.body);
    res.json(result);
  } catch (error) {
    if (error instanceof ContractViolationError) {
      res.status(400).json(error.getAppropriateResponse());
    } else {
      res.status(500).json({ error: "Internal server error" });
    }
  }
});
```

### Fastify Integration

```typescript
import Fastify from "fastify";
import { configureZerot } from "zerot/config";

const fastify = Fastify();

await configureZerot({
  sessionProvider: async () => {
    return getCurrentUser();
  },
});

class UserRoutes {
  @contract({
    requires: [auth("user"), validates(UserSchema)],
    ensures: [returns(UserOutputSchema)],
  })
  async createUser(input: UserInput) {
    return await userService.create(input);
  }
}

const userRoutes = new UserRoutes();

fastify.post("/users", async (request, reply) => {
  try {
    const result = await userRoutes.createUser(request.body);
    return result;
  } catch (error) {
    if (error instanceof ContractViolationError) {
      reply.status(400).send(error.getAppropriateResponse());
    } else {
      reply.status(500).send({ error: "Internal server error" });
    }
  }
});
```

## 📊 Monitoring & Debugging

### Performance Monitoring

```typescript
import { ContractPerformanceMonitor } from "zerot/utils
```
