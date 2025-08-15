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
import { ContractPerformanceMonitor } from "zerot/utils";

// Enable performance monitoring in config
await configureZerot({
  enablePerformanceMonitoring: true,
});

// Manual performance measurement
const result = await ContractPerformanceMonitor.measureContract(
  "UserService.createUser",
  () => userService.createUser(input)
);

// Get performance report
const report = ContractPerformanceMonitor.getPerformanceReport();
console.log("Average execution time:", report.averageExecutionTime);
console.log("Slowest operations:", report.slowestOperations);
```

### Debug Mode

```typescript
import { ContractDebugger } from "zerot/utils";

// Enable debug mode
await configureZerot({
  enableDebugMode: true,
  enableExecutionTracing: true,
});

// Get debug report
const debugReport = ContractDebugger.getContractReport();
console.log("Contract executions:", debugReport.executions);
console.log("Failed conditions:", debugReport.failures);
console.log("Performance stats:", debugReport.performance);
```

### Custom Metrics

```typescript
import { Metrics } from "zerot/utils";

// Track custom metrics
Metrics.increment("api_calls_total", { endpoint: "/users" });
Metrics.gauge("active_users", 150);
Metrics.record("database_query_time", 250, { query: "findUser" });

// Generate metrics report
const metricsReport = Metrics.getReport();
console.log("Total API calls:", metricsReport.counters.api_calls_total);
console.log("Active users:", metricsReport.gauges.active_users);
```

### Error Analysis

```typescript
import { ErrorAnalyzer } from "zerot/utils";

// Analyze error patterns
const errorReport = ErrorAnalyzer.getErrorReport();
console.log("Most common errors:", errorReport.commonErrors);
console.log("Error trends:", errorReport.trends);
console.log("Failed operations:", errorReport.failedOperations);

// Get recommendations
const recommendations = ErrorAnalyzer.getRecommendations();
console.log("Suggestions:", recommendations);
```

## 🧪 Testing

### Unit Testing Contracts

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { ContractViolationError, configureZerot, ZerotPresets } from "zerot";

describe("UserService", () => {
  let userService: UserService;

  beforeEach(async () => {
    // Use testing preset
    await configureZerot({
      ...ZerotPresets.testing(),
      sessionProvider: () => ({
        user: { id: "test-user", roles: ["user"] },
      }),
    });

    userService = new UserService();
  });

  it("should validate input correctly", async () => {
    const invalidInput = { name: "", email: "invalid" };

    await expect(userService.createUser(invalidInput)).rejects.toThrow(
      ContractViolationError
    );
  });

  it("should enforce authentication", async () => {
    // Override session provider for this test
    await configureZerot({
      ...ZerotPresets.testing(),
      sessionProvider: () => ({ user: undefined }),
    });

    await expect(userService.createUser(validInput)).rejects.toThrow(
      "User must be logged in"
    );
  });

  it("should create user successfully with valid input", async () => {
    const validInput = {
      name: "John Doe",
      email: "john@example.com",
      age: 25,
    };

    const result = await userService.createUser(validInput);

    expect(result).toMatchObject({
      id: expect.any(String),
      name: "John Doe",
      email: "john@example.com",
    });
  });
});
```

### Contract Testing Utilities

```typescript
import { ContractTester } from "zerot/testing";

describe("Contract behavior", () => {
  it("should test contract conditions independently", async () => {
    const tester = new ContractTester(UserService.prototype.createUser);

    // Test individual conditions
    await expect(tester.testRequires(invalidInput)).rejects.toThrow();
    await expect(tester.testEnsures(validOutput)).resolves.toBe(true);

    // Test full contract
    const result = await tester.testFullContract(validInput);
    expect(result.success).toBe(true);
  });
});
```

### Mock Providers

```typescript
import { MockProviders } from "zerot/testing";

beforeEach(async () => {
  await configureZerot({
    sessionProvider: MockProviders.createMockSessionProvider({
      user: { id: "test-user", roles: ["admin"] },
    }),
    resourceProvider: MockProviders.createMockResourceProvider({
      "resource-1": { id: "resource-1", userId: "test-user" },
    }),
  });
});
```

## 🎯 Best Practices

### Contract Design

