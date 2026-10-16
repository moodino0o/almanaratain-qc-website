---
name: QC register typography
description: Ensure requested per-column font sizes take effect in QC register tables.
---

For QC register typography updates, verify that the requested styling takes effect in the CSS cascade; the shared readable-table rules can override lower-specificity utility classes.

**Why:** A prior per-column size change was present in markup but did not render at the requested size, and the user reported that the update had not taken effect.

**How to apply:** Use a scoped selector with sufficient specificity for targeted cells and verify the built CSS or computed style before considering the visual change complete.
