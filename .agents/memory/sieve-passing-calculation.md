---
name: Sieve passing calculation
description: The retained-mass and blank-row rules used for sieve report calculations.
---

Sieve passing mass is calculated as sample weight minus the cumulative retained amount through the current sieve row. Blank reference-only rows do not contribute retained mass and do not block calculations for later entered rows.

**Why:** Sieve analysis reports cumulative passing mass; subtracting each row independently produces incorrect values when material is retained on multiple sieves. Reference data can include sieve sizes that were not measured.

**How to apply:** Keep form previews, save-time evaluation, report refreshes, and regression tests aligned with this cumulative rule. Treat an explicitly entered invalid amount differently from an unmeasured blank row.