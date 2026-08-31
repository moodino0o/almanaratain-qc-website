---
name: OpenAPI Zod compatibility
description: Compatibility constraint between this workspace's OpenAPI generator and pinned Zod version
---
When adding bounded numeric fields to the OpenAPI contract, prefer a bounded `number` unless integer validation is essential; the current generator can emit `z.int()`, which the pinned Zod version does not provide.

**Why:** A generated integer schema caused library typechecking to fail even though the API contract itself was valid.

**How to apply:** After contract changes, run the API-spec code generation and library typecheck before updating dependent server or client code.