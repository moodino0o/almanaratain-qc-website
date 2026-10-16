---
name: Sieve passing calculation
description: The retained-mass and blank-row rules used for sieve report calculations.
---

Sieve sample weight is calculated as the sum of valid retained amounts entered across the sieve rows. Passing mass is that calculated total minus the cumulative retained amount through the current sieve row. Blank reference-only rows do not contribute retained mass and do not block calculations for later entered rows.

**Why:** Sieve analysis reports cumulative passing mass; subtracting each row independently produces incorrect values when material is retained on multiple sieves. The total sample must reflect the actual retained entries, and reference data can include sieve sizes that were not measured.

**How to apply:** Keep the read-only calculated sample weight and all form previews, save-time evaluation, report refreshes, and regression tests aligned with this rule. Treat an explicitly entered invalid amount differently from an unmeasured blank row.