# Al Manaratain QC management presentation

## Files

- `../.local/outputs/Al-Manaratain-QC-Application-Management-Presentation.pptx` — downloadable PowerPoint export.
- `../scripts/generate-qc-management-presentation.ts` — editable PptxGenJS source generator.
- `qc-material-texture.png` — the existing engineering-material visual reused from the QC deck. The slides use diagrams and vector mockups for the remaining visuals; no authenticated application screenshots are included.

## Regenerate the PowerPoint

From the workspace root, run:

```sh
pnpm --filter @workspace/scripts run generate:qc-presentation
```

The generator writes the presentation to `.local/outputs/Al-Manaratain-QC-Application-Management-Presentation.pptx`. The workspace slides artifact can also export its current slide source to PowerPoint using the built-in slide export flow.

## Dependencies

The generator uses `pptxgenjs`; the `@workspace/scripts` package also uses `tsx` to run TypeScript directly. Both dependencies are declared in the scripts workspace package.

## Modify slide content

Edit the slide definitions and drawing helpers in `scripts/generate-qc-management-presentation.ts`. Update the corresponding static slide components in `artifacts/al-manaratain-qc-deck/src/pages/slides/` when changing the editable preview deck, then keep `src/data/slides-manifest.json` titles and descriptions in sync.

The application screenshots were not available without signing in. Any report or UI panel in the presentation is labeled as an illustrative mockup, not a captured screen. Calculations are based on the current application source; validate any operational acceptance criteria against approved standards.
