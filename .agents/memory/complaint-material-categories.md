---
name: Complaint material categories
description: Classification rules for complaint material labels.
---

Classify complaint material text as Ready Mix when it contains OPC or SRC; Block when it contains 4, 6, or 8 inch notation; Paving when it contains 60mm or 80mm. Keep unmatched materials as Other and preserve the original material label.

**Why:** The complaint register uses free-text material labels, but QC users need consistent product grouping without losing the source wording.

**How to apply:** Use the derived category for list filters, search, and exports. Apply matching case-insensitively and support common inch and spacing variations.