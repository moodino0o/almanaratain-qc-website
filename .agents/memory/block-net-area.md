---
name: Block net area
description: User-specified area label and calculation for Blocks, distinct from Paving Blocks.
---

For Blocks outside Dammam, display the area as “Net Area” and calculate it as specimen width × length. For Dammam Blocks, gross area is specimen width × length; net area subtracts the total area of all holes. Hole width = block width − 2 × face thickness. Hole length = (block length − 2 × face thickness − (hole count − 1) × web thickness) ÷ hole count. Paving Blocks retain their distinct tensile-area calculation based on length × height.

**Why:** Dammam Block records include face/web geometry and hole count, so width × length alone is gross area rather than the net compression area.

**How to apply:** Use the same Dammam hole-width and hole-length equations in frontend and server calculations. Keep width × length for other Block records and do not apply either Block formula to Paving Blocks.