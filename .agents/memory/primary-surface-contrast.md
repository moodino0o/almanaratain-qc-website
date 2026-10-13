---
name: Primary-surface text contrast
description: Text contrast rule for the QC app's burgundy primary surfaces.
---

Every text element on a solid primary burgundy surface must use the high-contrast primary foreground, including nested helper, description, and warning text. Do not leave nested text in muted gray. Use a solid primary background when applying the white primary foreground.

**Why:** The user repeated the font-color request after gray text remained difficult to read on magenta primary surfaces.

**How to apply:** When adding or changing a primary-filled control, notice nested spans and descriptions that override inherited color with muted tokens; set their foreground to the primary foreground as well.
