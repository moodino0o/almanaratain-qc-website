---
name: Dammam-only Block reporting
description: Project scope rule for Dammam Block geometry, strength results, and reports.
---

Apply the face/web, hole-count, net-area, and added strength-result behavior only to records at Dammam or Dammam Plant. Other plants must keep their existing Block calculations and report output.

For Dammam non-sandwich Block records, retain size-derived holes, Face/Web inputs, Net Area calculations, and Net Strength reporting. For Dammam Block Types containing “sandwich” (case-insensitive), calculate from Gross Area and show Gross Area, Air-dry Strength, and Normalized Strength; omit Face/Web thickness and net-area results. All other plants keep their existing Block behavior.

**Why:** the user confirmed a Dammam-only sandwich exception and required non-sandwich Blocks and other plants to remain unchanged.

**How to apply:** gate the sandwich exception on both Dammam location and a Block Type containing “sandwich”; use Air-dry Strength for its summaries and compliance. Keep non-sandwich Dammam and every other plant on their established paths.
