---
name: Report layout safety
description: The quality-control report editor stores validated presentation settings and approved data-column bindings instead of executable markup.
---

Quality-control report customization should remain data-driven: persist validated typography, colors, section ordering/visibility, and allowlisted data columns, while retaining the fixed report renderer as the fallback.

**Why:** Administrators need flexible printable layouts, but arbitrary HTML, CSS, JSX, or expressions would create security and reliability risks.

**How to apply:** Extend the allowlist and renderer together when adding a report field or table; keep administrator authorization on the server and preserve defaults for missing or invalid layouts.

The Block report’s legacy table shape is the baseline: keep its fixed headers, line breaks, average row, and spacing stable unless a deliberate custom layout is explicitly applied.

**Why:** A generic responsive table renderer made the printable Block report visibly messy even though its data was still correct.

**How to apply:** Put shared approval metadata outside report-type-specific forms, but do not replace the Block renderer with the generic table renderer just to support other report types.

Block Wet Weight remains an input to density calculations but is not report output; Block dimensions are displayed as whole millimetres without changing stored values or calculations.

**Why:** The Block report should show dimensions without decimals and omit Wet Weight while retaining calculation accuracy.

**How to apply:** Keep these as Block-report presentation rules across fixed and saved custom layouts; do not apply them to Paving or other report types.

The visual designer must use the shared report renderer as its only source of content. Editor overlays are transparent interaction and selection targets, not duplicate text, table, image, or field previews. New section containers default to transparent; retain explicit legacy section fills when initializing them.

**Why:** Duplicate mock layers can cover real saved values and tables, while implicit accent fills can hide report content. Keeping one renderer also keeps the designer aligned with browser printing.

**How to apply:** Add report content and data bindings to the shared renderer; keep canvas overlays limited to hit targets and selection outlines. Only apply a section fill when an administrator explicitly sets one, while preserving any previously saved fill.

Visual templates position report sections absolutely, so changing JSX or flex order alone does not change their printed order.

**Why:** Explicit section coordinates take precedence over document flow and can otherwise leave a reordered block visually in its old location.

**How to apply:** Enforce report-order rules on a render-only design copy, move section backgrounds and dependent content together, keep the designer preview aligned, and never mutate saved template coordinates implicitly.

Remarks must appear after test details and before specimen/results in every report type; saved template fields must not create a second copy.

**Why:** The user explicitly requested the same Remarks placement across all reports after the previous JSX-order change failed in a saved report.

**How to apply:** Place Remarks at each renderer's real details/results boundary. For Blocks, use render-time positioning only when context, remarks, and results sections are all positioned; otherwise fall back to canonical document flow rather than partial coordinates or saved flex order. For other reports, keep Remarks in the shared results flow and keep print and designer preview behavior aligned.