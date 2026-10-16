---
name: OpenAPI query dates
description: Compatibility note for date-valued query parameters in this workspace's generated API contracts.
---

Date-valued query parameters should be represented as strings in the OpenAPI contract and validated as `YYYY-MM-DD` at the server boundary. With the current Orval/Zod setup, a query parameter declared as `type: string` with `format: date` generates a `z.date()` schema rather than a coercing schema, while HTTP query strings always arrive as strings.

**Why:** A browser request to a date-formatted query endpoint was rejected before the route handler could process it because the generated schema expected a JavaScript `Date`.

**How to apply:** Keep date query inputs string-based, validate the exact format and calendar validity in the route, and reserve date coercion for response/body schemas where the generated contract already supports it.