---
name: Block derived strengths
description: Formula and rounding rules for Block compression air-dry and normalized strength.
---

For every Block specimen, compliance averages, minimums, maximums, and pass/fail decisions use air-dry strength. Outside Dammam, air-dry strength equals wet strength multiplied by 1.2; in Dammam, water strength and air-dry strength are equal. Normalized strength uses the rounded air-dry strength multiplied by the record's shape factor. Round derived values to one decimal place.

**Why:** The source report did not document these equations; the user supplied the air-dry compliance basis and Dammam exception directly.

**How to apply:** Recalculate the values on the server before saving whenever the required inputs are available. Use air-dry values in server evaluation and report summaries. Hide the Dammam water-strength column in printable reports. Client calculations are previews only, and historical manual values remain readable when inputs are missing.