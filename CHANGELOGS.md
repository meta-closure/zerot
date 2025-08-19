# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.1]

### Added

- **Enhanced Template System**: New `ExtendedContractTemplates` with advanced patterns
  - `secureCRUD()` - Full CRUD operations with ownership validation
  - `publicEndpoint()` - Public API endpoints with rate limiting
  - `adminOperation()` - Admin-only operations with enhanced security
  - `dataOperation()` - Data layer operations with retry logic
  - `userOperation()` - User-specific operations with ownership checks
- **Contract Factory**: Type-safe factory functions for common CRUD patterns
  - `ContractFactory.create()` - Create operations
  - `ContractFactory.read()` - Read operations with ownership
  - `ContractFactory.update()` - Update operations with validation
  - `ContractFactory.delete()` - Delete operations with safety checks
- **Smart Contract Templates**: `smartContract()` function for automatic contract inference
- **Advanced Contract Composition**:
  - `ContractHelpers.combine()` - Functional contract composition
  - `ContractHelpers.withBusinessRules()` - Business rule helpers
  - `ContractHelpers.withRetry()` - Retry configuration helpers
- **Enhanced Rate Limiting**:
  - `clearRateLimit()` - Clear specific user/operation rate limits
  - `getRateLimitStatus()` - Check current rate limit status
  - `clearAllRateLimits()` - Clear all rate limits (testing utility)
  - `checkRateLimit()` - Read-only rate limit checking
- **Audit Logging Enhancements**:
  - `auditLogFailure()` - Specialized failure logging
  - Enhanced `auditLog()` with options: `includeInput`, `includeOutput`, `metadata`
  - Improved sensitive data sanitization
- **Framework Integration**:
  - **Adapter System**: `BaseAdapter`, `AdapterRegistry` for framework integration
  - **Next.js Adapter**: `NextjsAdapter` with automatic context extraction
  - **Request Context Management**: `createRequestContext()`, `withRequestContext()`, `getRequestContext()`
- **Configuration Enhancements**:
  - **Environment Presets**: Enhanced `ZerotPresets` with better defaults
  - **Runtime Configuration**: `zerotConfig.set()`, `zerotConfig.get()` for dynamic updates
  - **Configuration Validation**: Improved validation with warnings and error categorization

### Changed

- **BREAKING**: Removed legacy Next.js integrations (`createServerAction`, `withContractMiddleware`)
- **BREAKING**: Import paths changed from `~/` to `@/` internally
- **Enhanced Type Safety**: All conditions now support generic type parameters
  - `auth<T>()`, `owns<T>()`, `businessRule<T>()`, `validates<T, U>()`
- **Improved Error Handling**: Better error messages and structured error information
- **Configuration System**: Moved from individual providers to unified `configureZerot()` system
- **Performance Improvements**: Enhanced condition caching and execution optimization
- **Node.js Requirement**: Updated minimum Node.js version to 20.0.0

### Fixed

- **Type Safety**: Fixed type inference issues in contract conditions
- **Memory Leaks**: Improved cleanup in rate limiting and caching systems
- **Error Propagation**: Better error handling in nested contract executions
- **Resource Provider**: Enhanced error handling in resource ownership checks
- **Audit Logging**: Fixed sensitive field sanitization edge cases

### Security

- **Enhanced Input Sanitization**: Expanded sensitive field detection
- **Stricter Validation**: Improved schema validation error handling
- **Audit Trail**: More comprehensive audit logging with failure tracking
- **Rate Limiting**: Enhanced rate limiting with better memory management

### Developer Experience

- **Improved Documentation**: Complete API reference with accurate examples
- **Better Error Messages**: More descriptive contract violation errors
- **Debug Mode**: Enhanced debugging with execution tracing
- **Testing Support**: Better testing utilities and mocking capabilities

### Internal

- **Code Organization**: Major refactoring with improved module structure
- **Test Coverage**: Expanded test suite with better coverage
- **Build System**: Updated build configuration and TypeScript settings
- **Dependencies**: Updated peer dependencies and dev dependencies

---

## [1.0.0]

### Added

- Initial development version
- Core `@contract` decorator implementation
- Built-in conditions: `auth`, `validates`, `returns`, `rateLimit`, `auditLog`, `businessRule`, `owns`
- Zod schema validation integration
- Next.js Server Actions integration (`createServerAction`) **[DEPRECATED in 1.0.1]**
- Next.js Middleware integration (`withContractMiddleware`) **[DEPRECATED in 1.0.1]**
- Contract debugging and performance monitoring utilities
- TypeScript support with full type definitions

### Security

- Authentication and authorization framework
- Resource ownership validation
- Rate limiting capabilities

---

## Migration Guide from 1.0.0 to 1.0.1

### Breaking Changes

1. **Next.js Integration**: Legacy integrations removed

   ```typescript
   // ❌ Removed in 1.0.1
   import { createServerAction, withContractMiddleware } from "zerot";

   // ✅ Use new adapter system
   import { NextjsAdapter, withZerotContext } from "zerot/core";
   ```

2. **Configuration System**: Unified configuration

   ```typescript
   // ❌ Old way (1.0.0)
   setSessionProvider(sessionProvider);
   setResourceProvider(resourceProvider);

   // ✅ New way (1.0.1)
   await configureZerot({
     sessionProvider,
     resourceProvider,
   });
   ```

### New Features to Adopt

1. **Enhanced Templates**:

   ```typescript
   // Use new extended templates
   import { ExtendedContractTemplates } from "zerot/templates";

   @contract(ExtendedContractTemplates.secureCRUD({
     role: "user",
     resourceField: "userId",
     inputSchema: UserSchema,
     outputSchema: UserOutputSchema,
     operation: "update_profile"
   }))
   ```

2. **Type Safety Improvements**:

   ```typescript
   // Enhanced type safety
   @contract({
     requires: [
       auth<UserInput>("user"),
       owns<{ documentId: string }>("documentId")
     ]
   })
   ```

3. **Request Context Management**:

   ```typescript
   import { withRequestContext, createRequestContext } from "zerot/core";

   const context = createRequestContext({ user, session });
   await withRequestContext(context, () => userService.createUser(input));
   ```
