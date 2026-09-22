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