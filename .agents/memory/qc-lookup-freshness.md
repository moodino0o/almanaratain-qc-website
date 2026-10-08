---
name: QC lookup freshness
description: Performance and freshness rules for editable QC reference data and derived shape-factor defaults.
---

Keep `/api/lookups`, `/api/reference-data`, and `/api/shape-factors` reads live against the database. Cache only idempotent initialization work. After the initial shape-factor reconciliation, reruns triggered by Block-size reference edits should add missing rows without resetting existing editable rows.

**Why:** These endpoints previously repeated sequential setup queries during every read, while caching their returned values could hide administrator edits. A clear performance fix must preserve live data and avoid undoing saved edits.

**How to apply:** Reduce work by narrowing projections and caching reconciliation, not response payloads. Invalidate derived defaults after relevant reference-data mutations, and keep the client’s corresponding query keys fresh.
