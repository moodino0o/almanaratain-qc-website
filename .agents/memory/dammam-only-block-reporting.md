---
name: Dammam-only Block reporting
description: Project scope rule for Dammam Block geometry, strength results, and reports.
---

Apply the face/web, hole-count, net-area, and added strength-result behavior only to records at Dammam or Dammam Plant. Other plants must keep their existing Block calculations and report output.

For Dammam Block records, use Net Area instead of Gross Area in reports and Net Strength instead of Air Dry Strength for displayed results and summaries. Keep Gross and Net Strength visible, omit Normalized Strength and Face/Web Thickness, and keep Number of Holes out of Test Details. Preserve editable per-specimen Face/Web inputs and their calculations.

**Why:** the request explicitly limited the new behavior to Dammam and required other plants to remain unchanged.

**How to apply:** gate new inputs, persisted result fields, and report behavior on Dammam location matching; use Net Strength as the Dammam aggregate basis while preserving legacy calculations and report layouts elsewhere.
