---
name: Block net area
description: User-specified area label and calculation for Blocks, distinct from Paving Blocks.
---

For Blocks outside Dammam, display the area as “Net Area” and calculate it as specimen width × length. For Dammam Blocks, subtract the calculated hole area from the gross face area using the size-derived hole count and face/web dimensions. Paving Blocks retain their distinct tensile-area calculation based on length × height.

**Why:** Dammam Block records include face/web geometry and hole count, so width × length alone is gross area rather than the net compression area.

**How to apply:** Use hole-adjusted Net Area for Dammam Block results only; keep width × length for other Block records and do not apply either Block formula to Paving Blocks.