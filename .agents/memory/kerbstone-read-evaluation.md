---
name: Kerbstone read evaluation
description: Keep Kerbstone result values consistent across QC list, detail, and report responses when persisted evaluations may be stale.
---

Recalculate Kerbstone strength evaluation from the saved specimen inputs and current standards when preparing read responses, rather than trusting potentially stale `strengthEvaluation` JSON. Do not silently persist a correction during a GET; persistent historical refreshes must use the existing administrator-only, audited operation.

**Why:** A prior formula change left stored average/minimum/maximum values and status different from the values recalculated from specimen loads and span in the detail view. Mutating records on reads would bypass the historical correction audit.

**How to apply:** Keep list, single-record, dashboard serialization, and report serialization on the response evaluator. If stored historical JSON must be corrected, route it through the explicit audited refresh flow rather than adding writes to a read endpoint.