```typescript
// ✅ Good: Clear, specific conditions
@contract({
  requires: [
    auth('user'),
    validates(z.object({
      amount: z.number().positive(),
      currency: z.enum(['USD', 'EUR', 'JPY'])
    })),
    businessRule(
      'User must have sufficient balance',
      async (input, context) => {
        const balance = await getBalance(context.user.id);
        return balance >= input.amount;
      }
    )
  ],
  ensures: [
    returns(TransactionSchema),
    auditLog('transaction_created')
  ],
  layer: 'business'
})
async createTransaction(input: TransactionInput) { /* ... */ }

// ❌ Avoid: Generic, unclear conditions
@contract({
  requires: [(input) => input.isValid()],
  ensures: [(output) => output !== null]
})
async doSomething(input: any) { /* ... */ }
```

### Error Handling

```typescript
import { ContractViolationError, ErrorCategory } from "zerot";

try {
  await userService.createUser(input);
} catch (error) {
  if (error instanceof ContractViolationError) {
    // Handle contract violations specifically
    const response = error.getAppropriateResponse();

    switch (error.layer) {
      case "presentation":
        return redirect(response.redirect || "/login");
      case "business":
        return { success: false, error: response.error };
      default:
        return { success: false, error: "Operation failed" };
    }
  }

  // Handle other errors
  throw error;
}
```

### Performance Optimization

```typescript
// Enable caching for expensive conditions
@contract({
  requires: [
    auth('user'),
    businessRule(
      'User has premium subscription',
      async (input, context) => {
        const subscription = await getSubscription(context.user.id);
        return subscription.isPremium;
      },
      { cacheTtl: 300000 } // Cache for 5 minutes
    )
  ]
})
async premiumFeature(input: any) { /* ... */ }

// Use rate limiting strategically
@contract({
  requires: [
    rateLimit('expensive_operation', 5, 3600000), // 5 per hour
  ]
})
async expensiveOperation() { /* ... */ }
```

### Layer Organization

```typescript
// Presentation Layer (API endpoints, UI handlers)
@contract({
  requires: [validates(RequestSchema), rateLimit('api_call', 100)],
  ensures: [returns(ResponseSchema)],
  layer: 'presentation'
})
async handleAPIRequest(request: Request) { /* ... */ }

// Business Layer (core logic, domain rules)
@contract({
  requires: [auth('user'), businessRule('Business rule', rule)],
  ensures: [auditLog('business_action')],
  layer: 'business'
})
async executeBusinessLogic(input: BusinessInput) { /* ... */ }

// Data Layer (database operations, external APIs)
@contract({
  requires: [validates(DataSchema)],
  ensures: [returns(DataOutputSchema)],
  layer: 'data',
  retryAttempts: 3
})
async saveToDatabase(data: DataInput) { /* ... */ }
```

### Security Guidelines

```typescript
// Always validate sensitive operations
@contract({
  requires: [
    auth('admin'),
    validates(AdminActionSchema),
    businessRule('Action requires approval',
      async (input, context) => {
        return await hasApproval(input.actionId, context.user.id);
      }
    )
  ],
  ensures: [
    auditLog('admin_action', { sensitivity: 'high' }),
    returns(ActionResultSchema)
  ]
})
async performAdminAction(input: AdminActionInput) { /* ... */ }

// Use resource ownership checks
@contract({
  requires: [
    auth('user'),
    owns('documentId'),
    validates(DocumentUpdateSchema)
  ],
  ensures: [auditLog('document_updated')]
})
async updateDocument(input: DocumentUpdateInput) { /* ... */ }
```

## 🔍 Advanced Usage

### Custom Conditions

Create your own reusable conditions:

```typescript
import { createCondition } from "zerot/conditions";

// Custom authentication condition
export const requiresPermission = (permission: string) =>
  createCondition(
    `User must have ${permission} permission`,
    async (input: any, context: ExecutionContext) => {
      const user = context.user;
      if (!user) {
        throw new Error("User not authenticated");
      }

      const hasPermission = user.permissions?.includes(permission);
      if (!hasPermission) {
        throw new Error(`Missing permission: ${permission}`);
      }

      return true;
    }
  );

// Custom business rule condition
export const withinBusinessHours = () =>
  createCondition(
    "Operation must be within business hours",
    async () => {
      const now = new Date();
      const hour = now.getHours();
      return hour >= 9 && hour <= 17;
    }
  );

// Usage
@contract({
  requires: [
    requiresPermission('user:write'),
    withinBusinessHours()
  ]
})
async createUser(input: UserInput) { /* ... */ }
```

### Dynamic Contract Configuration

