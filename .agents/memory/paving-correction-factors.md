---
name: Paving correction factors
description: Durable behavior for configuring and applying compressive-strength correction factors to Paving Blocks.
---

Paving Blocks use the shared shape-factor standards table for size-based correction factors. A size ending in 60 defaults to 0.87 and a size ending in 80 defaults to 1.00; an explicitly saved factor remains authoritative.

**Why:** The existing Standards workflow already manages size-based Block calculations, so extending that model keeps configuration in one place while preserving legacy paving records.

**How to apply:** Keep Paving Blocks on the repeatable test-row path. When a legacy record has only direct paving fields, load those fields into its first row before editing, and use corrected strengths for automated compliance evaluation.