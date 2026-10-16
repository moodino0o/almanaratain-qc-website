---
name: Block derived strengths
description: Formula and rounding rules for Block compression air-dry and normalized strength.
---

Outside Dammam, Block air-dry strength equals wet strength multiplied by 1.2; normalized strength uses rounded air-dry strength multiplied by the record's shape factor. Dammam non-sandwich Blocks use Net Strength (failure load divided by Dammam Net Area) for displayed specimen results and average/minimum/maximum summaries. Dammam Block Types containing “sandwich” use gross strength as Air-dry Strength, derive Water Strength as Air-dry ÷ 1.2, and calculate Normalized Strength from Air-dry × the existing shape factor; compliance and summaries use Air-dry Strength.

Use the matching Dammam basis everywhere Blocks are presented, including the QC register, daily results, XLSX exports, entry, details, compliance and print reports. Recalculate from specimen geometry/load where possible; never substitute an ambiguous legacy average when the applicable result cannot be calculated.

**Why:** The user confirmed that sandwich Block Types are an exception to the established Dammam Net Strength basis, while other Dammam Blocks and plants must retain their existing behavior.

**How to apply:** Detect “sandwich” case-insensitively within the Dammam Block Type. Keep non-sandwich Dammam strength tied to hole-adjusted Net Area; use Gross Area for sandwich Air-dry strength. Preserve the existing calculation basis for other plants.