---
name: Archive retirement authorization
description: Authorization boundary for destructive archive document retirement.
---

Archive retirement is fail-closed: only authenticated users whose normalized email is in the server-configured archive manager allowlist may retire documents. The UI capability flag is only a convenience; the API must always enforce the same boundary.

**Why:** The existing authentication model has no persisted role or group membership, while retirement permanently removes both the stored object and its metadata. A server-side allowlist provides an explicit provisioning point without exposing destructive actions to every signed-in user.

**How to apply:** Keep the allowlist server-side, normalize email addresses case-insensitively, return a capability flag for UI affordances, and retain an independent 403 check on every retirement request.