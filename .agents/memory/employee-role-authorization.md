---
name: Employee role authorization
description: Durable authorization rules for the QC employee role model and its legacy administrator compatibility.
---

Role permissions must be enforced at the API boundary as well as reflected in the UI. The effective administrator role remains compatible with the legacy administrator flag and configured administrator employee-ID allowlist; role changes must not silently remove those compatibility paths.

**Why:** Existing employee access records and configured administrators predate the role column, so replacing those grants would lock out established administrators or leave mutation endpoints exposed through direct requests.

**How to apply:** When adding a new mutating endpoint or UI action, classify it as QC Register, Complaints, administrator-only settings/reference data, or archive management, then apply the matching server middleware and hide the corresponding control for unauthorized roles.