```typescript
import { createDynamicContract } from "zerot/dynamic";

class UserService {
  // Contract configuration based on input
  @createDynamicContract((input: any) => ({
    requires: [
      auth("user"),
      ...(input.isAdmin ? [auth("admin")] : []),
      validates(input.isAdmin ? AdminUserSchema : UserSchema),
    ],
    ensures: [auditLog(input.isAdmin ? "admin_user_created" : "user_created")],
  }))
  async createUser(input: UserInput) {
    /* ... */
  }
}
```

### Conditional Contract Application

```typescript
import { conditionalContract } from "zerot/conditional";

class PaymentService {
  // Different contracts based on environment
  @conditionalContract({
    development: {
      requires: [validates(PaymentSchema)],
      ensures: [returns(PaymentResultSchema)],
    },
    production: {
      requires: [
        auth("user"),
        validates(PaymentSchema),
        businessRule("Payment amount validation", validateAmount),
        rateLimit("payment", 10, 3600000),
      ],
      ensures: [
        returns(PaymentResultSchema),
        auditLog("payment_processed"),
        businessRule("Payment recorded", verifyPaymentRecorded),
      ],
    },
  })
  async processPayment(input: PaymentInput) {
    /* ... */
  }
}
```

### Contract Composition

```typescript
import { composeContracts } from "zerot/composition";

// Base contract for all user operations
const baseUserContract = {
  requires: [auth('user'), validates(BaseUserSchema)],
  ensures: [auditLog('user_operation')]
};

// Admin-specific additions
const adminEnhancements = {
  requires: [auth('admin')],
  ensures: [auditLog('admin_operation', { sensitivity: 'high' })]
};

// Compose contracts
const adminUserContract = composeContracts(baseUserContract, adminEnhancements);

@contract(adminUserContract)
async adminUserOperation(input: AdminUserInput) { /* ... */ }
```

## 📈 Real-World Examples

### E-commerce Platform

```typescript
class OrderService {
  @contract({
    requires: [
      auth("customer"),
      validates(OrderSchema),
      businessRule("Items must be in stock", async (input) => {
        return await checkStockAvailability(input.items);
      }),
      businessRule(
        "Customer has valid payment method",
        async (input, context) => {
          return await hasValidPaymentMethod(context.user.id);
        }
      ),
      rateLimit("order_creation", 5, 300000), // 5 orders per 5 minutes
    ],
    ensures: [
      returns(OrderConfirmationSchema),
      auditLog("order_created"),
      businessRule("Inventory updated", async (output) => {
        return await verifyInventoryUpdate(output.orderId);
      }),
    ],
    layer: "business",
    retryAttempts: 2,
  })
  async createOrder(input: OrderInput): Promise<OrderConfirmation> {
    // Reserve inventory
    await this.inventoryService.reserve(input.items);

    // Process payment
    const payment = await this.paymentService.charge(
      input.paymentMethodId,
      input.total
    );

    // Create order record
    const order = await this.orderRepository.create({
      ...input,
      paymentId: payment.id,
      status: "confirmed",
    });

    // Send confirmation
    await this.notificationService.sendOrderConfirmation(order);

    return {
      orderId: order.id,
      confirmationNumber: order.confirmationNumber,
      estimatedDelivery: order.estimatedDelivery,
    };
  }

  @contract({
    requires: [
      auth("customer"),
      owns("orderId"),
      businessRule("Order can be cancelled", async (input) => {
        const order = await getOrder(input.orderId);
        return order.status === "confirmed" && !order.isShipped;
      }),
    ],
    ensures: [
      auditLog("order_cancelled"),
      businessRule("Refund processed", async (output, input) => {
        return await verifyRefund(input.orderId);
      }),
    ],
  })
  async cancelOrder(input: { orderId: string }): Promise<void> {
    await this.orderRepository.updateStatus(input.orderId, "cancelled");
    await this.paymentService.refund(input.orderId);
    await this.inventoryService.release(input.orderId);
  }
}
```

### Content Management System

