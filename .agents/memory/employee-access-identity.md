---
name: Employee access identity
description: The QC authentication directory and administrator access list use registered employee IDs.
---

The QC app's current sign-in flow creates authenticated users with IDs in the form `employee:<registered-id>` and no email address. Employee approvals and the administrator allowlist therefore use the normalized registered employee ID.

**Why:** The employee-ID directory is the existing login method; treating its sessions as email-based would authenticate employees successfully but deny every access-list check.

**How to apply:** When extending authentication or access administration, derive the employee ID from the authenticated user ID and keep the existing employee-ID sign-in flow as the only login path.