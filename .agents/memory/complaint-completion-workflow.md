---
name: Complaint completion workflow
description: Product decision for complaint status and imported historical complaint records.
---

Imported historical complaints start as `open`, even when the source spreadsheet contains resolution language. Completion is an explicit Open/Complete status change performed from the complaint list or detail view; solution text is evidence, not the completion state.

**Why:** The source register mixes investigation notes, customer outcomes, and resolution wording, but the QC workflow needs a clear human-confirmed completion action.

**How to apply:** Keep dashboard counts and completion controls based on the explicit complaint status. Do not infer completion from whether solution or recommendation fields are populated.