```typescript
class ContentService {
  @contract({
    requires: [
      auth("editor"),
      validates(ArticleSchema),
      businessRule("Article title is unique", async (input) => {
        const existing = await findArticleByTitle(input.title);
        return !existing;
      }),
      rateLimit("content_creation", 20, 3600000), // 20 articles per hour
    ],
    ensures: [
      returns(ArticleOutputSchema),
      auditLog("article_created"),
      businessRule("Article indexed for search", async (output) => {
        return await verifySearchIndex(output.id);
      }),
    ],
  })
  async createArticle(input: ArticleInput): Promise<Article> {
    // Create article
    const article = await this.articleRepository.create({
      ...input,
      authorId: this.context.user.id,
      status: "draft",
      createdAt: new Date(),
    });

    // Process content
    const processedContent = await this.contentProcessor.process(input.content);
    await this.articleRepository.updateContent(article.id, processedContent);

    // Index for search
    await this.searchService.index(article);

    return article;
  }

  @contract({
    requires: [
      auth("user"),
      businessRule("Article is published", async (input) => {
        const article = await getArticle(input.articleId);
        return article.status === "published";
      }),
    ],
    ensures: [returns(ArticleViewSchema), auditLog("article_viewed")],
    layer: "presentation",
  })
  async getArticle(input: { articleId: string }): Promise<ArticleView> {
    const article = await this.articleRepository.findById(input.articleId);

    // Increment view count
    await this.analyticsService.recordView(
      input.articleId,
      this.context.user?.id
    );

    return {
      ...article,
      viewCount: article.viewCount + 1,
      canEdit: this.canUserEdit(article, this.context.user),
    };
  }

  @contract({
    requires: [
      auth("editor"),
      owns("articleId", "authorId"),
      validates(ArticleUpdateSchema),
    ],
    ensures: [
      auditLog("article_updated"),
      businessRule("Change history recorded", async (output, input) => {
        return await verifyChangeHistory(input.articleId);
      }),
    ],
  })
  async updateArticle(input: ArticleUpdateInput): Promise<void> {
    // Record change history
    await this.changeHistoryService.record(input.articleId, input.changes);

    // Update article
    await this.articleRepository.update(input.articleId, input.changes);

    // Re-index if content changed
    if (input.changes.content) {
      const updatedArticle = await this.articleRepository.findById(
        input.articleId
      );
      await this.searchService.reindex(updatedArticle);
    }
  }
}
```

### Banking Application

```typescript
class BankingService {
  @contract({
    requires: [
      auth("customer"),
      validates(TransferSchema),
      businessRule("Sufficient balance", async (input, context) => {
        const balance = await getAccountBalance(context.user.accountId);
        return balance >= input.amount;
      }),
      businessRule("Valid recipient account", async (input) => {
        return await isValidAccount(input.recipientAccountId);
      }),
      businessRule("Transfer limits not exceeded", async (input, context) => {
        const dailyTotal = await getDailyTransferTotal(context.user.accountId);
        return dailyTotal + input.amount <= context.user.dailyLimit;
      }),
      rateLimit("transfer", 10, 3600000), // 10 transfers per hour
    ],
    ensures: [
      returns(TransferConfirmationSchema),
      auditLog("money_transfer", { sensitivity: "high" }),
      businessRule("Balances updated correctly", async (output) => {
        return await verifyBalanceUpdate(output.transactionId);
      }),
      businessRule("Transaction recorded", async (output) => {
        return await verifyTransactionRecord(output.transactionId);
      }),
    ],
    layer: "business",
    retryAttempts: 0, // No retries for financial operations
  })
  async transferMoney(input: TransferInput): Promise<TransferConfirmation> {
    // Start database transaction
    return await this.db.transaction(async (tx) => {
      // Debit source account
      await this.accountService.debit(
        input.sourceAccountId,
        input.amount,
        `Transfer to ${input.recipientAccountId}`,
        tx
      );

      // Credit recipient account
      await this.accountService.credit(
        input.recipientAccountId,
        input.amount,
        `Transfer from ${input.sourceAccountId}`,
        tx
      );

      // Create transaction record
      const transaction = await this.transactionService.create(
        {
          type: "transfer",
          amount: input.amount,
          sourceAccountId: input.sourceAccountId,
          recipientAccountId: input.recipientAccountId,
          reference: input.reference,
          status: "completed",
        },
        tx
      );

      // Send notifications
      await this.notificationService.sendTransferConfirmation(transaction);

      return {
        transactionId: transaction.id,
        confirmationNumber: transaction.confirmationNumber,
        timestamp: transaction.createdAt,
      };
    });
  }

  @contract({
    requires: [
      auth("customer"),
      owns("accountId"),
      validates(
        z.object({
          accountId: z.string(),
          startDate: z.date().optional(),
          endDate: z.date().optional(),
        })
      ),
    ],
    ensures: [
      returns(TransactionHistorySchema),
      auditLog("account_history_accessed"),
    ],
    layer: "data",
  })
  async getTransactionHistory(
    input: TransactionHistoryInput
  ): Promise<TransactionHistory> {
    const transactions = await this.transactionRepository.findByAccount({
      accountId: input.accountId,
      startDate:
        input.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      endDate: input.endDate || new Date(),
    });

    return {
      accountId: input.accountId,
      transactions: transactions.map((t) => ({
        id: t.id,
        type: t.type,
        amount: t.amount,
        description: t.description,
        timestamp: t.createdAt,
        balance: t.runningBalance,
      })),
      totalCount: transactions.length,
    };
  }
}
```

