---
name: Data-entry keyboard behavior
description: User-required Enter navigation across QC data-entry forms and tables.
---

Across data-entry forms and tables, Enter moves to the next editable input in normal visual order, selecting its existing value for replacement or focusing it if empty. Skip buttons, labels, read-only, disabled and hidden fields.

**Why:** The user explicitly requested consistent keyboard entry without changing calculations, validation, styling or other functionality.

**How to apply:** Preserve this behavior when adding or revising entry screens. Do not make Enter from an entry field insert rows, focus action buttons or implicitly save the record. Keep explicit save actions and existing calculations intact.

Skip Length, Width and Height during Enter navigation in the “Enter Ready Mix cube results” dialog and the Block and Kerbstone specimen results-entry tables. These dimensions stay editable through mouse and Tab.

**Why:** The user specifically requested this exception for these two entry tables.
