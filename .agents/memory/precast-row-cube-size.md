---
name: Precast specimen cube size
description: Compatibility rule for Precast cube dimensions stored per specimen.
---

Use a cube size on each Precast specimen row for data entry, density, strength, and result reporting. New rows default to `100*100*100`.

**Why:** Older Precast records store one shared cube size in record details, so removing the fallback would change their dimensions when edited or reported.

**How to apply:** Prefer each row's saved cube size. When an older row has none, hydrate it from the shared detail value and retain that shared value as a backwards-compatible summary.
