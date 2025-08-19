# Zerot: Design by Contract for TypeScript

[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

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
- **Request Context Management**: Advanced context handling with adapters
- **Error Handling**: Intelligent error classification and recovery strategies
- **Template System**: Pre-built contract templates for common patterns
- **Framework Integration**: First-class support for Next.js with adapter system
- **Zero Configuration**: Sensible defaults with extensive customization options

### 🌟 Developer Experience

- **AI-Friendly**: Structured error messages and clear contract documentation
- **Type-Safe**: Full TypeScript support with intelligent type inference
- **Debug Mode**: Detailed execution tracing and performance insights
- **Hot Reload**: Development-friendly with fast refresh support

## 🚀 Quick Start

### Installation

```bash
npm install zerot zod
# or
yarn add zerot zod
# or
pnpm add zerot zod
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

// Rate limit utilities
import { clearRateLimit, getRateLimitStatus, clearAllRateLimits } from "zerot";

// Clear specific rate limit
clearRateLimit("user123", "api_call");

// Check current status
const status = getRateLimitStatus("user123", "api_call");
console.log(`Current: ${status?.current}/${status?.max}`);

// Clear all for testing
clearAllRateLimits();
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

// Detailed audit log with options
auditLog("sensitive_data_accessed", {
  includeInput: false,
  includeOutput: true,
  metadata: { sensitivity: "high", dataType: "personal_info" },
});

// Audit failures
import { auditLogFailure } from "zerot";

try {
  await sensitiveOperation();
} catch (error) {
  await auditLogFailure("operation_failed", error, input, context);
  throw error;
}
```

## 🎨 Contract Templates

Zerot provides pre-built templates for common patterns:

### Basic Templates

```typescript
import { ContractTemplates } from "zerot/templates";

class UserService {
  // Basic user CRUD operations
  @contract(ContractTemplates.userCRUD("user"))
  async createUser(input: UserInput) {
    /* ... */
  }

  // Admin-only operations
  @contract(ContractTemplates.adminOnly("delete_user"))
  async deleteUser(input: { userId: string }) {
    /* ... */
  }

  // Public API endpoints
  @contract(ContractTemplates.publicAPI("get_users"))
  async getUsers() {
    /* ... */
  }

  // Batch operations
  @contract(ContractTemplates.batchOperation())
  async processBatch(items: any[]) {
    /* ... */
  }
}
```

### Extended Templates

```typescript
import { ExtendedContractTemplates } from "zerot/templates";

class ServiceLayer {
  // Secure CRUD with full validation
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

  // Public endpoints with validation
  @contract(
    ExtendedContractTemplates.publicEndpoint({
      inputSchema: SearchSchema,
      outputSchema: SearchResultsSchema,
      operation: "search_users",
      rateLimit: 100,
    })
  )
  async searchUsers(input: SearchInput) {
    /* ... */
  }

  // Admin operations
  @contract(
    ExtendedContractTemplates.adminOperation({
      operation: "system_maintenance",
      inputSchema: MaintenanceSchema,
      rateLimit: 5,
      retryAttempts: 2,
    })
  )
  async performMaintenance(input: MaintenanceInput) {
    /* ... */
  }
}
```

### Smart Contract Templates

```typescript
import { smartContract } from "zerot/templates";

class DocumentService {
  // Auto-configured based on operation and resource
  @smartContract({
    operation: "create",
    resource: "document",
    visibility: "private",
    rateLimit: 20,
  })
  async createDocument(input: DocumentInput) {
    /* ... */
  }

  @smartContract({
    operation: "read",
    resource: "document",
    visibility: "public",
  })
  async getDocument(input: { documentId: string }) {
    /* ... */
  }
}
```

### Functional Contract Composition

```typescript
import { ContractHelpers, ContractFactory } from "zerot/templates";

// Functional composition
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

// Type-safe factory functions
@contract(
  ContractFactory.update(
    UserUpdateSchema,
    UserOutputSchema,
    "userId",
    {
      role: "user",
      rateLimit: 5,
      businessRules: [
        {
          description: "User must be active",
          rule: async (input, context) => {
            const user = await getUser(context.user.id);
            return user.isActive;
          }
        }
      ]
    }
  )
)
async updateUser(input: UserUpdateInput) { /* ... */ }
```

## 🔧 Configuration

Zerot requires configuration before use. Call `configureZerot()` once during application startup.

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

### Full Configuration Options

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
      select: { id: true, userId: true },
    });
    return resource || null;
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

