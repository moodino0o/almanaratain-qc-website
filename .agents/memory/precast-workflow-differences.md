---
name: Precast workflow differences
description: Product-specific distinction between Precast and Ready Mix QC workflows.
---

Precast calculations may follow the Ready Mix approach, but the view, data-entry fields, and report format must be distinct. Use the exact content and requirements the user provides for those areas; do not infer them from the Ready Mix interface.

The specified Precast entry fields are product type (`150 mm slab`, `200`, `250`, `260`), sample number, Precast mould number, job number, customer name, cube size, testing location, compaction, tested by, and remarks. Default cube size is `100*100*100`, default compaction is `Mechanical compaction`, and the five default specimen ages are `[1, 7, 7, 28, 28]` days. Keep this workflow visually and functionally separate from Ready Mix, even where the compressive-strength calculation is shared.

**Why:** The user stated that Precast is similar in calculation to Ready Mix but differs in view, data entry, and report format, then supplied these exact fields and defaults.

**How to apply:** Preserve the product labels and defaults above in Precast forms, registers, and print reports. Reuse only the matching load-over-area calculation; do not copy Ready Mix’s unrelated input fields, table layout, or averages.