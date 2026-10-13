---
name: Eastern plant location aliases
description: Treat Eastern Hidd, Aker, and system labels as one plant in grouped results.
---

Treat `EASTERN Hidd`, `EASTERN Aker`, and `EASTERN system` as the same canonical plant location, `EASTERN`, when grouping or comparing plant locations. Preserve the original location label on individual QC records.

**Why:** The user specified that the three Eastern labels refer to the same plant location; preserving record labels avoids rewriting their entered data.

**How to apply:** Normalize these aliases before report grouping and plant-level summaries. Do not merge unrelated location labels.
