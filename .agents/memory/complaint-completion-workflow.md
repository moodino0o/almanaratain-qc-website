---
name: Complaint completion workflow
description: Product decision for complaint status and imported historical complaint records.
---

Imported historical complaints with source status `Resolved - Positive` are `complete`; source rows without a solution are excluded from the imported register. Completion is an explicit Open/Complete status change performed from the complaint list or detail view; solution text is evidence, not the completion state.

**Why:** The source register explicitly identifies positively resolved complaints, while rows without a solution do not contain enough QC action information to keep as active complaint records. The QC workflow also needs a clear human-confirmed completion action for later updates.

**How to apply:** Keep dashboard counts and completion controls based on the explicit complaint status. Do not infer completion from whether solution or recommendation fields are populated.