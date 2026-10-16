---
name: Block defaults compatibility
description: The compatibility boundary between new Block standards and legacy Block records
---

New seeded Block standards use the canonical `Concrete Block` material with `Plain Block`, `Lined Block`, or `Sandwich Insulation Block` types and inch size labels. Legacy Block materials, type labels, and dimension strings remain readable and are not rewritten unless a missing dimension can be safely inferred.

**Why:** Existing records use older labels and dimension strings, while the new standards and entry flow need stable labels for matching and predictable defaults.

**How to apply:** Preserve legacy values during edits and migrations. Apply new defaults only to missing dimensions, and treat canonical labels as the target for newly created standards and records.