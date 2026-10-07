---
name: PowerPoint runtime compatibility
description: PptxGenJS ESM packaging differs between native Node and tsx execution.
---

Do not assume that PptxGenJS 4's default ESM import is a constructible class under Node 24 with tsx, even when a native Node import works.

**Why:** The same dependency imported successfully in native Node but produced a non-constructible value when the TypeScript generator ran through tsx. This is a loader compatibility issue rather than a missing dependency.

**How to apply:** For future standalone PowerPoint generators in this environment, use the package's CommonJS export with TypeScript type imports, and verify the generator by executing it, not just by typechecking.
