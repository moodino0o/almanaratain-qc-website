---
name: Paving correction factors
description: Paving tensile calculation, report semantics, and size-based correction factors.
---

Paving specimen tensile strength is calculated as 0.637 × load in newtons ÷ (length × height), then multiplied by the size correction factor. Compare the average corrected tensile strength with the matching configured minimum to determine Pass/Fail.

Paving Blocks use the shared shape-factor standards table for size-based correction factors. A size ending in 60 defaults to 0.87 and a size ending in 80 defaults to 1.00; an explicitly saved factor remains authoritative.

Paving specimen weights are entered in grams. Convert wet weight to kilograms before dividing by specimen volume in cubic metres; equivalently, density in kg/m³ is wetWeight(g) × 1,000,000 ÷ volume(mm³). Do not use the kilogram-based Block density calculation for Paving.

**Why:** The attached report supports the tensile calculation, and a 1,000× density error exposed the unit distinction: Paving weights are grams, while the Block density helper expects kilograms.

**How to apply:** Keep Paving measurements in repeatable specimen rows and use corrected tensile strengths for compliance. Report dry weight as “Weight Before,” wet weight as “Weight After,” density from wet mass and specimen volume using gram units, and water absorption from the dry-to-wet mass change. When a legacy record has only direct paving fields, load them into its first row before editing.