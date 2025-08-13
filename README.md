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
- **`validates(schema)`**: Input validation with Zod schemas
- **`returns(schema)`**: Output validation and type safety
- **`rateLimit(operation, limit)`**: Configurable rate limiting
- **`auditLog(action)`**: Comprehensive audit trails
- **`businessRule(description, rule)`**: Custom business logic validation

### 🚀 Framework Integration

- **Next.js Server Actions**: Seamless integration with `createServerAction`
- **Next.js Middleware**: Contract-aware middleware with `withContractMiddleware`
- **Express.js**: Compatible with standard middleware patterns
- **tRPC**: Works with procedure middleware
- **Universal**: Framework-agnostic core design

### 🎨 Developer Experience

- **Contract Templates**: Pre-built patterns for common use cases
- **Smart Contracts**: Automatic contract inference based on patterns
- **Functional Helpers**: Compose contracts with utilities
- **Performance Monitoring**: Built-in execution timing and metrics
- **Debug Tools**: Development-friendly error reporting
- **VSCode Ready**: Enhanced IDE support planned

## 📦 Installation

```bash
npm install zerot zod
# or
yarn add zerot zod
# or
pnpm add zerot zod
```

**Requirements:**

- Node.js 18+
- TypeScript 5.0+
- Zod 3.0+ (peer dependency)

## 🚀 Quick Start

### Basic Usage

```typescript
import { contract, auth, validates, returns } from "zerot";
import { z } from "zod";

const UserSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  age: z.number().min(18),
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
    ],
    layer: "business",
  })
  async createUser(input: z.infer<typeof UserSchema>) {
    // Your business logic here - inputs are guaranteed valid
    return {
      id: crypto.randomUUID(),
      name: input.name,
      email: input.email,
      createdAt: new Date(),
    };
  }
}
```

### Next.js Server Actions

```typescript
// app/actions/users.ts
"use server";

import { createServerAction } from 'zerot/integrations/server-actions';
import { contract, auth, validates } from 'zerot';

class UserActions {
  @contract({
    requires: [auth('user'), validates(UserSchema)],
    layer: 'action'
  })
  async createUser(input: UserInput, context: AuthContext) {
    // Contract-protected server action
    return await userService.create(input);
  }
}

// Wrap for Next.js
export const createUserAction = createServerAction(
  new UserActions().createUser
);

// Use in components
export default function UserForm() {
  return (
    <form action={createUserAction}>
      {/* Your form fields */}
    </form>
  );
}
```

## 📚 Core Concepts

### Contract Decorator

The `@contract` decorator is the heart of Zerot, applying Design by Contract principles to your methods:

```typescript
@contract({
  requires: [    // Pre-conditions (before method execution)
    auth('admin'),
    validates(InputSchema),
    rateLimit('operation', 10)
  ],
  ensures: [     // Post-conditions (after method execution)
    returns(OutputSchema),
    auditLog('user_created')
  ],
  invariants: [  // Conditions that must hold before AND after
    (input, output) => output.id !== input.tempId
  ],
  layer: 'business',     // Layer classification
  retryAttempts: 3,      // Retry configuration
  retryDelayMs: 1000
})
async myMethod(input: InputType): Promise<OutputType> {
  // Your business logic
}
```

### Built-in Conditions

#### Authentication & Authorization

```typescript
// Basic authentication
@contract({ requires: [auth()] })
async getProfile() { /* ... */ }

// Role-based access
@contract({ requires: [auth('admin')] })
async deleteUser() { /* ... */ }

// Resource ownership
@contract({ requires: [auth('user'), owns('documentId')] })
async editDocument(input: { documentId: string, content: string }) { /* ... */ }
```

#### Validation

```typescript
// Input validation with transformation
@contract({ requires: [validates(UserSchema)] })
async createUser(input: UserInput) { /* ... */ }

// Output validation
@contract({ ensures: [returns(UserOutputSchema)] })
async getUser(): Promise<UserOutput> { /* ... */ }
```

#### Rate Limiting

```typescript
// Basic rate limiting (per user)
@contract({ requires: [rateLimit('api_call', 100)] })
async apiCall() { /* ... */ }

// Custom time window
@contract({ requires: [rateLimit('upload', 5, 60000)] }) // 5 per minute
async uploadFile() { /* ... */ }
```