## 🔧 API Reference

### Core Decorators

#### `@contract(options)`

Apply a contract to a method.

**Parameters:**

- `requires?: Condition[]` - Pre-conditions (validated before method execution)
- `ensures?: Condition[]` - Post-conditions (validated after method execution)
- `invariants?: Condition[]` - Conditions that must hold before AND after
- `layer?: string` - Application layer classification
- `retryAttempts?: number` - Number of retry attempts
- `retryDelayMs?: number` - Delay between retries
- `retryOnCategories?: ErrorCategory[]` - Error categories to retry

### Built-in Conditions

#### `auth(requiredRole?: string)`

Authentication and role-based access control.

```typescript
auth(); // Any authenticated user
auth("admin"); // Must have 'admin' role
auth("moderator"); // Must have 'moderator' role
```

#### `validates(schema: ZodSchema, transformer?)`

Input validation with optional transformation.

```typescript
validates(UserSchema); // Basic validation
validates(UserSchema, (user) => ({
  // With transformation
  ...user,
  fullName: `${user.firstName} ${user.lastName}`,
}));
```

#### `returns(schema: ZodSchema)`

Output validation against a Zod schema.

```typescript
ensures: [returns(UserOutputSchema)];
```

#### `owns(resourceField: string)`

Verifies resource ownership.

```typescript
owns("documentId"); // Checks if user owns the document
owns("projectId"); // Checks if user owns the project
```

#### `rateLimit(operation: string, limit: number, windowMs?: number)`

Rate limiting for operations.

```typescript
rateLimit("api_call", 100); // 100 per minute (default)
rateLimit("upload", 5, 60000); // 5 per minute
rateLimit("login", 3, 300000); // 3 per 5 minutes
```

#### `auditLog(action: string)`

Audit event logging.

```typescript
auditLog("user_created");
auditLog("sensitive_data_accessed");
```

#### `businessRule(description: string, rule: Function)`

Custom business logic validation.

```typescript
businessRule("Order total must be positive", (input) => input.total > 0);

businessRule("User must have sufficient balance", async (input, context) => {
  const balance = await getBalance(context.user.id);
  return balance >= input.amount;
});
```

### Error Classes

#### `ContractError`

Base error class for contract-related issues.

```typescript
throw new ContractError("Validation failed", {
  code: "VALIDATION_ERROR",
  category: ErrorCategory.VALIDATION,
  details: { field: "email" },
  isRecoverable: false,
});
```

#### `ContractViolationError`

Indicates a contract violation.

```typescript
// Automatically thrown by contract system
catch (error) {
  if (error instanceof ContractViolationError) {
    console.log(error.contractName); // Method name
    console.log(error.layer);        // Application layer
    console.log(error.originalError); // Original error

    const response = error.getAppropriateResponse();
  }
}
```

### Utility Classes

#### `ContractDebugger`

Development debugging utilities.

```typescript
ContractDebugger.getContractReport(); // Execution history
ContractDebugger.getFailureAnalysis(); // Failure patterns
ContractDebugger.exportTrace(contractName); // Export execution trace
```

#### `ContractPerformanceMonitor`

Performance monitoring utilities.

```typescript
ContractPerformanceMonitor.measureContract(name, fn);
ContractPerformanceMonitor.getPerformanceReport();
ContractPerformanceMonitor.getSlowOperations();
```

#### `Metrics`

Custom metrics collection.

```typescript
Metrics.increment(name, labels?); // Counter metric
Metrics.gauge(name, value, labels?); // Gauge metric
Metrics.record(name, value, labels?); // Histogram metric
Metrics.getReport(); // Get all metrics
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup

```bash
# Clone the repository
git clone https://github.com/meta-closure/zerot.git
cd zerot

# Install dependencies
npm install

# Run tests
npm test

# Build the project
npm run build

# Run in development mode
npm run dev
```

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- user.spec.ts
```

### Code Quality

```bash
# Lint code
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format

# Type check
npm run type-check
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
