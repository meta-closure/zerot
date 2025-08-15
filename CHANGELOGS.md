# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## 1.0.0

### Added

- Initial development version
- Core `@contract` decorator implementation
- Built-in conditions: `auth`, `validates`, `returns`, `rateLimit`, `auditLog`, `businessRule`, `owns`
- Zod schema validation integration
- Next.js Server Actions integration (`createServerAction`)
- Next.js Middleware integration (`withContractMiddleware`)
- Contract debugging and performance monitoring utilities
- TypeScript support with full type definitions

### Security

- Authentication and authorization framework
- Resource ownership validation
- Rate limiting capabilities
