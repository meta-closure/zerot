# Zerot: TypeScript contracts that actually work

[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Stop worrying about your backend breaking.** Zerot uses simple contracts to make your data layer bulletproof, even when you're coding at 3am or letting AI write half your code.

```typescript
@contract({
  requires: [auth("user"), validates(UserSchema)],
  ensures: [auditLog("user_created")],
})
async createUser(input: UserInput) {
  // This method is now protected by contracts
  return await db.user.create(input);
}
```

No matter how tired you are or how rushed the deployment is, your contracts have your back.

## Why Zerot?

### Your data layer should be unbreakable

Database operations are the heart of your app. One bad update, one missing validation, one forgotten auth check - and you're debugging production at midnight. Zerot puts guardrails around everything that touches your data.

### Start small, grow gradually

You don't need to rewrite your entire app. Drop a `@contract` on your most critical methods first. Add more as you go. Each contract makes your code a little more bulletproof.

### AI-friendly patterns

When you're using Copilot or ChatGPT to generate code, you want consistent patterns. Zerot's templates mean every generated method follows the same security and validation patterns - no surprises.

## Core Concepts

### What are contracts?

Think of contracts like TypeScript, but for runtime behavior. While TypeScript catches type errors at compile time, contracts catch logic errors at runtime:

```typescript
// TypeScript ensures the parameter is a string
function updateUser(name: string) { }

// Contracts ensure the business rules are followed
@contract({
  requires: [
    auth("user"),           // Must be logged in
    validates(UserSchema),  // Input must be valid
    owns("userId"),         // Must own this resource
  ],
  ensures: [
    auditLog("user_updated") // Log what happened
  ]
})
function updateUser(input: { userId: string, name: string }) { }
```

### The three types of conditions

**Pre-conditions (`requires`)**: What must be true before your method runs

- Authentication checks
- Input validation
- Business rule verification
- Rate limiting

**Post-conditions (`ensures`)**: What must be true after your method succeeds

- Output validation
- Audit logging
- Side effect verification

**Invariants**: What must always be true (both before and after)

- System health checks
- Data consistency rules

```typescript
@contract({
  requires: [auth("user")],                    // Pre: User must be logged in
  ensures: [auditLog("action_performed")],     // Post: Action must be logged
  invariants: [systemHealthCheck],             // Always: System must be healthy
})
```

### Fail fast philosophy

Instead of discovering problems deep in your application or in production, contracts catch issues immediately:

```typescript
// Without contracts: Error happens deep in database layer
async function createUser(input) {
  const user = await userService.create(input);  // Works
  const profile = await profileService.create({  // Fails here
    userId: user.id,
    email: input.emal  // Typo! Database constraint error
  });
}

// With contracts: Error caught immediately at the boundary
@contract({
  requires: [validates(UserSchema)], // Catches typos instantly
})
async function createUser(input) {
  // This never runs if input is invalid
}
```

### Layer-based protection

Different layers in your application have different concerns:

```typescript
// API Layer: "Is this request valid?"
@contract({
  requires: [validates(schema), rateLimit("api", 100)],
  layer: "presentation"
})

// Service Layer: "Is this user allowed to do this?"
@contract({
  requires: [auth("user"), businessRule("rule", check)],
  layer: "service"
})

// Data Layer: "Is this data safe to store?"
@contract({
  requires: [validates(schema)],
  retryAttempts: 3,
  layer: "data"
})
```

Each layer acts as a checkpoint, catching different types of problems.

## Quick start

### Install

```bash
npm install zerot zod
```

### 5-minute setup

```typescript
// lib/zerot.ts - One-time setup
import { configureZerot } from "zerot";

await configureZerot({
  sessionProvider: async () => {
    // Your existing auth logic
    const session = await getSession();
    return { user: session?.user };
  },
});
```

### Your first protected method

```typescript
import { contract, auth, validates } from "zerot";
import { z } from "zod";

const UserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
});

class UserService {
  @contract({
    requires: [validates(UserSchema)],
    layer: "service",
  })
  async createUser(input: z.infer<typeof UserSchema>) {
    // Input is guaranteed to be valid
    return await this.userRepo.create(input);
  }
}
```

That's it. Your method now validates input automatically and throws clear errors when something's wrong.

## Core philosophy

### Contracts as guardrails, not obstacles

Think of contracts like TypeScript for runtime behavior. They catch problems before they become disasters, but they don't get in your way when you're building features.

### Layer-based protection

```typescript
// API layer: Validate requests, check rate limits
@contract({
  requires: [validates(schema), rateLimit("api", 100)],
  layer: "presentation"
})

// Service layer: Check auth, enforce business rules
@contract({
  requires: [auth("user"), businessRule("rule", check)],
  layer: "service"
})

// Data layer: Ensure data integrity, retry on failure
@contract({
  requires: [validates(schema)],
  retryAttempts: 3,
  layer: "data"
})
```

Each layer handles what it's good at. No missed checks, no forgotten validations.

### Fail fast, fail clearly

When something goes wrong, you know exactly what and where:

```typescript
// Clear error messages
ContractViolationError: Email validation failed in UserService.createUser
  at service layer: Email must be unique
  Code: BUSINESS_RULE_VIOLATION
```

## Getting started patterns

### Pattern 1: Protect your database operations first

Start with your repositories - these are your last line of defense:

```typescript
class UserRepository {
  @contract({
    requires: [validates(CreateUserSchema)],
    ensures: [returns(UserSchema)],
    layer: "data",
    retryAttempts: 3,
  })
  async create(userData: CreateUserInput) {
    return await this.db.user.create({ data: userData });
  }
}
```

### Pattern 2: Add auth to your services

```typescript
class UserService {
  @contract({
    requires: [auth("user")],
    ensures: [auditLog("user_action")],
    layer: "service",
  })
  async updateProfile(userId: string, data: UpdateData) {
    return await this.userRepo.update(userId, data);
  }
}
```

### Pattern 3: Rate limit your APIs

```typescript
class UserController {
  @contract({
    requires: [
      validates(RequestSchema),
      rateLimit("create_user", 10), // 10 per minute
    ],
    layer: "presentation",
  })
  async createUser(request: CreateUserRequest) {
    return await this.userService.createUser(request);
  }
}
```

### Pattern 4: Use templates for consistency

```typescript
import { ContractTemplates } from "zerot";

// One-liner for common patterns
@contract(ContractTemplates.userCRUD("user"))
async createUser(input: UserInput) { /* implementation */ }

@contract(ContractTemplates.adminOnly("delete_user"))
async deleteUser(userId: string) { /* implementation */ }
```

Perfect for AI code generation - just tell it to use `ContractTemplates.userCRUD()` and you get consistent security.

## Next.js made simple

### Setup for Next.js projects

```typescript
// lib/zerot-setup.ts
import { configureZerot, createNextjsAdapter } from "zerot";

const adapter = createNextjsAdapter({
  sessionCookieName: "auth-token",
});

await configureZerot({
  sessionProvider: () => adapter.extractUser(request),
});
```

### Protect your API routes

```typescript
// app/api/users/route.ts
import { createZerotApiHandler } from "zerot";

const handler = createZerotApiHandler(adapter, async (request) => {
  const userService = new UserService();
  const data = await request.json();

  // Contracts work automatically with Next.js context
  return Response.json(await userService.createUser(data));
});

export { handler as POST };
```

### JWT sessions in 3 lines

```typescript
import { NextjsSessionUtils } from "zerot";

const sessions = new NextjsSessionUtils(process.env.JWT_SECRET);
const token = await sessions.createJWTSession(user);
// Set token in cookie, you're done
```

## Configuration that makes sense

### Development mode

```typescript
import { ZerotPresets } from "zerot";

await configureZerot({
  ...ZerotPresets.development(), // Debug logs, helpful errors
  sessionProvider: () => getMySession(),
});
```

### Production mode

```typescript
await configureZerot({
  ...ZerotPresets.production(), // Optimized, secure defaults
  sessionProvider: () => getMySession(),
});
```

### Custom setup

```typescript
await configureZerot({
  sessionProvider: () => getMySession(),

  // Simple overrides
  enableAuditLogging: true,
  defaultRetryAttempts: 3,
  sensitiveFields: ["password", "token"],

  // Or go full custom
  customLogger: myLogger,
  rateLimitMaxEntries: 100000,
});
```

## Real-world examples

### E-commerce order processing

```typescript
class OrderService {
  @contract({
    requires: [
      auth("user"),
      validates(OrderSchema),
      businessRule("Stock available", async (order) => {
        return await this.checkStock(order.items);
      }),
      businessRule("Payment valid", async (order) => {
        return await this.validatePayment(order.payment);
      }),
    ],
    ensures: [
      auditLog("order_created"),
      businessRule("Inventory updated", async (result) => {
        return await this.verifyInventoryUpdate(result.orderId);
      }),
    ],
    layer: "service",
  })
  async createOrder(orderData: OrderInput) {
    // All validations pass before this runs
    const order = await this.orderRepo.create(orderData);
    await this.updateInventory(order.items);
    await this.sendConfirmationEmail(order);
    return order;
  }
}
```

### User management with ownership

```typescript
class ProfileService {
  @contract({
    requires: [
      auth("user"),
      owns("userId"), // User can only edit their own profile
      validates(ProfileUpdateSchema),
    ],
    ensures: [auditLog("profile_updated")],
    layer: "service",
  })
  async updateProfile(input: { userId: string; data: ProfileData }) {
    return await this.userRepo.update(input.userId, input.data);
  }
}
```

### Admin operations

```typescript
class AdminService {
  @contract({
    requires: [
      auth("admin"),
      rateLimit("admin_action", 20), // Stricter limits for admin
      validates(AdminActionSchema),
    ],
    ensures: [
      auditLog("admin_action", { includeInput: true }), // Full audit trail
    ],
    layer: "service",
  })
  async performAdminAction(action: AdminAction) {
    return await this.executeAdminAction(action);
  }
}
```

## Debugging and monitoring

### See what's happening

```typescript
import { ContractDebugger } from "zerot";

// Get a report of all contract executions
console.log(ContractDebugger.getContractReport());

// Filter by what you care about
const failures = ContractDebugger.getHistoryByStatus("failure");
const serviceLayer = ContractDebugger.getHistoryByLayer("service");
```

### Performance insights

```typescript
import { ContractPerformanceMonitor } from "zerot";

// See your slowest operations
const report = ContractPerformanceMonitor.getPerformanceReport();
console.log("Bottlenecks:", report.slice(0, 5));
```

### Custom metrics

```typescript
import { Metrics } from "zerot";

// Track what matters to your app
Metrics.increment("user_signups");
Metrics.record("api_response_time", responseTime);
Metrics.gauge("active_users", userCount);
```

## Error handling you'll actually use

### Layer-based error responses

```typescript
try {
  await userService.createUser(input);
} catch (error) {
  if (error instanceof ContractViolationError) {
    switch (error.layer) {
      case "presentation":
        return NextResponse.json({ error: "Bad request" }, { status: 400 });
      case "service":
        return NextResponse.json({ error: error.message }, { status: 403 });
      case "data":
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
  }
}
```

### Testing contracts

```typescript
import { ZerotPresets } from "zerot";

beforeEach(async () => {
  await configureZerot({
    ...ZerotPresets.testing(), // Predictable test environment
    sessionProvider: () => ({
      user: { id: "test-user", roles: ["user"] },
    }),
  });
});

test("validates input", async () => {
  await expect(userService.createUser(invalidInput)).rejects.toThrow(
    "Validation failed"
  );
});
```

## Quick reference

### Common contracts

```typescript
// Input validation
@contract({ requires: [validates(Schema)] })

// Auth required
@contract({ requires: [auth("user")] })

// Rate limiting
@contract({ requires: [rateLimit("operation", 10)] })

// Resource ownership
@contract({ requires: [owns("resourceId")] })

// Business rules
@contract({
  requires: [businessRule("Description", checkFunction)]
})

// Audit logging
@contract({ ensures: [auditLog("action")] })

// Retry on failure
@contract({ retryAttempts: 3 })

// Layer classification
@contract({ layer: "service" })
```

### Templates for common patterns

```typescript
import { ContractTemplates, ExtendedContractTemplates } from "zerot";

// Basic patterns
ContractTemplates.userCRUD("user");
ContractTemplates.adminOnly("action");
ContractTemplates.publicAPI("endpoint");

// Advanced patterns
ExtendedContractTemplates.secureCRUD({
  role: "user",
  resourceField: "userId",
  inputSchema: Schema,
  operation: "update",
});
```

### All exports

```typescript
// Core
export { contract, ContractError, ContractViolationError } from "zerot";

// Conditions
export {
  auth,
  owns,
  validates,
  returns,
  rateLimit,
  auditLog,
  businessRule,
} from "zerot";

// Templates
export {
  ContractTemplates,
  ExtendedContractTemplates,
  smartContract,
} from "zerot";

// Configuration
export { configureZerot, ZerotPresets } from "zerot";

// Next.js
export {
  createNextjsAdapter,
  createZerotApiHandler,
  NextjsSessionUtils,
} from "zerot";

// Development
export { ContractDebugger, ContractPerformanceMonitor, Metrics } from "zerot";
```

---

**Ready to make your backend unbreakable?** Start with one `@contract` on your most critical method. Add more as you go. Your future self will thank you.

## License

MIT - Build something awesome.
