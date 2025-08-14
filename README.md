# Zerot: Zero-Trust Contracts for TypeScript

[![npm version](https://badge.fury.io/js/zerot.svg)](https://badge.fury.io/js/zerot)
[![npm downloads](https://img.shields.io/npm/dm/zerot.svg)](https://www.npmjs.com/package/zerot)
[![license](https://img.shields.io/npm/l/zerot.svg)](https://github.com/meta-closure/zerot/blob/main/LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)

> **Stop trusting your code. Start proving it works.**

Zerot brings **Design by Contract** to TypeScript with a simple decorator that automatically validates inputs, enforces permissions, and logs actions. Perfect for APIs, Next.js apps, and anywhere you need bulletproof code.

## 🤔 The Problem

```typescript
// Typical API endpoint - what could go wrong?
async function updateUser(userId: string, data: any, req: Request) {
  // ❌ No input validation
  // ❌ No authentication check
  // ❌ No ownership verification
  // ❌ No audit logging
  // ❌ No rate limiting

  return await db.user.update({ where: { id: userId }, data });
}
```

**Everything.** This code is vulnerable to:

- Invalid data crashes
- Unauthorized access
- Data breaches
- No audit trail
- DoS attacks

## ✅ The Solution

```typescript
@contract({
  requires: [
    auth('user'),                    // Must be logged in
    validates(UserUpdateSchema),     // Input must be valid
    owns('userId'),                  // Must own the resource
    rateLimit('updateUser', 10)      // Max 10 calls per minute
  ],
  ensures: [
    auditLog('user_updated')         // Log the action
  ]
})
async function updateUser(data: UserUpdate, context: AuthContext) {
  // ✅ All validation handled automatically
  // ✅ Only business logic here
  return await db.user.update({ where: { id: data.userId }, data });
}
```

One decorator. Complete security. Zero trust.

## 🚀 30-Second Install

```bash
npm install zerot zod
```

```typescript
import { contract, auth, validates } from "zerot";

// That's it. Start adding contracts to your functions.
```

## ⚡ Quick Examples

### Basic Example

```typescript
import { contract, auth, validates } from "zerot";
import { z } from "zod";

const CreatePostSchema = z.object({
  title: z.string().min(1).max(100),
  content: z.string().min(10),
});

class BlogService {
  @contract({
    requires: [
      auth("user"), // Must be logged in
      validates(CreatePostSchema), // Must have valid title & content
    ],
  })
  async createPost(input: { title: string; content: string }) {
    // Input is guaranteed to be valid
    // User is guaranteed to be authenticated
    return await db.post.create({ data: input });
  }
}
```

### Next.js Server Action

```typescript
"use server";
import { createServerAction } from 'zerot/integrations/server-actions';

const blogService = new BlogService();

// Automatically handles auth, validation, and errors
export const createPost = createServerAction(blogService.createPost);

// Use in your component
export default function CreatePostForm() {
  return (
    <form action={createPost}>
      <input name="title" required />
      <textarea name="content" required />
      <button type="submit">Create Post</button>
    </form>
  );
}
```

## 🛡️ Built-in Security

### Authentication & Authorization

```typescript
@contract({ requires: [auth()] })              // Any logged-in user
@contract({ requires: [auth('admin')] })       // Admins only
@contract({ requires: [auth('user')] })        // Specific role
```

### Input Validation

```typescript
const UserSchema = z.object({
  email: z.string().email(),
  age: z.number().min(18)
});

@contract({ requires: [validates(UserSchema)] })
async createUser(data: UserInput) {
  // data is guaranteed to match schema
}
```

### Resource Ownership

```typescript
@contract({
  requires: [
    auth('user'),
    owns('documentId')  // User must own this document
  ]
})
async editDocument(data: { documentId: string, content: string }) {
  // Only the document owner can edit
}
```

### Rate Limiting

```typescript
@contract({ requires: [rateLimit('sendEmail', 5)] })  // 5 per minute
async sendEmail(to: string, message: string) {
  // Automatically rate limited
}
```

### Audit Logging

```typescript
@contract({ ensures: [auditLog('sensitive_action')] })
async deleteSensitiveData(id: string) {
  // Action is automatically logged
}
```

## 🎯 Real-World Example

```typescript
// E-commerce order processing with full security
@contract({
  requires: [
    auth('user'),
    validates(z.object({
      items: z.array(z.object({
        productId: z.string(),
        quantity: z.number().positive()
      })),
      paymentMethod: z.string(),
      shippingAddress: z.string()
    })),
    rateLimit('createOrder', 3),           // Prevent order spam
    businessRule(
      'Cart must not be empty',
      (input) => input.items.length > 0
    ),
    businessRule(
      'User must have valid payment method',
      async (input, context) => {
        return await hasValidPayment(context.user.id);
      }
    )
  ],
  ensures: [
    auditLog('order_created'),             // Log for compliance
    returns(z.object({                     // Validate response
      orderId: z.string(),
      status: z.enum(['pending', 'confirmed']),
      total: z.number()
    }))
  ]
})
async createOrder(input: OrderInput, context: AuthContext) {
  // All validation done - just business logic
  const order = await processOrder(input, context.user.id);
  await sendConfirmationEmail(context.user.email, order);
  return order;
}
```

## 🔧 5-Minute Setup

### 1. Configure providers (one time)

```typescript
// lib/zerot-config.ts
import { setSessionProvider, setResourceProvider } from "zerot";
import { getServerSession } from "next-auth"; // or your auth

export async function setupZerot() {
  // Configure how to get the current user
  setSessionProvider(async () => {
    const session = await getServerSession();
    return {
      user: session?.user
        ? {
            id: session.user.id,
            roles: session.user.roles || ["user"],
          }
        : undefined,
      session: session
        ? {
            id: session.sessionId,
            expiresAt: new Date(session.expires),
          }
        : undefined,
    };
  });

  // Configure how to check resource ownership
  setResourceProvider(async (resourceId) => {
    const resource = await db.findResourceById(resourceId);
    return resource
      ? {
          id: resource.id,
          userId: resource.userId,
        }
      : null;
  });
}
```

### 2. Initialize in your app

```typescript
// app/layout.tsx (Next.js) or main.ts
import { setupZerot } from "./lib/zerot-config";

await setupZerot();
```

### 3. Start using contracts

```typescript
// That's it! Add @contract to any function
@contract({
  requires: [auth('user'), validates(MySchema)],
  ensures: [auditLog('action_performed')]
})
async mySecureFunction(input: MyInput) {
  // Your code here
}
```

## 🎨 Framework Integration

### Next.js Server Actions

```typescript
"use server";
import { createServerAction } from "zerot/integrations/server-actions";

class UserActions {
  @contract({
    requires: [auth("user"), validates(UserSchema)],
    ensures: [auditLog("profile_updated")],
  })
  async updateProfile(input: UserInput) {
    return await userService.update(input);
  }
}

// Automatically handles auth/validation/errors
export const updateProfile = createServerAction(
  new UserActions().updateProfile
);
```

### Express.js

```typescript
import express from "express";

const app = express();

class ApiController {
  @contract({
    requires: [auth("user"), validates(CreateUserSchema)],
    ensures: [auditLog("user_created")],
  })
  async createUser(input: CreateUserInput) {
    return await userService.create(input);
  }
}

const api = new ApiController();

app.post("/users", async (req, res) => {
  try {
    const result = await api.createUser(req.body);
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

### tRPC

```typescript
import { contract } from "zerot";

const userRouter = router({
  create: procedure
    .use(async (opts) => {
      // Apply contract as middleware
      const contractedFn = applyContract(
        { requires: [auth("user"), validates(UserSchema)] },
        async (input: UserInput) => {
          return await userService.create(input);
        }
      );

      return contractedFn(opts.input);
    })
    .mutation(({ input }) => input),
});
```

## 🧪 Template System

Pre-built contracts for common patterns:

```typescript
import { ContractTemplates } from 'zerot/templates';

// CRUD operations
@contract(ContractTemplates.userCRUD('admin'))
async updateUser(input: UserUpdate) { /* ... */ }

// Admin-only actions
@contract(ContractTemplates.adminOnly('delete_user'))
async deleteUser(userId: string) { /* ... */ }

// Public API endpoints
@contract(ContractTemplates.publicAPI('search'))
async searchUsers(query: string) { /* ... */ }

// Auto-generated contracts
@contract(smartContract({
  operation: 'create',
  resource: 'post',
  visibility: 'private',     // 'public', 'private', or 'admin'
  rateLimit: 10
}))
async createPost(input: PostInput) { /* ... */ }
```

## 🚨 Error Handling

Contracts throw `ContractViolationError` with helpful details:

```typescript
try {
  await userService.updateProfile(invalidData);
} catch (error) {
  if (error instanceof ContractViolationError) {
    console.log(error.layer); // 'business', 'action', etc.
    console.log(error.contractName); // 'UserService.updateProfile'
    console.log(error.message); // 'Input validation failed: email is invalid'

    // Get appropriate response for your framework
    const response = error.getAppropriateResponse();
    // Returns: { success: false, error: "Input validation failed" }
  }
}
```

## 📊 Monitoring & Debugging

### Performance Monitoring

```typescript
import { ContractPerformanceMonitor } from "zerot/utils";

// Get performance report
const report = ContractPerformanceMonitor.getPerformanceReport();
console.log(report);
/*
[
  {
    contract: "UserService.createUser",
    executions: 150,
    avgTimeMs: 45.2,
    failureRate: "2.0%"
  }
]
*/
```

### Debug Mode

```typescript
import { ContractDebugger } from "zerot/utils";

// In development, see all contract executions
const report = ContractDebugger.getContractReport();
console.log(report);
/*
{
  total: 50,
  success: 47,
  failure: 3,
  successRate: "94.0%",
  layerStats: {
    action: { success: 20, failure: 1 },
    business: { success: 27, failure: 2 }
  }
}
*/
```

## 🔄 Migration Guide

### From Manual Validation

```typescript
// Before: Manual everything
async createUser(req: Request, res: Response) {
  // Manual auth check
  if (!req.user || !req.user.roles.includes('admin')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Manual validation
  if (!req.body.email || !isEmail(req.body.email)) {
    return res.status(400).json({ error: 'Invalid email' });
  }

  // Manual audit log
  await auditLogger.log('user_created', req.user.id);

  // Finally, business logic
  const user = await userService.create(req.body);
  res.json(user);
}

// After: Contract handles everything
@contract({
  requires: [
    auth('admin'),
    validates(UserSchema)
  ],
  ensures: [
    auditLog('user_created')
  ]
})
async createUser(input: UserInput) {
  // Only business logic needed
  return await userService.create(input);
}
```

## 📚 Examples Repository

Check out `/examples` for complete working applications:

- **`examples/nextjs-todo-app/`** - Next.js 14 with Server Actions
- **`examples/express-api/`** - Express.js REST API
- **`examples/trpc-app/`** - tRPC with contracts

```bash
# Try the examples
git clone https://github.com/meta-closure/zerot.git
cd zerot/examples/nextjs-todo-app
npm install && npm run dev
```

## ❓ FAQ

### "How is this different from middleware?"

Middleware runs for every request. Contracts run per-function and compose together:

```typescript
// Multiple contracts on one function
@contract(ContractTemplates.userCRUD('user'))
@contract({ requires: [rateLimit('special', 5)] })
@contract({ ensures: [customAuditLog('special_action')] })
async specialAction(input: SpecialInput) {
  // All contracts applied automatically
}
```

### "Does this hurt performance?"

Contracts are lightweight and don't significantly impact performance:

```typescript
// Performance monitoring built-in
import { ContractPerformanceMonitor } from "zerot/utils";

const report = ContractPerformanceMonitor.getPerformanceReport();
// See actual execution times and optimize accordingly
```

### "Can I use this with existing auth systems?"

Yes! Zerot adapts to your auth:

```typescript
await configureZerot({
  sessionProvider: async () => {
    // Use your existing auth system
    const user = await getCurrentUser(); // Your function
    return { user };
  },
});
```

### "What about testing?"

Contracts make testing easier:

```typescript
// Test contracts separately from business logic
it("should enforce user authentication", async () => {
  await expect(
    userService.createUser(validInput, noAuthContext)
  ).rejects.toThrow("User must be logged in");
});

// Test business logic with valid contracts
it("should create user successfully", async () => {
  const result = await userService.createUser(validInput, authContext);
  expect(result.id).toBeDefined();
});
```

## 🤝 Contributing

We love contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for details.

```bash
git clone https://github.com/meta-closure/zerot.git
cd zerot
npm install
npm test
npm run build
```

## 📜 License

MIT License - see [LICENSE](LICENSE) file.