#### Business Rules

```typescript
@contract({
  requires: [
    businessRule(
      'Order total must be positive',
      (input) => input.total > 0
    ),
    businessRule(
      'User must have sufficient balance',
      async (input, context) => {
        const balance = await getBalance(context.user.id);
        return balance >= input.total;
      }
    )
  ]
})
async processOrder(input: OrderInput) { /* ... */ }
```

## 🎨 Advanced Usage

### Contract Templates

Pre-built contract configurations for common patterns:

```typescript
import { ContractTemplates, ExtendedContractTemplates } from "zerot/templates";

class UserService {
  // Pre-built CRUD template
  @contract(ContractTemplates.userCRUD("admin"))
  async updateUser(input: UserUpdateInput) {
    /* ... */
  }

  // Admin-only operations
  @contract(ContractTemplates.adminOnly("delete_user"))
  async deleteUser(userId: string) {
    /* ... */
  }

  // Public API endpoints
  @contract(ContractTemplates.publicAPI("search_users"))
  async searchUsers(query: string) {
    /* ... */
  }

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
}
```

### Functional Composition

Build contracts using functional helpers:

```typescript
import { ContractHelpers } from 'zerot/templates';

// Compose contracts functionally
@contract(
  ContractHelpers.combine(
    ContractHelpers.authenticated('user'),
    ContractHelpers.validated(InputSchema, OutputSchema),
    ContractHelpers.rateLimited('operation', 10),
    ContractHelpers.audited('user_action'),
    ContractHelpers.withRetry(3, 1000),
    { layer: 'business' }
  )
)
async complexOperation(input: InputType) { /* ... */ }
```

### Smart Contracts

Automatic contract inference based on operation patterns:

```typescript
import { smartContract } from "zerot/templates";

class ProductService {
  // Automatically infers appropriate conditions
  @contract(
    smartContract({
      operation: "create",
      resource: "product",
      visibility: "admin",
      rateLimit: 10,
    })
  )
  async createProduct(input: ProductInput) {
    /* ... */
  }

  @contract(
    smartContract({
      operation: "read",
      resource: "product",
      visibility: "public",
    })
  )
  async getProduct(id: string) {
    /* ... */
  }
}
```

## 🔧 Configuration

### Global Configuration

```typescript
import { configureZerot, ZerotPresets } from "zerot/config";

// Configure at app startup
await configureZerot({
  // Use preset configuration
  ...ZerotPresets.production(),

  // Custom session provider
  sessionProvider: async () => {
    const session = await getSession();
    return {
      user: session?.user
        ? {
            id: session.user.id,
            roles: session.user.roles,
            email: session.user.email,
          }
        : undefined,
      session: session
        ? {
            id: session.id,
            expiresAt: new Date(session.expires),
          }
        : undefined,
    };
  },

  // Custom resource provider for ownership checks
  resourceProvider: async (resourceId: string) => {
    const resource = await db.findResourceById(resourceId);
    return resource ? { id: resource.id, userId: resource.userId } : null;
  },

  // Custom rate limiting backend
  customRateLimitStore: new RedisRateLimitStore(),

  // Enhanced security
  sensitiveFields: ["password", "token", "secret", "apiKey"],
  enableAuditLogging: true,

  // Performance tuning
  enablePerformanceMonitoring: true,
  enableConditionCaching: true,
  maxConditionExecutionTime: 5000,
});
```

### Environment Presets

```typescript
// Development
await configureZerot(ZerotPresets.development());

// Production
await configureZerot(ZerotPresets.production());

// Testing
await configureZerot(ZerotPresets.testing());

// High security
await configureZerot(ZerotPresets.secure());
```

## 🌐 Framework Integration

### Next.js Complete Setup

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
      // Your resource lookup logic
      return await getResourceFromDB(id);
    },
  });
}

// middleware.ts
import { withContractMiddleware } from "zerot/integrations/nextjs";
import { initializeZerot } from "./lib/zerot-config";

await initializeZerot();

