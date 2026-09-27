---
name: Employee activity audit
description: Safety and accuracy rules for employee session history and mutation auditing.
---

Never store raw session bearer IDs in activity history; use a one-way fingerprint. Record successful data mutations only and redact passwords, tokens, cookies, and credentials from captured request details. An explicit sign-out has a confirmed end time; a browser closed or abandoned without sign-out only provides an expiry and last-seen time, not an exact human departure time.

**Why:** Session IDs are authentication secrets, and browser abandonment cannot reveal when a person actually stopped working. Reporting inferred expiry as an exact departure would overstate what the system knows.

**How to apply:** Preserve these distinctions in audit storage, API responses, and administrator-facing activity views. Label `lastSeenAt` as last confirmed activity and identify expiry/revocation separately from explicit logout.