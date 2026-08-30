---
name: Reference-data seeding
description: Durable rule for adding new QC reference-data categories to existing databases.
---

When introducing a new seeded reference-data category, startup initialization must reconcile each category independently: create missing categories, locate existing categories when inserts conflict, and add any missing default items.

**Why:** Existing QC databases already contain reference categories, so a global “database is non-empty” early return silently prevents newly introduced categories from appearing.

**How to apply:** Keep seed reconciliation idempotent and conflict-safe whenever new lookup values are added to the QC application.