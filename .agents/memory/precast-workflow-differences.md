---
name: Precast workflow differences
description: Product-specific distinction between Precast and Ready Mix QC workflows.
---

Precast calculations may follow the Ready Mix approach, but the view, data-entry fields, and report format must be distinct. Use the exact content and requirements the user provides for those areas; do not infer them from the Ready Mix interface.

The specified Precast entry fields are product type (`150 mm slab`, `200`, `250`, `260`), sample number, Precast mould number, job number, customer name, cube size, testing location, compaction, tested by, and remarks. Default cube size is `100*100*100`, default compaction is `Mechanical compaction`, and the five default specimen ages are `[1, 7, 7, 28, 28]` days. Keep this workflow visually and functionally separate from Ready Mix, even where the compressive-strength calculation is shared.

Precast age criteria are based on each age group's average strength. Use an editable strength standard matching both the Precast product type and cube age when one exists; otherwise fall back to 30 N/mm² at 1 day (“Approved for demolding”), 52 N/mm² at 7 days (“Pass”), and 65 N/mm² at 28 days (“Pass”). Keep an age result Pending until every entered specimen in that age group has a calculated strength. The overall QC status follows the 28-day result only.

Precast Sample No. and Precast Mould No. are whole-number identifiers. Keep cube age, size, gram weight, density, load, and strength together in one specimen table without a No. column; do not add a separate weight/density table. Density remains in kg/m³. Previously saved kilogram weights must remain readable without being mistaken for grams.

Calculate Precast density as weight in grams / (length × height × width in millimetres) × 1,000,000.

In the printable Precast report, place a two-column Average Strength table near the top and a separate Standard Required Strength table at the bottom. Show Cube Age / Average Strength in the top table; show Cube Age / Intended Strength from the matching product-and-age standard, falling back to 30/52/65 N/mm² at 1/7/28 days. Keep minimum/result columns out of the average table, leave the standards heading unhighlighted, and do not change Ready Mix report layout.

**Why:** The user supplied 30/52/65 N/mm² as the original age thresholds, then requested administrators be able to add and link standards by Precast type. Matching configured standards must therefore override those defaults consistently in evaluation, the form, and the report. The user also specified the identifier format, weight unit, one-table requirement, density formula, and top-average/bottom-standard report arrangement.

**How to apply:** Match standards by Precast type and cube age; use 30/52/65 N/mm² only when a matching editable standard is absent. Keep that precedence consistent across evaluation, form summaries, and printed reports. Preserve product labels, identifiers, density calculations, and report structure; keep measurements in one table, convert legacy kilograms for display/editing, and keep Ready Mix behavior unchanged.