import type {
  ReportLayoutConfig,
  ReportTemplateDesign,
  ReportTemplateObject,
  TestType,
} from "@workspace/api-client-react";
import { REPORT_LAYOUT_FIELD_GROUPS } from "./report-layout-fields";

export const REPORT_TEST_TYPES: TestType[] = [
  "Ready Mix",
  "Blocks",
  "Paving Blocks",
  "Sand Sieve",
  "Aggregate Sieve",
  "Water",
  "Flakiness & Elongation",
  "RMX Trial",
  "Precast",
  "Kerb Stone",
];

const sectionLabels: Record<string, string> = {
  header: "Company header",
  standard: "Report standard",
  sample: "Sample details",
  results: "Test results",
  remarks: "Remarks",
  signatures: "Signatures",
};

export function cloneDesign<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function createLegacyLayout(testType: TestType): ReportLayoutConfig {
  const groups = REPORT_LAYOUT_FIELD_GROUPS[testType] ?? {};
  const columns = Object.fromEntries(
    Object.entries(groups).map(([key, fields]) => [
      key,
      fields.map((field, order) => ({ ...field, visible: true, order })),
    ]),
  );
  return {
    title: testType === "Ready Mix" ? "Readymix Cube Test Report" : `${testType} Test Report`,
    fontFamily: "Arial",
    fontSize: 13,
    textColor: "#20252b",
    accentColor: "#9b1739",
    paperPadding: 13,
    sections: Object.entries(sectionLabels).map(([key, label], order) => ({
      key,
      label,
      visible: true,
      order,
      fontFamily: "Arial",
      fontSize: 13,
      textColor: "#20252b",
      bold: false,
      borderStyle: "none",
      borderColor: "#d1d5db",
      borderWidth: 1,
    })),
    columns,
    elements: [],
  };
}

export function createEmptyDesign(testType: TestType): ReportTemplateDesign {
  const section = (
    id: string,
    sectionKey: string,
    name: string,
    y: number,
    height: number,
    zIndex: number,
  ): ReportTemplateObject => ({
    id,
    type: "section",
    name,
    x: 13,
    y,
    width: 184,
    height,
    zIndex,
    rotation: 0,
    locked: false,
    visible: true,
    sectionKey,
  });
  const objects = [
    section("section-header", "header", "Company header", 12, 22, 1),
    section("section-standard", "standard", "Report standard", 39, 9, 2),
    ...(testType === "Blocks"
      ? [section("section-context", "context", "Block details", 53, 39, 3)]
      : []),
    section(
      "section-results",
      "results",
      "Test results",
      testType === "Blocks" ? 98 : 53,
      testType === "Blocks" ? 137 : 185,
      4,
    ),
    section("section-remarks", "remarks", "Remarks", 244, 14, 5),
    section("section-signatures", "signatures", "Signatures", 263, 22, 6),
  ];
  return {
    schemaVersion: 2,
    layout: createLegacyLayout(testType),
    page: {
      pageSize: "A4",
      orientation: "portrait",
      widthMm: 210,
      heightMm: 297,
      marginTopMm: 12,
      marginRightMm: 13,
      marginBottomMm: 12,
      marginLeftMm: 13,
      showHeader: true,
      showFooter: true,
      headerHeightMm: 22,
      footerHeightMm: 22,
    },
    objects,
  };
}

export function addDefaultSectionObjects(
  design: ReportTemplateDesign,
  testType: TestType,
): ReportTemplateDesign {
  if (design.objects.some((object) => object.type === "section")) return design;
  const defaults = createEmptyDesign(testType).objects;
  const objectIds = new Set(design.objects.map((object) => object.id));
  const sections = defaults
    .filter((object) => object.type === "section")
    .map((object) => {
      const legacySection = design.layout.sections.find((section) => section.key === object.sectionKey);
      return {
        ...object,
        height: object.sectionKey === "header"
          ? design.page.headerHeightMm
          : object.sectionKey === "signatures"
            ? design.page.footerHeightMm
            : object.height,
        ...(legacySection?.backgroundColor ? { backgroundColor: legacySection.backgroundColor } : {}),
        id: objectIds.has(object.id) ? `section-${object.sectionKey}-${Date.now()}` : object.id,
        zIndex: Math.max(0, ...design.objects.map((item) => item.zIndex)) + object.zIndex,
      };
    });
  return { ...design, objects: [...design.objects, ...sections] };
}

export function objectLabel(object: ReportTemplateObject) {
  if (object.type === "dynamicField") return object.fieldKey ?? object.name;
  if (object.type === "shape") return object.shapeType ? `${object.shapeType} shape` : "Shape";
  if (object.type === "line") return object.lineOrientation === "vertical" ? "Vertical line" : "Horizontal line";
  if (object.type === "image") return object.objectPath ? object.name : "Image placeholder";
  return object.name;
}

export function snapValue(value: number, grid: number, enabled: boolean) {
  return enabled ? Math.round(value / grid) * grid : value;
}

export function formatMm(value: number) {
  return `${Number(value.toFixed(1))} mm`;
}
