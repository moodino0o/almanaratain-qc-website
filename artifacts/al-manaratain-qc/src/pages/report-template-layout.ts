import type { ReportTemplateDesign } from "@workspace/api-client-react";
import { absolutePosition, visibleWithParents } from "./report-designer-model";

export function positionRemarksAboveResults(
  design: ReportTemplateDesign,
  remarksText?: string | null,
): ReportTemplateDesign {
  if (!remarksText?.trim()) return design;
  const sections = design.objects.filter((object) => object.type === "section");
  const remarks = sections.find((object) => object.sectionKey === "remarks");
  const results = sections.find((object) => object.sectionKey === "results");
  if (
    !remarks ||
    !results ||
    !visibleWithParents(remarks, design.objects) ||
    !visibleWithParents(results, design.objects)
  ) {
    return design;
  }

  const resultsY = absolutePosition(results, design.objects).y;
  const remarksY = absolutePosition(remarks, design.objects).y;
  const precedingSections = sections.filter((section) => {
    if (
      section.id === remarks.id ||
      section.id === results.id ||
      section.sectionKey === "signatures"
    ) {
      return false;
    }
    const position = absolutePosition(section, design.objects);
    return position.y < resultsY && visibleWithParents(section, design.objects);
  });
  const precedingBottom = Math.max(
    0,
    ...precedingSections.map((section) => {
      const position = absolutePosition(section, design.objects);
      return position.y + section.height;
    }),
  );

  const configuredFontSize =
    design.layout.sections.find((section) => section.key === "remarks")?.fontSize;
  const fontSize = remarks.fontSize ?? configuredFontSize ?? design.layout.fontSize;
  const pixelsPerMm = 96 / 25.4;
  const availableWidthPx = Math.max(
    fontSize,
    remarks.width * pixelsPerMm - (remarks.padding ?? 0) * 2,
  );
  const charactersPerLine = Math.max(1, availableWidthPx / (fontSize * 0.55));
  const textLines = `Remarks: ${remarksText}`
    .split(/\r?\n/)
    .reduce(
      (total, line) => total + Math.max(1, Math.ceil(line.length / charactersPerLine)),
      0,
    );
  const estimatedContentHeight =
    (textLines * fontSize * 1.35 + (remarks.padding ?? 0) * 2) / pixelsPerMm;
  const remarksHeight = Math.max(remarks.height, estimatedContentHeight);
  const gap = 2;
  const minimumRemarksY = precedingBottom + gap;
  const remarksBottom = remarksY + remarksHeight;
  const alreadyAboveResults =
    remarksY >= minimumRemarksY &&
    remarksY < resultsY &&
    remarksBottom + gap <= resultsY;
  if (alreadyAboveResults) return design;

  const targetRemarksY = Math.max(minimumRemarksY, resultsY - remarksHeight - gap);
  const targetResultsY = Math.max(resultsY, targetRemarksY + remarksHeight + gap);
  const remarksDelta = targetRemarksY - remarksY;
  const resultsDelta = targetResultsY - resultsY;

  return {
    ...design,
    objects: design.objects.map((object) => {
      if (object.id === remarks.id) {
        return { ...object, y: object.y + remarksDelta };
      }
      if (
        resultsDelta > 0 &&
        object.type === "section" &&
        absolutePosition(object, design.objects).y >= resultsY
      ) {
        return { ...object, y: object.y + resultsDelta };
      }
      return object;
    }),
  };
}