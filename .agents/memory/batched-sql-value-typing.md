---
name: Batched SQL value typing
description: PostgreSQL type inference for parameterized VALUES rows used in batch updates.
---

When using an interpolated `VALUES` table in PostgreSQL, explicitly cast numeric IDs to the target column type and cast text/JSON values as needed. Untyped parameters can make a `VALUES` column resolve to text, causing comparisons like `serial_id = batch.id` to fail with `integer = text`.

**Why:** QC-standard mutations were followed by batched result recalculation; PostgreSQL rejected the untyped ID comparison after the primary standard write had already committed, so the UI reported a failed save despite a persisted change.

**How to apply:** Use explicit casts in `UPDATE ... FROM (VALUES ...)` queries and assert the ID cast in a regression test.
