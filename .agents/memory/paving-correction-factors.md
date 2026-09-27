---
name: Paving correction factors
description: Paving tensile calculation, report semantics, and size-based correction factors.
---

Paving specimen tensile strength is calculated as 0.637 × load in newtons ÷ (length × height), then multiplied by the size correction factor. Compare the average corrected tensile strength with the matching configured minimum to determine Pass/Fail.

Paving Blocks use the shared shape-factor standards table for size-based correction factors. A size ending in 60 defaults to 0.87 and a size ending in 80 defaults to 1.00; an explicitly saved factor remains authoritative.

**Why:** The attached Paving Block report's example values support this tensile formula and correction sequence; retaining that interpretation keeps future form, evaluation, and printable-report changes consistent with the sample.

**How to apply:** Keep Paving measurements in repeatable specimen rows and use corrected tensile strengths for compliance. Report dry weight as “Weight Before,” wet weight as “Weight After,” density from wet mass and specimen volume, and water absorption from the dry-to-wet mass change. When a legacy record has only direct paving fields, load them into its first row before editing.