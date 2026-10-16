---
name: Employee activity audit
description: Safety and accuracy rules for employee session history and mutation auditing.
---

Never store raw session bearer IDs in activity history; use a one-way fingerprint. Record successful data mutations only and redact passwords, tokens, cookies, and credentials from captured request details. An explicit sign-out has a confirmed end time; a browser closed or abandoned without sign-out only provides an expiry and last-seen time, not an exact human departure time.

Administrator-facing activity details should present submitted field names and values in a readable layout, not raw JSON or code. Include successful record creation and other successful mutations in the log; clearly indicate when a large payload has been shortened.

**Why:** Session IDs are authentication secrets, and browser abandonment cannot reveal when a person actually stopped working. Reporting inferred expiry as an exact departure would overstate what the system knows. The user also asked for an activity view that makes each employee's changes easy to inspect.

**How to apply:** Preserve these distinctions in audit storage, API responses, and administrator-facing activity views. Label `lastSeenAt` as last confirmed activity and identify expiry/revocation separately from explicit logout. Render sanitized submitted values with human-readable labels and nested groups.