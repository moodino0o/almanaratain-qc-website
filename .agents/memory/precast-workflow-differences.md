---
name: Precast workflow differences
description: Product-specific distinction between Precast and Ready Mix QC workflows.
---

Precast calculations may follow the Ready Mix approach, but the view, data-entry fields, and report format must be distinct. Use the exact content and requirements the user provides for those areas; do not infer them from the Ready Mix interface.

The specified Precast entry fields are product type (`150 mm slab`, `200`, `250`, `260`), sample number, Precast mould number, job number, customer name, cube size, testing location, compaction, tested by, and remarks. Default cube size is `100*100*100`, default compaction is `Mechanical compaction`, and the five default specimen ages are `[1, 7, 7, 28, 28]` days. Keep this workflow visually and functionally separate from Ready Mix, even where the compressive-strength calculation is shared.

Precast age criteria are based on each age group's average strength: at 1 day, ≥30 N/mm² is “Approved for demolding”; at 7 days, ≥52 N/mm² is “Pass”; at 28 days, ≥65 N/mm² is “Pass”. Keep an age result Pending until every entered specimen in that age group has a calculated strength. The overall QC status follows the 28-day result only.

Precast Sample No. and Precast Mould No. are whole-number identifiers. The cube weight table has no No. column and accepts weight in grams; density remains in kg/m³. Previously saved kilogram weights must remain readable without being mistaken for grams.

**Why:** The user supplied the acceptance thresholds, identifier format, and weight unit. The form already groups cubes by age, and converting legacy weights prevents unit changes from altering existing density results.

**How to apply:** Preserve the product labels, defaults, identifiers, age-specific results, and thresholds in Precast forms, details, and print reports. Store the selected weight unit, convert legacy kilograms for display/editing, and keep Ready Mix behavior and reports unchanged.