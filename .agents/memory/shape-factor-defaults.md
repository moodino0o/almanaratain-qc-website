---
name: Shape factor defaults
description: The source and compatibility rule for Block shape factor standards.
---

Seed a persistent editable Shape Factor row for each configured Block size, but do not invent numeric defaults when the business source has not supplied them. A configured standard fills new entries automatically; an explicitly saved record value remains authoritative.

**Why:** Shape factor changes normalized Block strength, so an unapproved numeric fallback would silently change compliance results.

**How to apply:** Match defaults by normalized Block size, keep the Standards editor able to set or clear a value, and preserve legacy record-level shape factors when applying future defaults.