## 🌐 Framework Integration

### Next.js Integration with Adapters

Zerot provides a powerful adapter system for framework integration:

```typescript
// lib/zerot-setup.ts
import {
  configureZerot,
  NextjsAdapter,
  AdapterRegistry,
  withZerotContext,
} from "zerot";

// Create and register Next.js adapter
const nextjsAdapter = new NextjsAdapter({
  extractUserFromHeaders: true,
  sessionCookieName: "auth-token",
});

AdapterRegistry.register(nextjsAdapter);

// Configure Zerot with adapter
await configureZerot({
  sessionProvider: async () => {
    // Adapter will automatically extract context
    return await nextjsAdapter.extractUser(request);
  },
  resourceProvider: async (id) => await getResourceFromDB(id),
});

// Export context wrapper for middleware
export const zerotMiddleware = withZerotContext(nextjsAdapter);
```

### Request Context Management

```typescript
import {
  createRequestContext,
  withRequestContext,
  getRequestContext,
} from "zerot";

// Create context for a request
const context = createRequestContext({
  user: { id: "user123", roles: ["user"] },
  session: { id: "session456", expiresAt: new Date() },
  requestId: "req-789",
});

// Execute with context
await withRequestContext(context, async () => {
  // All contract executions will use this context
  await userService.createUser(input);
});

// Get current context
const currentContext = getRequestContext();
```

## 📊 Development & Debugging

### Debug Mode

```typescript
await configureZerot({
  enableDebugMode: true,
  enableExecutionTracing: true,
  logLevel: "debug",
});

// Contracts will log detailed execution information
```

### Error Handling

```typescript
import { ContractViolationError, ErrorCategory } from "zerot";

try {
  await userService.createUser(input);
} catch (error) {
  if (error instanceof ContractViolationError) {
    // Handle contract violations specifically
    switch (error.layer) {
      case "presentation":
        return redirect("/login");
      case "business":
        return { success: false, error: error.message };
      default:
        return { success: false, error: "Operation failed" };
    }
  }
  throw error;
}
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
      }
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

#### `validates(schema: ZodSchema, transformer?)`

Input validation with optional transformation.

#### `returns(schema: ZodSchema)`

Output validation against a Zod schema.

#### `owns(resourceField: string)`

Verifies resource ownership.

#### `rateLimit(operation: string, limit: number, windowMs?: number)`

Rate limiting for operations.

#### `auditLog(action: string, options?)`

Audit event logging with optional configuration.

#### `businessRule(description: string, rule: Function)`

Custom business logic validation.

### Error Classes

#### `ContractError`

Base error class for contract-related issues.

#### `ContractViolationError`

Indicates a contract violation with context information.

### Available Exports

```typescript
// Core
export { contract } from "zerot";
export { ContractError, ContractViolationError, ErrorCategory } from "zerot";

// Conditions
export {
  auth,
  owns,
  validates,
  returns,
  rateLimit,
  auditLog,
  auditLogFailure,
  businessRule,
  clearRateLimit,
  getRateLimitStatus,
  clearAllRateLimits,
} from "zerot";

// Templates
export {
  ContractTemplates,
  ExtendedContractTemplates,
  ContractHelpers,
  ContractFactory,
  smartContract,
} from "zerot/templates";

// Configuration
export {
  configureZerot,
  getZerotConfig,
  isZerotConfigured,
  zerotConfig,
  ZerotPresets,
} from "zerot/config";

// Framework Integration
export {
  AdapterRegistry,
  BaseAdapter,
  NextjsAdapter,
  createNextjsAdapter,
  withZerotContext,
} from "zerot/core";

// Context Management
export {
  createRequestContext,
  getRequestContext,
  setRequestContext,
  withRequestContext,
  clearRequestContext,
} from "zerot/core";

// Types
export type {
  AuthContext,
  ContractOptions,
  SessionProvider,
  ResourceProvider,
  ZerotConfig,
  AuditEvent,
  AuditLogger,
  RateLimitStore,
  ZerotAdapter,
} from "zerot";
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
