---
name: Database backup safety
description: Production-source verification and exact-value handling for downloadable SQL exports.
---

Confirm the requested database environment before making a backup. The workspace connection is not proof that an export came from the deployed site; use explicitly production-scoped access for production data.

**Why:** A workspace dump was initially delivered when the user intended the deployed site's database.

Preserve PostgreSQL bigint values as text when catalog metadata crosses JSON into JavaScript, and preserve raw row JSON rather than parsing and reserializing numeric values.

**Why:** JavaScript rounded a bigint sequence maximum beyond PostgreSQL's allowed range during a production logical export.

**How to apply:** Verify the source, retain exact numeric text, and test restoration in an isolated temporary database before describing a SQL file as restorable. Disclose when a batched logical export is not a transaction-consistent snapshot, and distinguish database contents from external uploaded file bytes.
