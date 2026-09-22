---
name: Shape factor defaults
description: The source and compatibility rule for Block shape factor standards.
---

Seed a persistent editable Shape Factor row for each configured Block size using the approved height/width table. Canonical Block sizes use 400 mm length, 200 mm height, and width derived from the inch label: 4" = 100 mm, 6" = 150 mm, 8" = 200 mm, and 12" = 300 mm. An explicitly saved record value remains authoritative.

**Why:** The user supplied the approved table, and shape factor changes normalized Block strength. The 12-inch width must be treated as 300 mm; the table's ≥250 mm column supplies its 1.10 factor.

**How to apply:** Match defaults by normalized Block size, reconcile missing defaults into the Standards editor, keep that editor able to set or clear a value, and preserve legacy record-level shape factors when applying future defaults. Leave unsupported legacy dimensions without an automatic factor.