async function middleware(request: NextRequest) {
  // Your middleware logic
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

### Express.js Integration

```typescript
import express from "express";
import { configureZerot } from "zerot/config";

// Configure Zerot
await configureZerot({
  sessionProvider: async () => {
    // Extract from request context
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

## 📊 Monitoring & Debugging

### Performance Monitoring

```typescript
import { ContractPerformanceMonitor } from "zerot/utils";

// Manual performance measurement
const result = await ContractPerformanceMonitor.measureContract(
  "UserService.createUser",
  () => userService.createUser(input)
);

// Get performance report
const report = ContractPerformanceMonitor.getPerformanceReport();
console.log(report);
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
console.log("Contract execution history:", debugReport);
```

### Custom Metrics

```typescript
import { Metrics } from "zerot/utils";

// Track custom metrics
Metrics.increment("custom_operation_count");
Metrics.gauge("active_users", 150);
Metrics.record("response_time", 250);

// Generate metrics report
const metricsReport = Metrics.getReport();
```

## 🧪 Testing

### Unit Testing Contracts

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { ContractViolationError } from "zerot";

describe("UserService", () => {
  let userService: UserService;

  beforeEach(() => {
    userService = new UserService();
  });

  it("should validate input correctly", async () => {
    const invalidInput = { name: "", email: "invalid" };

    await expect(userService.createUser(invalidInput)).rejects.toThrow(
      ContractViolationError
    );
  });

  it("should enforce authentication", async () => {
    // Mock no authentication context
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

### Testing Configuration

```typescript
import { configureZerot, ZerotPresets } from "zerot/config";

// Use testing preset
beforeEach(async () => {
  await configureZerot({
    ...ZerotPresets.testing(),
    sessionProvider: () => ({
      user: { id: "test-user", roles: ["user"] },
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
  ]
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
// Enable caching for expensive validations
await configureZerot({
  enableConditionCaching: true,
  conditionCacheTtl: 5000, // 5 seconds

  // Optimize rate limiting
  customRateLimitStore: new RedisRateLimitStore({
    maxEntries: 100000,
    cleanupInterval: 60000
  })
});

// Use smart contracts for automatic optimization
@contract(smartContract({
  operation: 'read',
  resource: 'user',
  visibility: 'public' // No auth overhead for public reads
}))
async getPublicProfile(userId: string) { /* ... */ }
```

## 📈 Migration Guide

### From Manual Validation

```typescript
// Before: Manual validation
async createUser(input: any) {
  // Manual validation
  if (!input.email || !isEmail(input.email)) {
    throw new Error('Invalid email');
  }
  if (!input.name || input.name.length < 1) {
    throw new Error('Name is required');
  }

  // Manual auth check
  if (!req.user || !req.user.roles.includes('admin')) {
    throw new Error('Unauthorized');
  }

  // Manual audit logging
  await auditLogger.log('user_created', { userId: input.id });

  // Business logic
  return await db.users.create(input);
}

// After: Contract-based
@contract({
  requires: [
    auth('admin'),
    validates(z.object({
      name: z.string().min(1),
      email: z.string().email()
    }))
  ],
  ensures: [auditLog('user_created')]
})
async createUser(input: UserInput) {
  // Only business logic - validation/auth handled by contract
  return await db.users.create(input);
}
```

### From Other Validation Libraries

```typescript
// From Joi
const joiSchema = Joi.object({
  email: Joi.string().email().required(),
  name: Joi.string().min(1).required()
});

// To Zerot with Zod
const zodSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1)
});

@contract({ requires: [validates(zodSchema)] })
async createUser(input: UserInput) { /* ... */ }
```

## 🔍 API Reference

### Core Decorators

#### `@contract(options: ContractOptions)`

Applies Design by Contract principles to a method.

**Options:**

- `requires?: Array<ContractCondition | ContractValidator>` - Pre-conditions
- `ensures?: Array<ContractEnsuresCondition>` - Post-conditions
- `invariants?: Array<ContractInvariant>` - Invariant conditions
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
```

#### `ContractPerformanceMonitor`

Performance monitoring utilities.

```typescript
ContractPerformanceMonitor.measureContract(name, fn);
ContractPerformanceMonitor.getPerformanceReport();
```

#### `Metrics`

Custom metrics collection.

```typescript
Metrics.increment(name, labels?)
Metrics.gauge(name, value, labels?)
Metrics.record(name, value, labels?)
Metrics.getReport()
```

## 🌟 Examples & Recipes

### E-commerce Platform

```typescript
class OrderService {
  @contract(
    ExtendedContractTemplates.secureCRUD({
      role: "user",
      resourceField: "customerId",
      inputSchema: z.object({
        customerId: z.string().uuid(),
        items: z.array(
          z.object({
            productId: z.string(),
            quantity: z.number().positive(),
            price: z.number().positive(),
          })
        ),
        total: z.number().positive(),
      }),
      operation: "create_order",
      rateLimit: 5,
    })
  )
  @contract(
    ContractHelpers.withBusinessRules(
      {
        description: "Order total must meet minimum",
        rule: (input) => input.total >= 10,
      },
      {
        description: "All items must be in stock",
        rule: async (input) => checkInventory(input.items),
      }
    )
  )
  async createOrder(input: OrderInput) {
    return await orderProcessor.process(input);
  }
}
```

### Content Management

```typescript
class ContentService {
  // Create content (authenticated authors)
  @contract(
    ExtendedContractTemplates.secureCRUD({
      role: "author",
      inputSchema: ContentSchema,
      outputSchema: ContentOutputSchema,
      operation: "create_content",
      rateLimit: 20,
    })
  )
  async createContent(input: ContentInput) {
    return await contentRepository.create(input);
  }

  // Public content access
  @contract(
    ExtendedContractTemplates.publicEndpoint({
      inputSchema: z.object({ category: z.string() }),
      outputSchema: z.array(ContentOutputSchema),
      operation: "get_content",
      rateLimit: 100,
    })
  )
  async getPublicContent(input: { category: string }) {
    return await contentRepository.findPublic(input.category);
  }

  // Edit content (owners only)
  @contract({
    requires: [
      auth("author"),
      owns("contentId"),
      validates(ContentUpdateSchema),
      rateLimit("edit_content", 30),
    ],
    ensures: [returns(ContentOutputSchema), auditLog("content_updated")],
  })
  async updateContent(input: ContentUpdateInput) {
    return await contentRepository.update(input);
  }
}
```

### Financial Services

```typescript
class PaymentService {
  @contract({
    requires: [
      auth("user"),
      validates(PaymentSchema),
      businessRule(
        "Payment amount must be positive",
        (input) => input.amount > 0
      ),
      businessRule(
        "User must have sufficient balance",
        async (input, context) => {
          const balance = await getBalance(context.user.id);
          return balance >= input.amount;
        }
      ),
      businessRule("Daily limit not exceeded", async (input, context) => {
        const todayTotal = await getTodayTotal(context.user.id);
        return todayTotal + input.amount <= DAILY_LIMIT;
      }),
      rateLimit("payment", 10, 60000), // 10 per minute
    ],
    ensures: [returns(PaymentResultSchema), auditLog("payment_processed")],
    retryAttempts: 3,
    retryDelayMs: 1000,
  })
  async processPayment(input: PaymentInput) {
    return await paymentProcessor.process(input);
  }
}
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

# Run tests in watch mode
npm run test:watch
```

### Running Examples

```bash
# Start development server
npm run dev

# Run specific example
npm run example:nextjs
npm run example:express
```

## 📜 License

MIT License - see [LICENSE](LICENSE) for details.

## 🙏 Acknowledgments

- Inspired by Eiffel's Design by Contract principles
- Built with TypeScript and Zod for type safety
- Designed for modern web development patterns

## 📞 Support

- **Documentation**: [https://meta-closure.github.io/zerot/](https://meta-closure.github.io/zerot/)
- **Issues**: [GitHub Issues](https://github.com/meta-closure/zerot/issues)
- **Discussions**: [GitHub Discussions](https://github.com/meta-closure/zerot/discussions)
- **Twitter**: [@metaclosure](https://twitter.com/metaclosure)

---

**Made with ❤️ by [metaclosure](https://github.com/meta-closure)**

_Building better software through contracts and zero-trust principles._
