import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { ReactNode } from "react";
import { useParams } from "wouter";
import {
  useGetReport,
  useListReportTemplates,
  useListSieveStandards,
  useListStrengthStandards,
  getListReportTemplatesQueryKey,
} from "@workspace/api-client-react";
import type {
  QcRecord,
  ReportLayout,
  ReportTemplateDesign,
  ReportTemplateObject,
  ReportTemplate,
  StrengthStandard,
} from "@workspace/api-client-react";
import { REPORT_LAYOUT_FIELD_GROUPS } from "./report-layout-fields";
import { absolutePosition, directChildren, parentIdFor, sectionForObject, visibleWithParents } from "./report-designer-model";
import { evaluateReportFormula } from "./report-template-formulas";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer } from "lucide-react";
import { useAppBack } from "@/hooks/use-app-back";
import {
  blockReportColumnsWithFaceArea,
  blockReportColumnsWithRequiredFields,
  filterRowsWithLoad,
  formatDammamBlockArea,
  formatBlockNetArea,
  formatShapeFactor,
  formatWholeNumber,
} from "./report-print-utils";
import { positionRemarksAboveResults } from "./report-template-layout";
import {
  AGGREGATE_CHLORIDE_LIMIT_PERCENT,
  AGGREGATE_SULPHATE_LIMIT_PERCENT,
  blockMaterialMatches,
  blockSizeMatches,
  blockTypeMatches,
  calculateKerbBendingStrength,
  evaluateKerbWaterAbsorption,
  calculateChlorideContent,
  calculateCubeDensity,
  calculateDammamBlockResults,
  cubeWeightInGrams,
  calculateRetainedPercentage,
  calculateSieveSampleWeight,
  calculateSiltContent,
  calculateSulphateContent,
  evaluateContentAgainstLimit,
  evaluateSiltContent,
  findSieveEvaluationCriterion,
  getDammamBlockHoleCount,
  getDammamBlockThicknessDefaults,
  isSandwichBlockType,
  kerbDimensionsForType,
  PRECAST_AGE_STRENGTH_CRITERIA,
  precastAgeStrengthSummary,
  SIEVE_SILT_LIMIT_PERCENT,
  stringValue,
  sortSieveRowsByPoreSize,
} from "./record-form-utils";

type DetailMap = QcRecord["details"];
type ValueMap = Record<string, unknown>;
type LayoutColumn = ReportLayout["config"]["columns"][string][number];

export type ReportDocumentProps = {
  report: { record: QcRecord; companyName: string; companySubtitle: string; layout?: ReportLayout };
  strengthStandards?: StrengthStandard[];
  sieveStandards?: Array<{ id?: number; testType: string; material: string; standardReference: string }>;
  selectedStrengthStandardId?: string;
  accordingTo?: string | null;
  reportReferenceNumber?: string;
  defaultTitle?: string;
  templateDesign?: ReportTemplateDesign;
  formulaPreview?: boolean;
};

const positionedSectionObjects = new WeakMap<ReportLayout, Map<string, ReportTemplateObject>>();

function layoutWithTemplateDesign(
  layout: ReportLayout | undefined,
  record: QcRecord,
  design: ReportTemplateDesign,
) {
  const sectionObjects = new Map(
    design.objects
      .filter((object) => object.type === "section" && object.sectionKey)
      .map((object) => [object.sectionKey!, { ...object }]),
  );
  if (!design.page.showHeader && sectionObjects.has("header")) {
    sectionObjects.get("header")!.visible = false;
  }
  if (!design.page.showFooter && sectionObjects.has("signatures")) {
    sectionObjects.get("signatures")!.visible = false;
  }
  const result: ReportLayout = {
    id: layout?.id ?? 0,
    testType: layout?.testType ?? record.testType,
    name: layout?.name ?? design.layout.title,
    config: design.layout,
  };
  positionedSectionObjects.set(result, sectionObjects);
  return result;
}

function layoutSectionVisible(layout: ReportLayout | undefined, key: string) {
  const section = layout?.config.sections.find((item) => item.key === key);
  const positioned = layout ? positionedSectionObjects.get(layout)?.get(key) : undefined;
  if (positioned) return positioned.visible;
  return section?.visible ?? true;
}

function layoutSectionOrder(layout: ReportLayout | undefined, key: string) {
  const section = layout?.config.sections.find((item) => item.key === key);
  return section?.order ?? 0;
}

function hasPositionedSection(layout: ReportLayout | undefined, key: string) {
  return layout ? positionedSectionObjects.get(layout)?.has(key) ?? false : false;
}

function layoutSectionStyle(
  layout: ReportLayout | undefined,
  key: string,
  options: { inFlow?: boolean } = {},
): CSSProperties {
  const section = layout?.config.sections.find((item) => item.key === key);
  const positioned = layout ? positionedSectionObjects.get(layout)?.get(key) : undefined;
  const inFlow = options.inFlow ?? false;
  const sectionBackground = positioned
    ? positioned.backgroundColor ?? "transparent"
    : section?.backgroundColor;
  return {
    ...(inFlow ? {} : { order: layoutSectionOrder(layout, key) }),
    ...(section?.fontFamily ? { fontFamily: section.fontFamily } : {}),
    ...(section?.fontSize ? { fontSize: `${section.fontSize}px` } : {}),
    ...(section?.textColor ? { color: section.textColor } : {}),
    ...(sectionBackground ? { backgroundColor: sectionBackground } : {}),
    ...(section?.bold ? { fontWeight: 700 } : {}),
    ...(section?.borderStyle && section.borderStyle !== "none"
      ? { border: `${section.borderWidth ?? 1}px ${section.borderStyle} ${section.borderColor ?? "#d1d5db"}` }
      : {}),
    ...(positioned && key === "remarks" && !inFlow ? { marginTop: 0 } : {}),
    ...(positioned && !inFlow ? {
      position: "absolute",
      left: `${positioned.x}mm`,
      top: `${positioned.y}mm`,
      width: `${positioned.width}mm`,
      minHeight: `${positioned.height}mm`,
      zIndex: positioned.zIndex,
      boxSizing: "border-box",
      transform: positioned.rotation ? `rotate(${positioned.rotation}deg)` : undefined,
    } : {}),
  };
}

function LayoutElements({ layout, sectionKey, placement }: {
  layout?: ReportLayout;
  sectionKey: string;
  placement: "before" | "after";
}) {
  const elements = (layout?.config.elements ?? [])
    .filter((element) => element.sectionKey === sectionKey && element.placement === placement)
    .sort((a, b) => a.order - b.order);
  const sectionOrder = layoutSectionOrder(layout, sectionKey);
  const itemOrder = sectionKey === "remarks" ? undefined : sectionOrder;
  return <>{elements.map((element) => {
    const width = `${Math.min(100, Math.max(10, element.width ?? 100))}%`;
    return element.type === "divider"
      ? <div key={element.key} className="report-layout-divider" style={{ width, ...(itemOrder === undefined ? {} : { order: itemOrder }), borderTop: `1px ${element.lineStyle ?? "solid"} ${element.color ?? "#d1d5db"}`, margin: "8px 0" }} />
      : <div key={element.key} className="report-layout-text" style={{ width, ...(itemOrder === undefined ? {} : { order: itemOrder }), fontFamily: element.fontFamily, fontSize: element.fontSize ? `${element.fontSize}px` : undefined, color: element.color, fontWeight: element.bold ? 700 : undefined }}>{element.content ?? ""}</div>;
  })}</>;
}

function ReportRemarks({
  record,
  layout,
  inFlow = false,
}: {
  record: QcRecord;
  layout?: ReportLayout;
  inFlow?: boolean;
}) {
  if (!layoutSectionVisible(layout, "remarks") || !record.remarks) return null;
  return <>
    <LayoutElements layout={layout} sectionKey="remarks" placement="before" />
    <div className="report-remarks report-layout-section" style={layoutSectionStyle(layout, "remarks", { inFlow })}>
      <span>Remarks:</span> {record.remarks}
    </div>
    <LayoutElements layout={layout} sectionKey="remarks" placement="after" />
  </>;
}

function isCanonicalRemarksTemplateObject(object: ReportTemplateObject) {
  const fieldKey = object.fieldKey?.trim().toLocaleLowerCase();
  if (["remarks", "record.remarks", "details.remarks"].includes(fieldKey ?? "")) {
    return true;
  }
  return /\{\{\s*(?:remarks|record\.remarks|details\.remarks)\s*\}\}/i.test(
    object.content ?? "",
  );
}

function reportTemplateFieldValues(record: QcRecord, companyName: string, reportTitle: string): Record<string, string> {
  const details = record.details;
  const sieveRows = Array.isArray(details.sieveRows) ? details.sieveRows : [];
  const sieveRow = objectValue(sieveRows[0]);
  return {
    REPORT_TITLE: reportTitle,
    "report.title": reportTitle,
    REPORT_NUMBER: reportReferenceNumberFor(record),
    REPORT_DATE: formatReportDate(record.createdAt),
    SAMPLE_DATE: formatReportDate(record.sampleDate),
    SUPPLIER: detailValue(details, ["supplier", "vendor", "customerName"]),
    SAMPLE_DESCRIPTION: detailValue(details, ["sampleDescription", "description", "materialDescription"]),
    PROJECT: detailValue(details, ["project", "projectName", "projectNumber"]),
    TEST_METHOD: detailValue(details, ["testMethod", "standard", "bsStandard", "standardReference"], record.testType),
    TEST_RESULT: record.status,
    SIEVE_SIZE: rawTextValue(sieveRow?.sieveSize ?? sieveRow?.poreSize),
    AMOUNT_RETAINED: textValue(sieveRow?.amountRetained ?? sieveRow?.retained),
    AMOUNT_PASSING: textValue(sieveRow?.amountPassing ?? sieveRow?.passing),
    PERCENT_PASSING: textValue(sieveRow?.passingPercentage ?? sieveRow?.percentPassing),
    RETAINED_PERCENT: textValue(sieveRow?.retainedPercentage ?? sieveRow?.percentRetained),
    LOWER_LIMIT: textValue(sieveRow?.lowerLimit),
    UPPER_LIMIT: textValue(sieveRow?.upperLimit),
    REMARKS: record.remarks || "",
    COMPANY_NAME: companyName,
    SAMPLE_NUMBER: record.recordNo,
    MATERIAL: record.material,
    LOCATION: record.location,
    TESTED_BY: record.testedBy,
    REVIEWED_BY: record.reviewedBy || "",
    "record.recordNo": record.recordNo,
    "record.sampleDate": formatReportDate(record.sampleDate),
    "record.location": record.location,
    "record.material": record.material,
    "record.status": record.status,
    "record.testedBy": record.testedBy,
    "record.reviewedBy": record.reviewedBy || "",
    "record.createdAt": formatReportDate(record.createdAt),
  };
}

function resolveReportTemplateText(
  value: string,
  fieldValues: Record<string, string>,
  resolveField?: (key: string) => string | undefined,
) {
  return value.replace(/\{\{([A-Za-z_][A-Za-z0-9_.]*)\}\}/g, (token, key: string) =>
    resolveField?.(key) ?? (Object.hasOwn(fieldValues, key) ? fieldValues[key] : token),
  );
}

function ReportTemplateObjects({
  design,
  record,
  companyName,
  reportTitle,
  formulaPreview = false,
  skipSectionObjects = false,
}: {
  design: ReportTemplateDesign;
  record: QcRecord;
  companyName: string;
  reportTitle: string;
  formulaPreview?: boolean;
  skipSectionObjects?: boolean;
}) {
  const fieldValues = reportTemplateFieldValues(record, companyName, reportTitle);
  const objects = design.objects
    .filter((object) => {
      if (skipSectionObjects && object.type === "section") return false;
      if (
        (object.type === "section" && object.sectionKey === "remarks") ||
        isCanonicalRemarksTemplateObject(object)
      ) return false;
      if (["group", "tableRow", "tableCell"].includes(object.type) ||
        !visibleWithParents(object, design.objects)) return false;
      const section = sectionForObject(object, design.objects);
      if (section?.sectionKey === "header" && !design.page.showHeader) return false;
      if (section?.sectionKey === "signatures" && !design.page.showFooter) return false;
      return true;
    })
    .sort((left, right) => left.zIndex - right.zIndex);

  return <>{objects.map((object) => {
    const { x: objectX, y: objectY } = absolutePosition(object, design.objects);
    const hasStructuredRows = object.type === "table" &&
      directChildren(design.objects, object.id).some((child) => child.type === "tableRow");
    const commonStyle: CSSProperties = {
      position: "absolute",
      left: `${objectX}mm`,
      top: `${objectY}mm`,
      width: `${object.width}mm`,
      height: hasStructuredRows ? "auto" : `${object.height}mm`,
      minHeight: hasStructuredRows ? `${object.height}mm` : undefined,
      zIndex: object.zIndex,
      boxSizing: "border-box",
      overflow: object.type === "table" ? "visible" : "hidden",
      transform: object.rotation ? `rotate(${object.rotation}deg)` : undefined,
      opacity: object.opacity ?? 1,
      fontFamily: object.fontFamily,
      fontSize: object.fontSize ? `${object.fontSize}px` : undefined,
      fontWeight: object.bold ? 700 : undefined,
      fontStyle: object.italic ? "italic" : undefined,
      textDecoration: object.underline ? "underline" : undefined,
      textAlign: object.textAlign,
      lineHeight: object.lineHeight,
      letterSpacing: object.letterSpacing === undefined ? undefined : `${object.letterSpacing}px`,
      color: object.textColor,
      backgroundColor: object.backgroundColor,
      border: object.borderWidth
        ? `${object.borderWidth}px ${object.lineStyle ?? "solid"} ${object.borderColor ?? "#20252b"}`
        : undefined,
      borderRadius: object.borderRadius ? `${object.borderRadius}px` : undefined,
      padding: object.padding ? `${object.padding}px` : undefined,
    };
    const text = object.content
      ? resolveReportTemplateText(object.content, fieldValues)
      : object.fieldKey
        ? resolveReportTemplateDynamicField(record, object.fieldKey, fieldValues)
        : "";

    if (object.type === "section") {
      return <div
        key={object.id}
        className="report-template-object report-template-section"
        data-report-object={object.id}
        aria-hidden="true"
        style={{ ...commonStyle, backgroundColor: object.backgroundColor ?? "transparent" }}
      />;
    }

    if (object.type === "image") {
      return <img
        key={object.id}
        className="report-template-object report-template-image"
        data-report-object={object.id}
        src={object.objectPath ? `/api/storage${object.objectPath}` : ""}
        alt={object.name}
        style={{ ...commonStyle, objectFit: "contain" }}
      />;
    }

    if (object.type === "line") {
      const isVertical = object.lineOrientation === "vertical";
      const thickness = object.borderWidth ?? 1;
      return <div
        key={object.id}
        className="report-template-object report-template-line"
        data-report-object={object.id}
        aria-hidden="true"
        style={{
          ...commonStyle,
          width: isVertical ? `${thickness}px` : `${object.width}mm`,
          height: isVertical ? `${object.height}mm` : `${thickness}px`,
          border: 0,
          borderTop: isVertical ? undefined : `${thickness}px ${object.lineStyle ?? "solid"} ${object.borderColor ?? object.textColor ?? "#20252b"}`,
          borderLeft: isVertical ? `${thickness}px ${object.lineStyle ?? "solid"} ${object.borderColor ?? object.textColor ?? "#20252b"}` : undefined,
          padding: 0,
        }}
      />;
    }

    if (object.type === "shape") {
      const isDivider = object.shapeType === "divider";
      return <div
        key={object.id}
        className={`report-template-object report-template-shape ${object.shapeType ? `shape-${object.shapeType}` : ""}`}
        data-report-object={object.id}
        aria-label={object.name}
        style={{
          ...commonStyle,
          backgroundColor: isDivider ? "transparent" : object.fillColor ?? "transparent",
          border: `${object.borderWidth ?? 1}px solid ${object.borderColor ?? "#20252b"}`,
          borderRadius: object.shapeType === "circle" ? "50%" : `${object.borderRadius ?? 0}px`,
        }}
      />;
    }

    if (object.type === "table") {
      return <div
        key={object.id}
        className="report-template-object report-template-table"
        data-report-object={object.id}
        style={commonStyle}
      >
        <ReportTemplateDataTable design={design} record={record} object={object} fieldValues={fieldValues} formulaPreview={formulaPreview} />
      </div>;
    }

    if (object.type === "formula") {
      const value = formulaPreview
        ? `[Formula: ${object.name}]`
        : evaluateFormulaForRecord(object.formula ?? "", record, fieldValues);
      return <div key={object.id} className="report-template-object report-template-formula" data-report-object={object.id} style={{ ...commonStyle, whiteSpace: "pre-wrap" }}>{value}</div>;
    }

    if (object.type === "signature") {
      return <div key={object.id} className="report-template-object report-template-signature" data-report-object={object.id} style={{ ...commonStyle, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
        <span>{object.name}</span><span style={{ flex: 1, borderBottom: `1px solid ${object.borderColor ?? "#20252b"}`, marginTop: 3 }} /><small>{object.content ?? "Signature"}</small>
      </div>;
    }

    return <div
      key={object.id}
      className="report-template-object report-template-text"
      data-report-object={object.id}
      style={{ ...commonStyle, whiteSpace: "pre-wrap" }}
    >{text}</div>;
  })}</>;
}

function layoutColumns(
  layout: ReportLayout | undefined,
  tableKey: string,
  fallback: LayoutColumn[],
) {
  const configured = layout?.config.columns[tableKey];
  const selectedColumns = configured === undefined ? fallback : configured;
  const compatibleColumns =
    tableKey === "blockCompression" && configured?.length
      ? blockReportColumnsWithFaceArea(
          configured,
          fallback.find((column) => column.key === "faceArea"),
        )
      : tableKey === "sieveResults" && configured?.length
      ? (() => {
          const existingKeys = new Set(configured.map((column) => column.key));
          const lastOrder = Math.max(-1, ...configured.map((column) => column.order));
          const addedColumns = fallback
            .filter(
              (column) =>
                !existingKeys.has(column.key) &&
                ["retained", "passing", "lower", "upper", "remarks"].includes(
                  column.key,
                ),
            )
            .map((column, index) => ({
              ...column,
              order: lastOrder + index + 1,
            }));
          return [...configured, ...addedColumns];
        })()
      : tableKey === "pavingResults" && configured?.length
      ? (() => {
          const legacyDefaultKeys = [
            "no",
            "age",
            "length",
            "width",
            "height",
            "dryWeight",
            "wetWeight",
            "load",
            "strength",
          ];
          const isLegacyDefault =
            configured.length === legacyDefaultKeys.length &&
            configured.every(
              (column, index) => column.key === legacyDefaultKeys[index],
            );
          const aliases: Record<string, string> = {
            dryWeight: "weightBefore",
            wetWeight: "weightAfter",
            strength: "tensileStrength",
            calculatedStrength: "tensileStrength",
            correctedStrength: "tensileStrength",
          };
          const migrated = configured
            .filter((column) => column.key !== "age")
            .map((column) => {
              const key = aliases[column.key] ?? column.key;
              const standardColumn = fallback.find(
                (candidate) => candidate.key === key,
              );
              return {
                ...column,
                key,
                label: standardColumn?.label ?? column.label,
                order: isLegacyDefault
                  ? standardColumn?.order ?? column.order
                  : column.order,
              };
            });
          const deduplicated = migrated.filter(
            (column, index) =>
              migrated.findIndex((candidate) => candidate.key === column.key) ===
              index,
          );
          const existingKeys = new Set(deduplicated.map((column) => column.key));
          const lastOrder = Math.max(-1, ...deduplicated.map((column) => column.order));
          const newlyAddedColumns = fallback
            .filter(
              (column) =>
                !existingKeys.has(column.key) &&
                ["density", "waterAbsorption"].includes(column.key),
            )
            .map((column, index) => ({
              ...column,
              order: isLegacyDefault
                ? column.order
                : lastOrder + index + 1,
            }));
          return [...deduplicated, ...newlyAddedColumns];
        })()
      : tableKey === "precastResults" && configured?.length
        ? (() => {
            const existingKeys = new Set(configured.map((column) => column.key));
            const lastOrder = Math.max(-1, ...configured.map((column) => column.order));
            const ageOrder = configured.find((column) => column.key === "age")?.order;
            const addedColumns = fallback
              .filter(
                (column) =>
                  !existingKeys.has(column.key) &&
                  ["testingDate", "weight", "density"].includes(column.key),
              )
              .map((column, index) => ({
                ...column,
                order: column.key === "testingDate" && ageOrder !== undefined
                  ? ageOrder + 0.5
                  : lastOrder + index + 1,
              }));
            return [...configured, ...addedColumns];
          })()
      : selectedColumns;
  return compatibleColumns
    .filter((column) => column.visible)
    .sort((left, right) => left.order - right.order);
}

function rawTextValue(value: unknown, fallback = "-") {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function textValue(value: unknown, fallback = "-") {
  if (typeof value === "number" && Number.isFinite(value)) {
    return formatNumber(value);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(trimmed)) {
      return formatNumber(Number(trimmed));
    }
  }
  return rawTextValue(value, fallback);
}

function detailValue(details: DetailMap, keys: string[], fallback = "-") {
  const normalized = new Map(
    Object.entries(details).map(([key, value]) => [key.toLowerCase(), value]),
  );
  for (const key of keys) {
    const value = normalized.get(key.toLowerCase());
    if (value !== undefined && value !== null && value !== "") {
      return textValue(value, fallback);
    }
  }
  return fallback;
}

function detailRawValue(details: DetailMap, keys: string[], fallback = "-") {
  const normalized = new Map(
    Object.entries(details).map(([key, value]) => [key.toLowerCase(), value]),
  );
  for (const key of keys) {
    const value = normalized.get(key.toLowerCase());
    if (value !== undefined && value !== null && value !== "") {
      return rawTextValue(value, fallback);
    }
  }
  return fallback;
}

function objectValue(value: unknown): ValueMap | null {
  return typeof value === "object" && value !== null
    ? value as ValueMap
    : null;
}

function normalizedText(value: unknown) {
  return String(value ?? "").trim().toLocaleLowerCase();
}

function isDammamLocation(value: unknown) {
  const location = normalizedText(value).replace(/\s+/g, " ");
  return location === "dammam" || location === "dammam plant";
}

function matchesText(left: unknown, right: unknown) {
  return normalizedText(left) === normalizedText(right);
}

function strengthStandardMatchesRecord(standard: StrengthStandard, record: QcRecord) {
  if (
    standard.testType !== record.testType ||
    (record.testType === "Blocks"
      ? !blockMaterialMatches(
        standard.material,
        record.material,
        detailValue(record.details, ["blockType"], ""),
      )
      : !matchesText(standard.material, record.material))
  ) {
    return false;
  }
  if (record.testType !== "Blocks") return true;
  const blockType = detailValue(record.details, ["blockType"], "");
  const blockSize = detailValue(record.details, ["blockSize"], "");
  return Boolean(blockType) &&
    Boolean(blockSize) &&
    blockTypeMatches(standard.blockType, blockType) &&
    blockSizeMatches(standard.blockSize, blockSize);
}

function selectedStrengthStandardForRecord(
  standards: StrengthStandard[],
  record: QcRecord,
) {
  const matchingStandards = standards
    .filter((standard) => strengthStandardMatchesRecord(standard, record))
    .sort((left, right) => left.id - right.id);
  const selectedId = Number(record.details.strengthStandardId);
  return matchingStandards.find((standard) => standard.id === selectedId) ??
    matchingStandards[0];
}

function formatNumber(value: number) {
  return value.toFixed(1);
}

function formatKerbResult(value: number) {
  return value.toFixed(2);
}

function formatReportDate(value: string | undefined | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  })
    .format(date)
    .replace(/ /g, "-");
}

function formatKerbReportDate(value: string | undefined | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((entry) => entry.type === type)?.value ?? "";
  return `${part("day")} - ${part("month")} - ${part("year")}`;
}

function resolveReportTemplateDynamicField(
  record: QcRecord,
  fieldKey: string,
  fieldValues: Record<string, string>,
) {
  const mapped = fieldValues[fieldKey];
  if (mapped !== undefined) return mapped;
  if (!fieldKey.startsWith("details.")) return `{{${fieldKey}}}`;

  const key = fieldKey.slice("details.".length).toLocaleLowerCase();
  if (
    record.testType === "Blocks" &&
    isDammamLocation(record.location) &&
    key === "numberofholes"
  ) {
    return "";
  }
  const details = record.details;
  const recordFields: Record<string, string> = {
    sampledate: formatReportDate(record.sampleDate),
    location: record.location,
    material: record.material,
    testedby: record.testedBy,
    remarks: record.remarks || "",
  };
  if (Object.hasOwn(recordFields, key)) return recordFields[key];
  const direct = Object.entries(details).find(([name]) => name.toLocaleLowerCase() === key)?.[1];
  if (direct !== undefined && direct !== null && direct !== "") {
    return textValue(direct, "");
  }

  const rowArrays = [
    details.testRows,
    details.sieveRows,
    details.specimens,
    details.rows,
  ].filter(Array.isArray) as unknown[][];
  const aliases = new Set([
    key,
    ...(REPORT_TEMPLATE_TABLE_FIELD_ALIASES[key] ?? []).map((name) => name.toLocaleLowerCase()),
  ]);
  for (const rows of rowArrays) {
    for (const row of rows) {
      const values = objectValue(row);
      if (!values) continue;
      const value = Object.entries(values).find(([name]) => aliases.has(name.toLocaleLowerCase()))?.[1];
      if (value !== undefined && value !== null && value !== "") {
        return textValue(value, "");
      }
    }
  }
  return "";
}

function reportTemplateTableRows(record: QcRecord, tableKey: string): ValueMap[] {
  const details = record.details;
  const sourceKeys: Record<string, string[]> = {
    readyMixResults: ["testRows", "cubeRows", "rows"],
    precastResults: ["testRows", "cubeRows", "specimens", "rows"],
    blockCompression: ["testRows", "blockRows", "compressionRows", "rows"],
    pavingResults: ["testRows", "pavingRows", "blockRows", "rows"],
    sieveResults: ["sieveRows"],
  };
  for (const key of sourceKeys[tableKey] ?? []) {
    const rows = details[key];
    if (Array.isArray(rows)) {
      return rows
        .map(objectValue)
        .filter((row): row is ValueMap => Boolean(row))
        .map((row) => {
          if (
            tableKey === "blockCompression" &&
            record.testType === "Blocks" &&
            isDammamLocation(record.location)
          ) {
            const isSandwich = isSandwichBlockType(details.blockType);
            const thicknessDefaults = getDammamBlockThicknessDefaults(details.blockSize);
            const faceThickness =
              row.faceThickness ?? details.faceThickness ?? thicknessDefaults.faceThickness;
            const webThickness =
              row.webThickness ?? details.webThickness ?? thicknessDefaults.webThickness;
            const calculated = calculateDammamBlockResults(
              { ...row, faceThickness, webThickness, load: row.failureLoad ?? row.load },
              details.blockSize,
              faceThickness,
              webThickness,
              details.blockType,
            );
            const airDryStrength = calculated?.grossStrength === null ||
                calculated?.grossStrength === undefined
              ? null
              : Math.round((calculated.grossStrength + Number.EPSILON) * 10) / 10;
            const shapeFactor = numericValue(details.shapeFactor);
            return {
              ...row,
              ...(isSandwich
                ? {}
                : {
                    faceThickness,
                    webThickness,
                    numberOfHoles: getDammamBlockHoleCount(details.blockSize),
                  }),
              failureLoad: row.failureLoad ?? row.load ?? "",
              failureLoadN: calculated?.failureLoadN ?? null,
              grossArea: calculated?.grossArea ?? null,
              grossStrength: calculated?.grossStrength ?? null,
              ...(isSandwich
                ? {
                    airDryStrength: airDryStrength ?? row.airDryStrength,
                    waterStrength:
                      airDryStrength === null
                        ? row.waterStrength
                        : (calculated!.grossStrength! / 1.2).toFixed(2),
                    normalizedStrength:
                      airDryStrength === null || shapeFactor === null || shapeFactor <= 0
                        ? row.normalizedStrength
                        : Math.round((airDryStrength * shapeFactor + Number.EPSILON) * 10) / 10,
                  }
                : {
                    netArea: calculated?.netArea ?? null,
                    netStrength: calculated?.netStrength ?? null,
                  }),
            };
          }
          return tableKey === "precastResults"
            ? { ...row, cubeSize: details.cubeSize ?? "100*100*100" }
            : row;
        });
    }
  }
  if (tableKey === "genericContext") {
    return [{
      ...details,
      sampleDate: record.sampleDate,
      location: record.location,
      material: record.material,
      testedBy: record.testedBy,
    }];
  }
  if (tableKey === "blockDetails") {
    return [{ ...details, plant: record.location }];
  }
  return [details];
}

const REPORT_TEMPLATE_TABLE_FIELD_ALIASES: Record<string, string[]> = {
  no: ["rowNo", "rowNumber", "blockNo", "cubeNo", "sampleNo"],
  age: ["testAge", "blockAge", "sampleAge"],
  size: ["sieveSize", "poreSize"],
  returned: ["amountReturned", "amountRetained", "massRetained"],
  retained: ["retainedPercentage", "percentRetained"],
  passing: ["amountPassing"],
  percentage: ["passingPercentage", "percentPassing"],
  lower: ["lowerLimit"],
  upper: ["upperLimit"],
  strength: ["calculatedStrength", "compressiveStrength", "normalizedStrength"],
  weight: ["cubeWeight", "sampleWeight", "dryWeight"],
  water: ["waterStrength", "wetStrength"],
  load: ["failureLoad"],
  airDry: ["airDryStrength"],
  normalized: ["normalizedStrength"],
  waterAbsorption: ["absorption", "absorptionPercentage"],
  testingDate: ["date", "testDate"],
};

const DAMMAM_ONLY_BLOCK_LAYOUT_KEYS = new Set([
  "plant",
  "faceThickness",
  "webThickness",
  "numberOfHoles",
  "grossArea",
  "netArea",
  "grossStrength",
  "netStrength",
]);
const DAMMAM_BLOCK_DETAILS_REQUIRED_KEYS = [
  "plant",
  "blockType",
  "blockSize",
];
const DAMMAM_BLOCK_RESULTS_REQUIRED_KEYS = [
  "no",
  "length",
  "width",
  "height",
  "load",
  "netArea",
  "grossStrength",
  "netStrength",
  "density",
];
const DAMMAM_SANDWICH_BLOCK_RESULTS_REQUIRED_KEYS = [
  "no",
  "length",
  "width",
  "height",
  "load",
  "grossArea",
  "airDry",
  "normalized",
  "density",
];
const reportColumnKey = (key: string) =>
  key.replace(/^details\./i, "").toLocaleLowerCase();

function reportTemplateTableCell(
  row: ValueMap,
  columnKey: string,
  rowIndex: number,
  isBlockCompression: boolean,
): string {
  if (columnKey === "no" && !Object.hasOwn(row, "no") &&
    !Object.hasOwn(row, "rowNo") && !Object.hasOwn(row, "rowNumber")) {
    return String(rowIndex + 1);
  }
  if (isBlockCompression && columnKey === "faceArea") {
    return formatBlockNetArea(row.width, row.length);
  }
  const keys = [columnKey, ...(REPORT_TEMPLATE_TABLE_FIELD_ALIASES[columnKey] ?? [])];
  const wanted = new Set(keys.map((key) => key.toLocaleLowerCase()));
  const value = Object.entries(row).find(([key]) => wanted.has(key.toLocaleLowerCase()))?.[1];
  if (isBlockCompression && ["grossArea", "netArea"].includes(columnKey)) {
    return formatDammamBlockArea(value);
  }
  if (isBlockCompression && ["grossStrength", "netStrength"].includes(columnKey)) {
    const strength = numericValue(value);
    return strength === null ? "" : strength.toFixed(1);
  }
  if (isBlockCompression && ["length", "width", "height"].includes(columnKey)) {
    return formatWholeNumber(value, "");
  }
  return value === undefined || value === null ? "" : textValue(value, "");
}

function reportTemplateCellField(
  key: string,
  fieldValues: Record<string, string>,
  record: QcRecord,
  row: ValueMap | undefined,
  rowIndex: number,
  isBlockCompression: boolean,
): string {
  if (
    record.testType === "Blocks" &&
    isDammamLocation(record.location) &&
    reportColumnKey(key) === "numberofholes"
  ) {
    return "";
  }
  if (row && key.startsWith("details.")) {
    return reportTemplateTableCell(row, key.slice("details.".length), rowIndex, isBlockCompression);
  }
  if (Object.hasOwn(fieldValues, key)) return fieldValues[key];
  return resolveReportTemplateDynamicField(record, key, fieldValues);
}

function evaluateFormulaForRecord(
  formula: string,
  record: QcRecord,
  fieldValues: Record<string, string>,
  row?: ValueMap,
  rowIndex = 0,
  isBlockCompression = false,
): string {
  try {
    const value = evaluateReportFormula(formula, (key) =>
      reportTemplateCellField(key, fieldValues, record, row, rowIndex, isBlockCompression),
    );
    return Number(value.toPrecision(12)).toString();
  } catch {
    return "#ERROR";
  }
}

function templateCellValue(
  cell: ReportTemplateObject,
  record: QcRecord,
  fieldValues: Record<string, string>,
  row: ValueMap | undefined,
  rowIndex: number,
  isBlockCompression: boolean,
  formulaPreview: boolean,
) {
  if (cell.formula !== undefined) {
    if (formulaPreview) return `[Formula: ${cell.name}]`;
    return evaluateFormulaForRecord(cell.formula, record, fieldValues, row, rowIndex, isBlockCompression);
  }
  if (cell.fieldKey) {
    return reportTemplateCellField(cell.fieldKey, fieldValues, record, row, rowIndex, isBlockCompression);
  }
  return resolveReportTemplateText(cell.content ?? "", fieldValues, (key) => {
    const value = reportTemplateCellField(key, fieldValues, record, row, rowIndex, isBlockCompression);
    return value === "" ? undefined : value;
  });
}

export function ReportTemplateDataTable({
  design,
  record,
  object,
  fieldValues,
  formulaPreview = false,
}: {
  design: ReportTemplateDesign;
  record: QcRecord;
  object: ReportTemplateObject;
  fieldValues: Record<string, string>;
  formulaPreview?: boolean;
}) {
  const tableKey = object.tableKey ?? "";
  const fallback = (REPORT_LAYOUT_FIELD_GROUPS[record.testType]?.[tableKey] ?? [])
    .map((field, order) => ({ ...field, visible: true, order }));
  const blockCompression = record.testType === "Blocks" && tableKey === "blockCompression";
  const blockDetails = record.testType === "Blocks" && tableKey === "blockDetails";
  const dammamBlock = record.testType === "Blocks" && isDammamLocation(record.location);
  const dammamExcludedKeys = blockDetails
    ? new Set(["facethickness", "webthickness", "numberofholes"])
    : blockCompression
      ? dammamBlock && isSandwichBlockType(record.details.blockType)
        ? new Set([
            "facearea",
            "water",
            "facethickness",
            "webthickness",
            "numberofholes",
            "netarea",
            "grossstrength",
            "netstrength",
          ])
        : new Set([
          "facearea",
          "water",
          "normalized",
          "normalizedstrength",
          "facethickness",
          "webthickness",
          "numberofholes",
          "grossarea",
          "airdry",
          "airdrystrength",
          "dryair",
          "dryairstrength",
        ])
      : new Set<string>();
  const configuredColumns = design.layout.columns[tableKey] ?? fallback;
  const plantCompatibleColumns = record.testType === "Blocks"
    ? configuredColumns.filter((column) => {
        const key = reportColumnKey(column.key);
        return dammamBlock
          ? key !== "numberofholes" && !dammamExcludedKeys.has(key)
          : !DAMMAM_ONLY_BLOCK_LAYOUT_KEYS.has(key);
      })
    : configuredColumns;
  const dammamDefaults = fallback.map((column) =>
    column.key === "load"
      ? { ...column, label: "Failure Load (kN)" }
      : column.key === "airDry"
        ? { ...column, label: "Air-dry Strength (N/mm²)" }
        : column.key === "normalized"
          ? { ...column, label: "Normalized Strength (N/mm²)" }
          : column,
  );
  const compatibleColumns = blockCompression
    ? dammamBlock
      ? blockReportColumnsWithRequiredFields(
          plantCompatibleColumns,
          dammamDefaults,
          isSandwichBlockType(record.details.blockType)
            ? DAMMAM_SANDWICH_BLOCK_RESULTS_REQUIRED_KEYS
            : DAMMAM_BLOCK_RESULTS_REQUIRED_KEYS,
        )
      : blockReportColumnsWithFaceArea(
          plantCompatibleColumns,
          fallback.find((column) => column.key === "faceArea"),
        )
    : dammamBlock && blockDetails
      ? blockReportColumnsWithRequiredFields(
          plantCompatibleColumns,
          dammamDefaults,
          DAMMAM_BLOCK_DETAILS_REQUIRED_KEYS,
        )
      : plantCompatibleColumns;
  const faceAreaVisible = blockCompression && !dammamBlock &&
    compatibleColumns.some((column) => column.key === "faceArea" && column.visible);
  const columns = compatibleColumns
    .filter((column) => column.visible)
    .sort((left, right) => left.order - right.order);
  const rows = reportTemplateTableRows(record, tableKey);
  const structuredRows = directChildren(design.objects, object.id)
    .filter((child) => child.type === "tableRow" && child.visible)
    .sort((left, right) => left.y - right.y || left.zIndex - right.zIndex);
  const borderColor = object.borderColor ?? "#9aa6b2";
  const requiredDammamKeys = dammamBlock
    ? blockDetails
      ? DAMMAM_BLOCK_DETAILS_REQUIRED_KEYS
      : blockCompression
        ? isSandwichBlockType(record.details.blockType)
          ? DAMMAM_SANDWICH_BLOCK_RESULTS_REQUIRED_KEYS
          : DAMMAM_BLOCK_RESULTS_REQUIRED_KEYS
        : []
    : [];
  const requiredDammamColumns = columns.filter((column) =>
    requiredDammamKeys.includes(column.key),
  );

  if (structuredRows.length) {
    const headerRows = structuredRows.filter((row) => row.rowType === "header");
    const bodyRows = structuredRows.filter((row) => row.rowType !== "header");
    const isNetAreaCell = (cell: ReportTemplateObject) => {
      const fieldKey = cell.fieldKey?.toLocaleLowerCase();
      const label = `${cell.name} ${cell.content ?? ""}`.toLocaleLowerCase();
      return fieldKey === "details.facearea" || fieldKey === "facearea" ||
        fieldKey === "details.netarea" || fieldKey === "netarea" ||
        label.includes("face area") || label.includes("net area");
    };
    const isExcludedDammamCell = (cell: ReportTemplateObject) => {
      const key = reportColumnKey(cell.fieldKey ?? "");
      if (dammamExcludedKeys.has(key)) return true;
      const label = `${cell.name} ${cell.content ?? ""}`.toLocaleLowerCase();
      if (key === "numberofholes" || label.includes("number of holes")) return true;
      return blockDetails
        ? ["face thickness", "web thickness"].some((value) => label.includes(value))
        : blockCompression &&
          (isSandwichBlockType(record.details.blockType)
            ? [
                "face thickness",
                "web thickness",
                "net area",
                "net strength",
                "gross strength",
                "water",
              ]
            : [
                "normalized strength",
                "normalized",
                "face thickness",
                "web thickness",
                "gross area",
                "air dry",
              ])
            .some((value) => label.includes(value));
    };
    const cellObjects = (row: ReportTemplateObject) => directChildren(design.objects, row.id)
      .filter((cell) =>
        cell.type === "tableCell" &&
        cell.visible &&
        (dammamBlock
          ? !isExcludedDammamCell(cell)
          : !DAMMAM_ONLY_BLOCK_LAYOUT_KEYS.has(reportColumnKey(cell.fieldKey ?? ""))) &&
        (faceAreaVisible || !isNetAreaCell(cell) ||
          (dammamBlock && reportColumnKey(cell.fieldKey ?? "") === "netarea")),
      )
      .sort((left, right) => (left.columnIndex ?? left.x) - (right.columnIndex ?? right.x));
    const missingDammamColumns = (row: ReportTemplateObject) => {
      if (row.rowType !== "header" && row.rowType !== "dynamic") return [];
      const existingKeys = new Set(cellObjects(row).map((cell, index) =>
        reportColumnKey(cell.fieldKey ?? columns[index]?.key ?? ""),
      ));
      return requiredDammamColumns.filter((column) => !existingKeys.has(column.key));
    };
    const needsFaceAreaCell = (row: ReportTemplateObject) =>
      faceAreaVisible && !cellObjects(row).some(isNetAreaCell);
    const columnCount = Math.max(
      1,
      ...structuredRows.map((row) =>
        cellObjects(row).length +
        (needsFaceAreaCell(row) ? 1 : 0) +
        missingDammamColumns(row).length,
      ),
    );
    const renderRow = (templateRow: ReportTemplateObject, dataRow?: ValueMap, rowIndex = 0) => {
      const cells = cellObjects(templateRow);
      const appendFaceArea = needsFaceAreaCell(templateRow);
      const appendedDammamColumns = missingDammamColumns(templateRow);
      const existingWidth = cells.reduce((total, cell) => total + cell.width, 0);
      const faceAreaWidth = object.width / columnCount;
      const appendedWidth = faceAreaWidth *
        (appendedDammamColumns.length + (appendFaceArea ? 1 : 0));
      const existingWidthScale = appendedWidth > 0 && existingWidth > 0
        ? Math.max(0, object.width - appendedWidth) / existingWidth
        : 1;
      return <tr
        key={`${templateRow.id}-${dataRow ? rowIndex : "static"}`}
        style={{
          height: `${templateRow.height}mm`,
          backgroundColor: templateRow.backgroundColor,
          fontFamily: templateRow.fontFamily ?? object.fontFamily ?? "Arial",
          fontSize: `${templateRow.fontSize ?? object.fontSize ?? 10}px`,
          color: templateRow.textColor ?? object.textColor ?? "#20252b",
          fontWeight: templateRow.bold ? 700 : undefined,
          textAlign: templateRow.textAlign ?? "left",
        }}
      >
        {cells.map((cell, cellIndex) => <td
          key={cell.id}
          style={{
            width: `${cell.width * existingWidthScale}mm`,
            height: `${cell.height}mm`,
            border: `${cell.borderWidth ?? templateRow.borderWidth ?? 0.5}px ${cell.lineStyle ?? templateRow.lineStyle ?? "solid"} ${cell.borderColor ?? templateRow.borderColor ?? borderColor}`,
            padding: `${cell.padding ?? templateRow.padding ?? 1}px`,
            backgroundColor: cell.backgroundColor ?? templateRow.backgroundColor,
            color: cell.textColor ?? templateRow.textColor ?? object.textColor ?? "#20252b",
            fontFamily: cell.fontFamily ?? templateRow.fontFamily ?? object.fontFamily ?? "Arial",
            fontSize: `${cell.fontSize ?? templateRow.fontSize ?? object.fontSize ?? 10}px`,
            fontWeight: cell.bold ?? templateRow.bold ? 700 : undefined,
            fontStyle: cell.italic ? "italic" : undefined,
            textAlign: cell.textAlign ?? templateRow.textAlign ?? "left",
            verticalAlign: "middle",
            overflowWrap: "anywhere",
            boxSizing: "border-box",
          }}
          data-report-cell={cell.id}
        >{dammamBlock && templateRow.rowType === "header" &&
          columns[cellIndex] && requiredDammamKeys.includes(columns[cellIndex].key)
          ? columns[cellIndex].label
          : blockCompression && isNetAreaCell(cell) && templateRow.rowType === "header"
            ? "Net Area (mm²)"
            : blockCompression && isNetAreaCell(cell) && templateRow.rowType === "dynamic" && dataRow
              ? reportTemplateTableCell(dataRow, dammamBlock ? "netArea" : "faceArea", rowIndex, true)
              : templateCellValue(cell, record, fieldValues, dataRow, rowIndex, blockCompression, formulaPreview)}</td>)}
        {appendFaceArea && <td
          key={`${templateRow.id}-face-area`}
          style={{
            width: `${faceAreaWidth}mm`,
            height: `${templateRow.height}mm`,
            border: `${templateRow.borderWidth ?? 0.5}px ${templateRow.lineStyle ?? "solid"} ${templateRow.borderColor ?? borderColor}`,
            padding: `${templateRow.padding ?? 1}px`,
            backgroundColor: templateRow.backgroundColor,
            color: templateRow.textColor ?? object.textColor ?? "#20252b",
            fontFamily: templateRow.fontFamily ?? object.fontFamily ?? "Arial",
            fontSize: `${templateRow.fontSize ?? object.fontSize ?? 10}px`,
            fontWeight: templateRow.bold ? 700 : undefined,
            textAlign: templateRow.textAlign ?? "left",
            verticalAlign: "middle",
            overflowWrap: "anywhere",
            boxSizing: "border-box",
          }}
          data-report-cell={`${templateRow.id}-face-area`}
        >
          {templateRow.rowType === "header"
            ? "Net Area (mm²)"
            : templateRow.rowType === "dynamic" && dataRow
              ? reportTemplateTableCell(dataRow, "faceArea", rowIndex, true)
              : ""}
        </td>}
        {appendedDammamColumns.map((column) => <td
          key={`${templateRow.id}-${column.key}`}
          style={{
            width: `${faceAreaWidth}mm`,
            height: `${templateRow.height}mm`,
            border: `${templateRow.borderWidth ?? 0.5}px ${templateRow.lineStyle ?? "solid"} ${templateRow.borderColor ?? borderColor}`,
            padding: `${templateRow.padding ?? 1}px`,
            backgroundColor: templateRow.backgroundColor,
            color: templateRow.textColor ?? object.textColor ?? "#20252b",
            fontFamily: templateRow.fontFamily ?? object.fontFamily ?? "Arial",
            fontSize: `${templateRow.fontSize ?? object.fontSize ?? 10}px`,
            fontWeight: templateRow.bold ? 700 : undefined,
            textAlign: templateRow.textAlign ?? "left",
            verticalAlign: "middle",
            overflowWrap: "anywhere",
            boxSizing: "border-box",
          }}
          data-report-cell={`${templateRow.id}-${column.key}`}
        >
          {templateRow.rowType === "header"
            ? column.label
            : templateRow.rowType === "dynamic" && dataRow
              ? reportTemplateTableCell(dataRow, column.key, rowIndex, blockCompression)
              : ""}
        </td>)}
      </tr>;
    };
    return (
      <table className="report-template-data-table" aria-label={object.name} data-report-table={object.id} style={{
        width: "100%",
        minHeight: "100%",
        tableLayout: "fixed",
        borderCollapse: "collapse",
        fontFamily: object.fontFamily ?? "Arial",
        fontSize: `${object.fontSize ?? 10}px`,
        color: object.textColor ?? "#20252b",
      }}>
        {headerRows.length > 0 && <thead>{headerRows.map((row) => renderRow(row))}</thead>}
        <tbody>
          {bodyRows.flatMap((templateRow) => templateRow.rowType === "dynamic"
            ? rows.length ? rows.map((dataRow, rowIndex) => renderRow(templateRow, dataRow, rowIndex)) : []
            : [renderRow(templateRow)])}
          {bodyRows.some((row) => row.rowType === "dynamic") && rows.length === 0 &&
            <tr><td colSpan={columnCount} style={{ border: `1px solid ${borderColor}`, padding: 4 }}>No saved row data.</td></tr>}
        </tbody>
      </table>
    );
  }
  return (
    <table
      className="report-template-data-table"
      aria-label={object.name}
      style={{
        width: "100%",
        height: "100%",
        tableLayout: "fixed",
        borderCollapse: "collapse",
        fontFamily: object.fontFamily ?? "Arial",
        fontSize: `${object.fontSize ?? 10}px`,
        color: object.textColor ?? "#20252b",
      }}
    >
      <thead><tr>{columns.map((column) => (
        <th key={column.key} scope="col" style={{
          width: `${column.width}%`,
          border: `1px solid ${borderColor}`,
          backgroundColor: object.backgroundColor ?? design.layout.accentColor,
          color: object.backgroundColor ? object.textColor ?? "#20252b" : "#fff",
          padding: "2px 3px",
          textAlign: object.textAlign ?? "left",
          overflowWrap: "anywhere",
        }}>{blockCompression && column.key === "faceArea" ? "Net Area (mm²)" : column.label}</th>
      ))}</tr></thead>
      <tbody>
        {!columns.length ? (
          <tr><td colSpan={1} style={{ border: `1px solid ${borderColor}`, padding: 4 }}>No visible columns</td></tr>
        ) : rows.length ? rows.map((row, rowIndex) => (
          <tr key={rowIndex}>{columns.map((column) => (
            <td key={column.key} style={{
              border: `1px solid ${borderColor}`,
              padding: "2px 3px",
              verticalAlign: "top",
              overflowWrap: "anywhere",
            }}>{reportTemplateTableCell(row, column.key, rowIndex, blockCompression)}</td>
          ))}</tr>
        )) : (
          <tr><td colSpan={columns.length} style={{ border: `1px solid ${borderColor}`, padding: 4 }}>No saved row data.</td></tr>
        )}
      </tbody>
    </table>
  );
}

function addDaysToDate(value: string, days: number) {
  const date = new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

function numericValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const number = Number.parseFloat(value);
  return Number.isFinite(number) ? number : null;
}

function hasSieveSize(value: unknown) {
  return typeof value === "string"
    ? value.trim().length > 0
    : value !== null && value !== undefined;
}

function hasSieveEntry(value: unknown) {
  return typeof value === "string"
    ? value.trim().length > 0
    : value !== null && value !== undefined;
}

function calculatedDensity(values: ValueMap) {
  const storedDensity = numericValue(values.density ?? values.densityKgM3);
  if (storedDensity !== null) return formatNumber(storedDensity);

  const dryWeight = numericValue(values.dryWeight);
  const length = numericValue(values.length);
  const width = numericValue(values.width);
  const height = numericValue(values.height);
  if (
    dryWeight === null ||
    length === null ||
    width === null ||
    height === null ||
    dryWeight <= 0 ||
    length <= 0 ||
    width <= 0 ||
    height <= 0
  ) {
    return "-";
  }
  return formatNumber((dryWeight * 1_000_000_000) / (length * width * height));
}

function calculatedWaterAbsorption(values: ValueMap) {
  const dryWeight = numericValue(values.dryWeight);
  const wetWeight = numericValue(values.wetWeight);
  if (dryWeight !== null && wetWeight !== null && dryWeight > 0) {
    return formatNumber(((wetWeight - dryWeight) / dryWeight) * 100);
  }
  const storedAbsorption = numericValue(values.waterAbsorption ?? values.absorption);
  return storedAbsorption === null ? "-" : formatNumber(storedAbsorption);
}

function hasSpecimenMeasurements(rows: unknown[]) {
  return rows.some((row) => {
    if (typeof row !== "object" || row === null) return false;
    const values = row as Record<string, unknown>;
    return ["length", "width", "height", "dryWeight", "wetWeight"].some(
      (key) => values[key] !== undefined && values[key] !== "",
    );
  });
}

function sortCubeRowsByAge(rows: unknown[]) {
  return rows
    .map((row, index) => {
      const values = typeof row === "object" && row !== null
        ? row as Record<string, unknown>
        : {};
      const rawAge = values.testAge ?? values.sampleAge ?? values.cubeAge ?? values.age;
      const age = rawAge === undefined || rawAge === null || rawAge === ""
        ? null
        : Number.parseFloat(String(rawAge).replace(/,/g, ""));
      return { row, index, age: Number.isFinite(age) ? age : null };
    })
    .sort((left, right) => {
      if (left.age === null && right.age !== null) return 1;
      if (left.age !== null && right.age === null) return -1;
      if (left.age !== null && right.age !== null && left.age !== right.age) {
        return left.age - right.age;
      }
      return left.index - right.index;
    })
    .map(({ row }) => row);
}

function cubeRowAge(row: unknown) {
  const values = typeof row === "object" && row !== null
    ? row as Record<string, unknown>
    : {};
  const rawAge = values.testAge ?? values.sampleAge ?? values.cubeAge ?? values.age;
  if (rawAge === undefined || rawAge === null || rawAge === "") return null;
  const age = numericValue(rawAge);
  return age;
}

function cubeRowStrength(row: unknown) {
  const values = typeof row === "object" && row !== null
    ? row as Record<string, unknown>
    : {};
  const storedStrength = numericValue(
    values.calculatedStrength ?? values.strength ?? values.compressiveStrength,
  );
  if (storedStrength !== null) return storedStrength;

  const load = numericValue(values.load);
  const length = numericValue(values.length);
  const width = numericValue(values.width);
  if (load === null || length === null || width === null || length <= 0 || width <= 0) {
    return null;
  }
  return (load * 1000) / (length * width);
}

function averageStrengthForAgeRange(rows: unknown[], minimumAge: number, maximumAge: number) {
  const strengths = rows
    .filter((row) => {
      const age = cubeRowAge(row);
      return age !== null && age >= minimumAge && age <= maximumAge;
    })
    .map(cubeRowStrength)
    .filter((strength): strength is number => strength !== null);
  if (!strengths.length) return null;
  return strengths.reduce((total, strength) => total + strength, 0) / strengths.length;
}

function numericSummary(values: Array<number | null>) {
  const numbers = values.filter((value): value is number => value !== null);
  if (!numbers.length) {
    return { average: null, minimum: null, maximum: null, standardDeviation: null };
  }
  const average = numbers.reduce((total, value) => total + value, 0) / numbers.length;
  const variance = numbers.reduce(
    (total, value) => total + ((value - average) ** 2),
    0,
  ) / numbers.length;
  return {
    average,
    minimum: Math.min(...numbers),
    maximum: Math.max(...numbers),
    standardDeviation: numbers.length > 1 ? Math.sqrt(variance) : null,
  };
}

function blockDensity(values: ValueMap) {
  const storedDensity = numericValue(values.density ?? values.densityKgM3);
  if (storedDensity !== null) return storedDensity;
  const wetWeight = numericValue(values.wetWeight);
  const length = numericValue(values.length);
  const width = numericValue(values.width);
  const height = numericValue(values.height);
  if (
    wetWeight === null ||
    length === null ||
    width === null ||
    height === null ||
    wetWeight < 0 ||
    length <= 0 ||
    width <= 0 ||
    height <= 0
  ) {
    return null;
  }
  return (wetWeight * 1_000_000_000) / (length * width * height);
}

function blockWaterStrength(values: ValueMap) {
  return numericValue(
    values.waterStrength ??
    values.calculatedStrength ??
    values.strength ??
    values.compressiveStrength,
  );
}

function blockAirDryStrength(values: ValueMap, useDammamBasis: boolean) {
  const waterStrength = blockWaterStrength(values);
  if (useDammamBasis && waterStrength !== null) return waterStrength;
  const storedValue = numericValue(values.airDryStrength ?? values.dryAirStrength);
  if (storedValue !== null) return storedValue;
  return waterStrength === null ? null : Number((waterStrength * 1.2).toFixed(1));
}

function BlockCompressionRowsTable({
  rows,
  hideWaterStrength,
  dammamSandwich = false,
  layout,
  blockDetails,
}: {
  rows: unknown[];
  hideWaterStrength: boolean;
  dammamSandwich?: boolean;
  layout?: ReportLayout;
  blockDetails: ValueMap;
}) {
  const thicknessDefaults = getDammamBlockThicknessDefaults(blockDetails.blockSize);
  const rowValues = rows.map((row) => (
    typeof row === "object" && row !== null ? row as ValueMap : {}
  )).map((values) => hideWaterStrength
    ? {
        ...values,
        faceThickness:
          values.faceThickness ??
          blockDetails.faceThickness ??
          thicknessDefaults.faceThickness,
        webThickness:
          values.webThickness ??
          blockDetails.webThickness ??
          thicknessDefaults.webThickness,
      }
    : values);
  const dammamResults = hideWaterStrength || dammamSandwich
    ? rowValues.map((values) =>
        calculateDammamBlockResults(
          { ...values, load: values.failureLoad ?? values.load },
          blockDetails.blockSize,
          values.faceThickness,
          values.webThickness,
          blockDetails.blockType,
        ),
      )
    : [];
  const sandwichAirDry = dammamResults.map((value) =>
    value?.grossStrength == null
      ? null
      : Math.round((value.grossStrength + Number.EPSILON) * 10) / 10,
  );
  const sandwichNormalized = rowValues.map((values, index) => {
    const shapeFactor = numericValue(blockDetails.shapeFactor);
    return sandwichAirDry[index] !== null &&
        shapeFactor !== null &&
        shapeFactor > 0
      ? Math.round((sandwichAirDry[index]! * shapeFactor + Number.EPSILON) * 10) / 10
      : numericValue(values.normalizedStrength);
  });
  const columns = {
    water: rowValues.map(blockWaterStrength),
    airDry: rowValues.map((values, index) => dammamSandwich
      ? sandwichAirDry[index]
      : blockAirDryStrength(values, hideWaterStrength)),
    normalized: dammamSandwich
      ? sandwichNormalized
      : rowValues.map((values) => numericValue(values.normalizedStrength)),
    density: rowValues.map(blockDensity),
    grossArea: dammamResults.map((values) => values?.grossArea ?? null),
    grossStrength: dammamResults.map((values) => values?.grossStrength ?? null),
    netStrength: dammamResults.map((values) => values?.netStrength ?? null),
  };
  const averages = {
    water: numericSummary(columns.water).average,
    airDry: numericSummary(columns.airDry).average,
    normalized: numericSummary(columns.normalized).average,
    density: numericSummary(columns.density).average,
    grossArea: numericSummary(columns.grossArea).average,
    grossStrength: numericSummary(columns.grossStrength).average,
    netStrength: numericSummary(columns.netStrength).average,
  };
  const strengthValues = hideWaterStrength ? columns.netStrength : columns.airDry;
  const strengthSummary = numericSummary(strengthValues);
  const strengthLabel = hideWaterStrength ? "Net Strength" : "Air Dry Strength";
  const displayNumber = (value: number | null) =>
    value === null ? "-" : formatNumber(value);
  const fixedKeys = hideWaterStrength
    ? ["no", "length", "width", "height", "netArea", "load", "grossStrength", "netStrength", "density"]
    : dammamSandwich
      ? ["no", "length", "width", "height", "grossArea", "load", "airDry", "normalized", "density"]
      : ["no", "length", "width", "height", "faceArea", "load", "water", "airDry", "normalized", "density"];
  const fixedLabels = hideWaterStrength
    ? ["No.", "Length (mm)", "Width (mm)", "Height (mm)", "Net Area (mm²)", "Failure Load (kN)", "Gross Strength (N/mm²)", "Net Strength (N/mm²)", "Density (kg/m3)"]
    : dammamSandwich
      ? ["No.", "Length (mm)", "Width (mm)", "Height (mm)", "Gross Area (mm²)", "Failure Load (kN)", "Air-dry Strength (N/mm²)", "Normalized Strength (N/mm²)", "Density (kg/m3)"]
      : ["No.", "Length (mm)", "Width (mm)", "Height (mm)", "Net Area (mm²)", "Load (kN)", "Water (N/mm2)", "Air Dry (N/mm2)", "Normalized (N/mm2)", "Density (kg/m3)"];
  const saved = layout?.config.columns.blockCompression;
  const defaultColumns = (REPORT_LAYOUT_FIELD_GROUPS.Blocks.blockCompression ?? [])
    .map((column, order) => ({ ...column, visible: true, order }));
  const dammamDefaultColumns = [
    ...defaultColumns.map((column) =>
      column.key === "load"
        ? { ...column, label: "Failure Load (kN)" }
        : column.key === "airDry"
          ? { ...column, label: "Air-dry Strength (N/mm²)" }
          : column.key === "normalized"
            ? { ...column, label: "Normalized Strength (N/mm²)" }
            : column,
    ),
    {
      key: "webThickness",
      label: "Web Thickness (mm)",
      width: 8,
      visible: true,
      order: defaultColumns.length,
    },
    {
      key: "faceThickness",
      label: "Face Thickness (mm)",
      width: 8,
      visible: true,
      order: defaultColumns.length + 1,
    },
  ];
  const savedColumns = saved
    ? hideWaterStrength
      ? blockReportColumnsWithRequiredFields(
          saved.filter((column) =>
            ![
              "facearea",
              "water",
              "normalized",
              "normalizedstrength",
              "facethickness",
              "webthickness",
              "numberofholes",
              "grossarea",
              "airdry",
              "airdrystrength",
              "dryair",
              "dryairstrength",
            ].includes(
              reportColumnKey(column.key),
            ),
          ),
          dammamDefaultColumns,
          DAMMAM_BLOCK_RESULTS_REQUIRED_KEYS,
        )
      : dammamSandwich
        ? blockReportColumnsWithRequiredFields(
            saved.filter((column) =>
              ![
                "facearea",
                "water",
                "facethickness",
                "webthickness",
                "numberofholes",
                "netarea",
                "grossstrength",
                "netstrength",
              ].includes(reportColumnKey(column.key)),
            ),
            dammamDefaultColumns,
            DAMMAM_SANDWICH_BLOCK_RESULTS_REQUIRED_KEYS,
          )
      : blockReportColumnsWithFaceArea(
          saved,
          defaultColumns.find((column) => column.key === "faceArea"),
        )
    : undefined;
  const custom = Boolean(savedColumns?.length && (savedColumns.length !== fixedKeys.length ||
    savedColumns.some((column, index) => column.key !== fixedKeys[index] || !column.visible ||
      column.label !== fixedLabels[index])));
  if (custom) {
    const visibleColumns = savedColumns!.filter((column) => column.visible).sort((a, b) => a.order - b.order);
    const valueFor = (values: ValueMap, key: string, index: number) => key === "no" ? rawTextValue(values.rowNo, String(index + 1))
      : ["length", "width", "height"].includes(key) ? formatWholeNumber(values[key])
      : key === "faceArea" ? formatBlockNetArea(values.width, values.length)
      : key === "grossArea" ? formatDammamBlockArea(dammamResults[index]?.grossArea)
      : key === "netArea" ? formatDammamBlockArea(dammamResults[index]?.netArea)
      : key === "grossStrength" ? displayNumber(dammamResults[index]?.grossStrength ?? null)
      : key === "netStrength" ? displayNumber(dammamResults[index]?.netStrength ?? null)
      : key === "load" ? textValue(values.failureLoad ?? values.load)
      : key === "water" ? displayNumber(blockWaterStrength(values))
      : key === "airDry" ? displayNumber(columns.airDry[index])
      : key === "normalized" ? displayNumber(columns.normalized[index])
      : key === "density" ? displayNumber(blockDensity(values))
      : textValue(values[key]);
    return <><div className="block-report-section-heading"><div><span>Specimen results</span></div></div>
       <div className="block-report-table-wrap"><table className="report-table block-report-table"><thead><tr>{visibleColumns.map((c) => <th key={c.key} style={{ width: `${c.width}%` }}>{c.label}</th>)}</tr></thead><tbody>
         {rowValues.map((values, index) => <tr key={index}>{visibleColumns.map((c) => <td key={c.key}>{valueFor(values, c.key, index)}</td>)}</tr>)}
          <tr className="block-report-average-row"><td colSpan={visibleColumns.length}>AVERAGE: {displayNumber(strengthSummary.average)} {strengthLabel}</td></tr>
      </tbody></table></div><div className="block-report-section-heading block-report-statistics-heading"><div><span>Summary statistics</span></div></div>
      <div className="block-report-statistics"><div><strong>Maximum</strong><span>{strengthLabel}</span><b>{displayNumber(strengthSummary.maximum)}</b></div><div><strong>Minimum</strong><span>{strengthLabel}</span><b>{displayNumber(strengthSummary.minimum)}</b></div><div><strong>Stan.Dev.</strong><span>{strengthLabel}</span><b>{displayNumber(strengthSummary.standardDeviation)}</b></div></div></>;
  }
  return (
    <>
      <div className="block-report-section-heading">
        <div>
          <span>Specimen results</span>
        </div>
      </div>
      <div className="block-report-table-wrap">
        <table className="report-table block-report-table">
          <thead>
            <tr>
              {hideWaterStrength ? (
                <>
                  <th>No.</th>
                  <th>Length<br />(mm)</th>
                  <th>Width<br />(mm)</th>
                  <th>Height<br />(mm)</th>
                  <th>Net Area<br />(mm²)</th>
                  <th>Failure Load<br />(kN)</th>
                  <th>Gross Strength<br />(N/mm²)</th>
                  <th>Net Strength<br />(N/mm²)</th>
                  <th>Density<br />(kg/m3)</th>
                </>
              ) : dammamSandwich ? (
                <>
                  <th>No.</th>
                  <th>Length<br />(mm)</th>
                  <th>Width<br />(mm)</th>
                  <th>Height<br />(mm)</th>
                  <th>Gross Area<br />(mm²)</th>
                  <th>Failure Load<br />(kN)</th>
                  <th>Air-dry Strength<br />(N/mm²)</th>
                  <th>Normalized Strength<br />(N/mm²)</th>
                  <th>Density<br />(kg/m3)</th>
                </>
              ) : (
                <>
                  <th>No.</th>
                  <th>Length<br />(mm)</th>
                  <th>Width<br />(mm)</th>
                  <th>Height<br />(mm)</th>
                  <th>Net Area<br />(mm²)</th>
                  <th>Load<br />(kN)</th>
                  <th>Water<br />(N/mm2)</th>
                  <th>Air Dry<br />(N/mm2)</th>
                  <th>Normalized<br />(N/mm2)</th>
                  <th>Density<br />(kg/m3)</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {rowValues.map((values, index) => (
              <tr key={index}>
                <td>{rawTextValue(values.rowNo, String(index + 1))}</td>
                <td>{formatWholeNumber(values.length)}</td>
                <td>{formatWholeNumber(values.width)}</td>
                <td>{formatWholeNumber(values.height)}</td>
                {hideWaterStrength ? (
                  <>
                    <td>{formatDammamBlockArea(dammamResults[index]?.netArea)}</td>
                    <td>{textValue(values.failureLoad ?? values.load)}</td>
                    <td>{displayNumber(columns.grossStrength[index])}</td>
                    <td>{displayNumber(columns.netStrength[index])}</td>
                    <td>{displayNumber(columns.density[index])}</td>
                  </>
                ) : dammamSandwich ? (
                  <>
                    <td>{formatDammamBlockArea(dammamResults[index]?.grossArea)}</td>
                    <td>{textValue(values.failureLoad ?? values.load)}</td>
                    <td>{displayNumber(columns.airDry[index])}</td>
                    <td>{displayNumber(columns.normalized[index])}</td>
                    <td>{displayNumber(columns.density[index])}</td>
                  </>
                ) : (
                  <>
                    <td>{formatBlockNetArea(values.width, values.length)}</td>
                    <td>{textValue(values.load)}</td>
                    <td>{displayNumber(columns.water[index])}</td>
                    <td>{displayNumber(columns.airDry[index])}</td>
                    <td>{displayNumber(columns.normalized[index])}</td>
                    <td>{displayNumber(columns.density[index])}</td>
                  </>
                )}
              </tr>
            ))}
            <tr className="block-report-average-row">
              {hideWaterStrength ? (
                <>
                    <td colSpan={6}>AVERAGE:</td>
                  <td>{displayNumber(averages.grossStrength)}</td>
                  <td>{displayNumber(averages.netStrength)}</td>
                  <td>{displayNumber(averages.density)}</td>
                </>
              ) : dammamSandwich ? (
                <>
                  <td colSpan={6}>AVERAGE:</td>
                  <td>{displayNumber(averages.airDry)}</td>
                  <td>{displayNumber(averages.normalized)}</td>
                  <td>{displayNumber(averages.density)}</td>
                </>
              ) : (
                <>
                  <td colSpan={6}>AVERAGE:</td>
                  <td>{displayNumber(averages.water)}</td>
                  <td>{displayNumber(averages.airDry)}</td>
                  <td>{displayNumber(averages.normalized)}</td>
                  <td>{displayNumber(averages.density)}</td>
                </>
              )}
            </tr>
          </tbody>
        </table>
      </div>
      <div className="block-report-section-heading block-report-statistics-heading">
        <div>
          <span>Summary statistics</span>
        </div>
      </div>
      <div className="block-report-statistics">
        <div>
          <strong>Maximum</strong>
          <span>{strengthLabel}</span>
          <b>{displayNumber(strengthSummary.maximum)}</b>
        </div>
        <div>
          <strong>Minimum</strong>
          <span>{strengthLabel}</span>
          <b>{displayNumber(strengthSummary.minimum)}</b>
        </div>
        <div>
          <strong>Stan.Dev.</strong>
          <span>{strengthLabel}</span>
          <b>{displayNumber(strengthSummary.standardDeviation)}</b>
        </div>
      </div>
    </>
  );
}

function blockAgeFromRecord(details: DetailMap, rows: unknown[]) {
  const configuredAge = numericValue(details.blockAge);
  if (configuredAge !== null && Number.isSafeInteger(configuredAge) && configuredAge >= 0) {
    return configuredAge;
  }
  for (const row of rows) {
    const age = cubeRowAge(row);
    if (age !== null && Number.isSafeInteger(age) && age >= 0) return age;
  }
  return null;
}

function ReadyMixAverageStrengthTable({ rows }: { rows: unknown[] }) {
  const ranges = [
    { label: "3–5 Days", minimum: 3, maximum: 5 },
    { label: "6–8 Days", minimum: 6, maximum: 8 },
    { label: "28–29 Days", minimum: 28, maximum: 29 },
  ];
  return (
    <div className="report-average-block ready-mix-average-block">
      <p className="report-centered-title">Average Strength</p>
      <table className="report-table report-average-table">
        <thead>
          <tr>
            <th>Cube Age</th>
            <th>Average Strength (N/mm²)</th>
          </tr>
        </thead>
        <tbody>
          {ranges.map((range) => {
            const average = averageStrengthForAgeRange(rows, range.minimum, range.maximum);
            return (
            <tr key={range.label}>
              <td>{range.label}</td>
              <td>
                {average === null
                  ? "-"
                  : formatNumber(average)}
              </td>
            </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SpecimenRowsTable({
  rows,
  status,
  layout,
}: {
  rows: unknown[];
  status: string;
  layout?: ReportLayout;
}) {
  if (!hasSpecimenMeasurements(rows)) return null;
  const tableColumns = layoutColumns(layout, "pavingResults", [
    { key: "no", label: "Block No.", visible: true, order: 0, width: 7 },
    { key: "length", label: "Length (mm)", visible: true, order: 1, width: 9 },
    { key: "width", label: "Width (mm)", visible: true, order: 2, width: 9 },
    { key: "height", label: "Height (mm)", visible: true, order: 3, width: 9 },
    { key: "load", label: "Load (kN)", visible: true, order: 4, width: 9 },
    { key: "tensileStrength", label: "Tensile Strength (N/mm²)", visible: true, order: 5, width: 13 },
    { key: "weightBefore", label: "Weight Before (kg)", visible: true, order: 6, width: 11 },
    { key: "weightAfter", label: "Weight After (kg)", visible: true, order: 7, width: 11 },
    { key: "density", label: "Density (kg/m³)", visible: true, order: 8, width: 11 },
    { key: "waterAbsorption", label: "% Water Absorption", visible: true, order: 9, width: 11 },
  ]);
  const strengths = rows.map((row) => {
    const values = typeof row === "object" && row !== null ? row as ValueMap : {};
    return (
      numericValue(values.tensileStrength) ??
      numericValue(values.correctedStrength) ??
      numericValue(values.calculatedStrength) ??
      numericValue(values.strength) ??
      numericValue(values.compressiveStrength)
    );
  }).filter((value): value is number => value !== null);
  const average = strengths.length
    ? strengths.reduce((total, value) => total + value, 0) / strengths.length
    : null;
  const strengthColumnIndex = tableColumns.findIndex((column) =>
    ["tensileStrength", "strength", "correctedStrength", "calculatedStrength"].includes(
      column.key,
    ),
  );
  const resultLabel = status === "Passed"
    ? "PASS"
    : status === "Failed"
      ? "NOT PASS"
      : "REVIEW";
  const resultClass = status.toLocaleLowerCase();
  return (
    <div className="report-specimen-block paving-report-table-wrap">
      <table className="report-table report-specimen-table paving-report-table">
        <thead>
          <tr>{tableColumns.map((column) => <th key={column.key}>{column.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const values =
              typeof row === "object" && row !== null
                ? (row as Record<string, unknown>)
                : {};
            const length = numericValue(values.length);
            const width = numericValue(values.width);
            const height = numericValue(values.height);
            const dryWeight = numericValue(values.dryWeight);
            const wetWeight = numericValue(values.wetWeight);
            const density = numericValue(values.density) ??
              (wetWeight !== null &&
              length !== null &&
              width !== null &&
              height !== null &&
              length > 0 &&
              width > 0 &&
              height > 0
                ? (wetWeight * 1_000_000_000) / (length * width * height)
                : null);
            const absorption = numericValue(values.waterAbsorption) ??
              (dryWeight !== null &&
              wetWeight !== null &&
              dryWeight > 0
                ? ((wetWeight - dryWeight) / dryWeight) * 100
                : null);
            return <tr key={index}>{tableColumns.map((column) => {
              const value = column.key === "no"
                ? rawTextValue(values.rowNo, String(index + 1))
              : column.key === "tensileStrength" ||
                    column.key === "strength" ||
                    column.key === "correctedStrength" ||
                    column.key === "calculatedStrength"
                  ? (() => {
                      const strength =
                        numericValue(values.tensileStrength) ??
                        numericValue(values.correctedStrength) ??
                        numericValue(values.calculatedStrength) ??
                        numericValue(values.strength) ??
                        numericValue(values.compressiveStrength);
                      return strength === null ? "" : formatNumber(strength);
                    })()
                  : column.key === "weightBefore" || column.key === "dryWeight"
                    ? textValue(values.dryWeight)
                    : column.key === "weightAfter" || column.key === "wetWeight"
                      ? textValue(values.wetWeight)
                      : column.key === "density"
                        ? density === null ? "" : formatNumber(density)
                        : column.key === "waterAbsorption"
                          ? absorption === null ? "" : formatNumber(absorption)
                          : column.key === "age"
                            ? textValue(values.testAge || values.sampleAge)
                            : textValue(values[column.key]);
              return <td key={column.key}>{value}</td>;
            })}</tr>;
          })}
        </tbody>
        {strengthColumnIndex >= 0 ? (
          <tfoot>
            <tr className="paving-average-row">
              {strengthColumnIndex > 0 && (
                <td colSpan={strengthColumnIndex}>AVERAGE:</td>
              )}
              <td>
                {strengthColumnIndex === 0
                  ? `AVERAGE: ${average === null ? "-" : average.toFixed(1)}`
                  : average === null
                    ? "-"
                    : average.toFixed(1)}
              </td>
              {strengthColumnIndex < tableColumns.length - 1 && (
                <td
                  className={`paving-average-status ${resultClass}`}
                  colSpan={tableColumns.length - strengthColumnIndex - 1}
                >
                  {resultLabel}
                </td>
              )}
            </tr>
          </tfoot>
        ) : (
          <tfoot>
            <tr className="paving-average-row">
              <td colSpan={tableColumns.length}>
                <span>AVERAGE:</span>
                <strong>{average === null ? "-" : average.toFixed(1)}</strong>
                <b className={`paving-average-status ${resultClass}`}>
                  {resultLabel}
                </b>
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

function PavingStrengthStatistics({ rows }: { rows: unknown[] }) {
  const tensileStrengths = rows.map((row) => {
    const values = typeof row === "object" && row !== null
      ? row as ValueMap
      : {};
    return (
      numericValue(values.tensileStrength) ??
      numericValue(values.correctedStrength) ??
      numericValue(values.calculatedStrength) ??
      numericValue(values.strength) ??
      numericValue(values.compressiveStrength)
    );
  });
  const summary = numericSummary(tensileStrengths);
  const numbers = tensileStrengths.filter(
    (value): value is number => value !== null,
  );
  const sampleStandardDeviation = numbers.length > 1 && summary.average !== null
    ? Math.sqrt(
        numbers.reduce(
          (total, value) => total + ((value - summary.average!) ** 2),
          0,
        ) / (numbers.length - 1),
      )
    : null;
  const displayNumber = (value: number | null) =>
    value === null ? "-" : formatNumber(value);
  return (
    <div className="block-report-statistics paving-tensile-statistics">
      <div>
        <strong>Maximum</strong>
        <span>Tensile Strength</span>
        <b>{displayNumber(summary.maximum)}</b>
      </div>
      <div>
        <strong>Minimum</strong>
        <span>Tensile Strength</span>
        <b>{displayNumber(summary.minimum)}</b>
      </div>
      <div>
        <strong>Stan.Dev.</strong>
        <span>Tensile Strength</span>
        <b>{displayNumber(sampleStandardDeviation)}</b>
      </div>
    </div>
  );
}

function SieveRowsTable({
  rows,
  layout,
  evaluation,
  sampleWeight,
}: {
  rows: unknown[];
  layout?: ReportLayout;
  evaluation: unknown;
  sampleWeight: number;
}) {
  const visibleRows = sortSieveRowsByPoreSize(rows.filter((row) => {
    const values = typeof row === "object" && row !== null
      ? row as Record<string, unknown> : {};
    return hasSieveSize(values.sieveSize) && hasSieveEntry(values.amountReturned);
  }), (row) => objectValue(row)?.sieveSize);
  if (!visibleRows.length) return null;
  const tableColumns = layoutColumns(layout, "sieveResults", [
    { key: "no", label: "No.", visible: true, order: 0, width: 5 },
    { key: "size", label: "Sieve / Pore Size", visible: true, order: 1, width: 15 },
    { key: "returned", label: "Mass Retained (g)", visible: true, order: 2, width: 11 },
    { key: "retained", label: "Retained (%)", visible: true, order: 3, width: 8 },
    { key: "passing", label: "Amount Passing (g)", visible: true, order: 4, width: 11 },
    { key: "percentage", label: "Passing (%)", visible: true, order: 5, width: 8 },
    { key: "lower", label: "Lower Limit", visible: true, order: 6, width: 12 },
    { key: "upper", label: "Upper Limit", visible: true, order: 7, width: 12 },
    { key: "remarks", label: "Remarks", visible: true, order: 8, width: 18 },
  ]);
  return (
    <div className="report-specimen-block">
      <p className="report-centered-title">Sieve Measurements:</p>
      <table className="report-table">
        <thead>
          <tr>{tableColumns.map((column) => <th key={column.key}>{column.label}</th>)}</tr>
        </thead>
        <tbody>
          {visibleRows.map((row, index) => {
            const values = typeof row === "object" && row !== null
              ? row as Record<string, unknown> : {};
            const criterion = findSieveEvaluationCriterion(
              evaluation,
              values.sieveSize,
            );
            const unit = textValue(criterion?.unit, "");
            const remark = criterion?.withinLimits === true
              ? "PASS"
              : criterion?.withinLimits === false
                ? "FAIL"
                : criterion
                  ? "PENDING"
                  : "—";
            return (
              <tr key={index}>
                {tableColumns.map((column) => {
                  const value = column.key === "no"
                    ? index + 1
                    : column.key === "size"
                      ? rawTextValue(values.sieveSize)
                      : column.key === "returned"
                        ? textValue(values.amountReturned)
                        : column.key === "retained"
                          ? calculateRetainedPercentage(
                              values.amountReturned,
                              sampleWeight,
                            ) || "—"
                          : column.key === "passing"
                            ? textValue(values.passingAmount)
                            : column.key === "percentage"
                              ? textValue(values.passingPercentage)
                              : column.key === "lower"
                                ? criterion?.minimum == null
                                  ? "—"
                                  : `${textValue(criterion.minimum)}${unit ? ` ${unit}` : ""}`
                                : column.key === "upper"
                                  ? criterion?.maximum == null
                                    ? "—"
                                    : `${textValue(criterion.maximum)}${unit ? ` ${unit}` : ""}`
                                  : column.key === "remarks"
                                    ? remark
                                    : "—";
                  const resultClass = column.key === "remarks"
                    ? remark === "PASS"
                      ? "font-semibold text-green-700"
                      : remark === "FAIL"
                        ? "font-semibold text-red-700"
                        : ""
                    : "";
                  return <td key={column.key} className={resultClass}>{value}</td>;
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const readyMixReportStandards = [
  { mixType: "45 N/mm2", sevenDay: 31, twentyEightDay: 45 },
  { mixType: "35 N/mm2", sevenDay: 21, twentyEightDay: 35 },
  { mixType: "SCREED N/mm2", sevenDay: 25, twentyEightDay: 30 },
  { mixType: "20 N/mm2", sevenDay: 19, twentyEightDay: 25 },
] as const;

function ReadyMixStrengthStandardsTable() {
  return (
    <div className="report-standard-block ready-mix-standard-block">
      <p className="report-centered-title">Standard Required Strength:</p>
      <table className="report-table report-strength-table">
        <thead>
          <tr>
            <th>MIX TYPE</th>
            <th>7 DAYS</th>
            <th>28 DAYS</th>
          </tr>
        </thead>
        <tbody>
          {readyMixReportStandards.map((standard) => (
            <tr key={standard.mixType}>
              <td>{standard.mixType}</td>
              <td>{formatNumber(standard.sevenDay)} N/mm2</td>
              <td>{formatNumber(standard.twentyEightDay)} N/mm2</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StrengthStandardsTable({
  record,
  standards,
  evaluation,
}: {
  record: QcRecord;
  standards: StrengthStandard[];
  evaluation: ValueMap | null;
}) {
  const isBlocks = record.testType === "Blocks";
  const configuredStandards = standards
    .filter((standard) => strengthStandardMatchesRecord(standard, record))
    .sort((left, right) => left.id - right.id);
  const rows = configuredStandards.length
    ? configuredStandards
    : evaluation?.requiredStrength != null
      ? [{
          id: -1,
          testType: record.testType,
          material: record.material,
          blockType: typeof evaluation.blockType === "string" ? evaluation.blockType : null,
          blockSize: typeof evaluation.blockSize === "string" ? evaluation.blockSize : null,
          cubeAge: null,
          kerbClass: null,
          kerbMarking: null,
          bsStandard: textValue(evaluation.bsStandard),
          requiredStrength: Number(evaluation.requiredStrength),
          minimumIndividualStrength: null,
          waterAbsorptionLimit: null,
          dammamAverageStrength: null,
          dammamMinimumStrength: null,
          strengthUnit: textValue(evaluation.strengthUnit, "N/mm²"),
        } satisfies StrengthStandard]
      : [];

  if (!rows.length) return null;

  return (
    <div className={`report-standard-block ${
      record.testType === "Ready Mix" ? "ready-mix-standard-block" : ""
    } paving-report-standard-block`}>
      <p className="report-centered-title">Standard Required Strength:</p>
      <table className="report-table report-strength-table paving-report-standard-table">
        <thead>
          <tr>
            {isBlocks ? (
              <>
                <th>BLOCK TYPE</th>
                <th>BLOCK SIZE</th>
                <th>BS STANDARD</th>
                <th>REQUIRED STRENGTH</th>
              </>
            ) : (
              <>
                <th>MIX TYPE</th>
                <th>7 DAYS</th>
                <th>28 DAYS</th>
                {record.testType !== "Ready Mix" && <th>BS STANDARD</th>}
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((standard) => (
            <tr key={standard.id}>
              {isBlocks ? (
                <>
                  <td>{textValue(standard.blockType, standard.material)}</td>
                  <td>{textValue(standard.blockSize)}</td>
                  <td>{textValue(standard.bsStandard)}</td>
                  <td>
                    {formatNumber(standard.requiredStrength)} {standard.strengthUnit}
                  </td>
                </>
              ) : (
                <>
                  <td>{standard.material}</td>
                  <td>
                    {formatNumber(standard.requiredStrength * 0.7)} {standard.strengthUnit}
                  </td>
                  <td>
                    {formatNumber(standard.requiredStrength)} {standard.strengthUnit}
                  </td>
                  {record.testType !== "Ready Mix" && <td>{standard.bsStandard}</td>}
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ReadyMixComplianceBlock({
  record,
  standards,
  selectedStandard,
  reportedStrength,
}: {
  record: QcRecord;
  standards: StrengthStandard[];
  selectedStandard?: StrengthStandard;
  reportedStrength: number | null;
}) {
  const evaluation = objectValue(record.details.strengthEvaluation);
  const configuredStandard = standards
    .filter(
      (standard) =>
        standard.testType === "Ready Mix" &&
        matchesText(standard.material, record.material),
    )
    .sort((left, right) => left.id - right.id)[0];
  const activeStandard = selectedStandard ?? configuredStandard;
  const status = textValue(evaluation?.status, record.status);
  const statusClass = status.toLocaleLowerCase();
  const complianceLabel = statusClass === "passed"
    ? "Compliant with BS"
    : statusClass === "failed"
      ? "Not Compliant with BS"
      : status;
  const standardReference = textValue(
    activeStandard?.bsStandard ?? evaluation?.bsStandard,
    "Not configured",
  );
  const requiredStrength =
    activeStandard?.requiredStrength ?? numericValue(evaluation?.requiredStrength) ?? null;
  const strengthUnit = activeStandard?.strengthUnit ??
    textValue(evaluation?.strengthUnit, "N/mm²");
  const storedReason = textValue(evaluation?.reason, "");
  const reason =
    (configuredStandard && /no matching standard/i.test(storedReason)
      ? "A matching standard is configured; complete specimen load and dimensions are required to confirm compliance."
      : storedReason) ||
    (status === "Passed"
      ? "The 28-day average result meets the configured minimum strength."
      : status === "Failed"
        ? "The 28-day average result does not meet the configured minimum strength."
        : "The result cannot be confirmed against a configured BS strength standard.");

  return (
    <section className="report-compliance-block ready-mix-compliance-block">
      <SectionHeading>28–29 Days Compliance with BS</SectionHeading>
      <div className="report-compliance-grid">
        <div>
          <span>BS Standard</span>
          <strong>{standardReference}</strong>
        </div>
        <div>
          <span>Required Minimum</span>
          <strong>
            {requiredStrength === null
              ? "Not configured"
              : `${formatNumber(requiredStrength)} ${strengthUnit}`}
          </strong>
        </div>
        <div>
          <span>28-Day Average Strength</span>
          <strong>
            {reportedStrength === null
              ? "—"
                    : `${formatNumber(reportedStrength)} ${strengthUnit}`}
          </strong>
        </div>
        <div>
          <span>Compliance</span>
          <strong className={`report-compliance-status ${statusClass}`}>{complianceLabel}</strong>
        </div>
      </div>
      <p className="report-compliance-reason">{reason}</p>
    </section>
  );
}

function ReportField({ label, value }: { label: string; value: string }) {
  const normalizedLabel = label.replace(/:+$/, "");
  return (
    <div className="report-field">
      <span>{normalizedLabel}:</span>
      <strong>{value}</strong>
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h3 className="report-section-heading">{children}</h3>;
}

function ReportFields({
  entries,
  className = "",
}: {
  entries: ReadonlyArray<readonly [string, string]>;
  className?: string;
}) {
  return (
    <div className={`report-fields ${className}`}>
      {entries.map(([label, value]) => (
        <ReportField key={label} label={label} value={value} />
      ))}
    </div>
  );
}

function firstPresentValue(values: unknown[]) {
  return values.find((value) => value !== undefined && value !== null && String(value).trim() !== "");
}

function readyMixCubeSize(details: DetailMap, rows: unknown[]) {
  const specimenRows = rows
    .filter((row) => typeof row === "object" && row !== null)
    .map((row) => row as ValueMap);
  const length = firstPresentValue([
    details.length,
    ...specimenRows.map((row) => row.length),
  ]);
  const width = firstPresentValue([
    details.width,
    ...specimenRows.map((row) => row.width),
  ]);
  const height = firstPresentValue([
    details.height,
    ...specimenRows.map((row) => row.height),
  ]);
  if (length !== undefined && width !== undefined && height !== undefined) {
    return `${textValue(length)} × ${textValue(width)} × ${textValue(height)}`;
  }
  return detailValue(details, ["cubeSize", "cubeDimensions"], "-");
}

function readyMixWeightInGrams(value: unknown) {
  const weight = numericValue(value);
  if (weight === null) return textValue(value);
  return formatNumber(weight < 100 ? weight * 1_000 : weight);
}

function readyMixTestingDate(row: unknown, sampleDate: string) {
  const values = typeof row === "object" && row !== null
    ? row as ValueMap
    : {};
  const explicitDate = firstPresentValue([
    values.testingDate,
    values.testDate,
    values.testedDate,
    values.date,
  ]);
  if (explicitDate !== undefined) {
    return formatReportDate(String(explicitDate));
  }
  const age = cubeRowAge(row);
  return age === null
    ? "-"
    : formatReportDate(addDaysToDate(sampleDate, age));
}

function ReadyMixReport({
  record,
  standards,
  selectedStandard,
  layout,
}: {
  record: QcRecord;
  standards: StrengthStandard[];
  selectedStandard?: StrengthStandard;
  layout?: ReportLayout;
}) {
  const details = record.details;
  const testRows = Array.isArray(details.testRows)
    ? details.testRows
    : [
        {
          testAge: detailValue(details, ["cubeAge", "age"]),
          length: detailValue(details, ["length"]),
          width: detailValue(details, ["width"]),
          height: detailValue(details, ["height"]),
          dryWeight: detailValue(details, ["dryWeight"]),
          wetWeight: detailValue(details, ["wetWeight"]),
          density: detailValue(details, ["density", "densityKgM3"]),
          load: detailRawValue(details, ["load"], ""),
          strength: detailValue(details, ["strength", "compressiveStrength"]),
          waterAbsorption: detailValue(details, ["waterAbsorption", "absorption"]),
        },
      ];
  const orderedTestRows = sortCubeRowsByAge(filterRowsWithLoad(testRows));
  const average28DayStrength = averageStrengthForAgeRange(orderedTestRows, 28, 29);
  const resultColumnDefaults: LayoutColumn[] = [
    { key: "testingDate", label: "Testing Date", visible: true, order: 0, width: 18 },
    { key: "age", label: "Cube Age", visible: true, order: 1, width: 12 },
    { key: "weight", label: "Cube Weight (g)", visible: true, order: 2, width: 16 },
    { key: "load", label: "Load (kN)", visible: true, order: 3, width: 16 },
    { key: "strength", label: "Strength (N/mm²)", visible: true, order: 4, width: 19 },
    { key: "absorption", label: "Water Absorption (%)", visible: true, order: 5, width: 19 },
  ];
  const savedResultColumns = layout?.config.columns.readyMixResults;
  const resultColumns = (savedResultColumns === undefined
    ? resultColumnDefaults
    : savedResultColumns
        .filter((saved) => resultColumnDefaults.some((fallback) => fallback.key === saved.key))
        .map((saved) => ({
          ...resultColumnDefaults.find((fallback) => fallback.key === saved.key)!,
          ...saved,
        })))
    .filter((column) => column.visible)
    .sort((left, right) => left.order - right.order);
  const customerName = detailRawValue(details, ["customerName", "customer"], "-");
  const customerLocation = detailRawValue(
    details,
    ["customerLocation", "location"],
    record.location,
  );
  const projectName = detailRawValue(details, ["projectName"], "");
  const otherDetails = detailRawValue(details, ["otherDetails"], "");
  const castedBy = detailRawValue(details, ["castedBy", "castBy", "castedByName"], "");
  const sampleNumber = detailRawValue(
    details,
    ["sampleNumber", "sampleNo", "sampleReference", "referenceNumber"],
    "-",
  );
  const cubeSize = readyMixCubeSize(details, orderedTestRows);
  const visibleCustomerEntries: Array<readonly [string, string]> = [
    ...(customerName ? [["Customer Name", customerName] as const] : []),
    ...(customerLocation ? [["Customer Location", customerLocation] as const] : []),
    ...(record.material ? [["Mix Type", record.material] as const] : []),
    ...(projectName ? [["Project Name", projectName] as const] : []),
    ...(otherDetails ? [["Other Details", otherDetails] as const] : []),
  ];

  return (
    <div className="ready-mix-report">
      <div className="ready-mix-overview">
        <section className="report-ready-mix-info">
          <SectionHeading>Customer and Mix Details</SectionHeading>
          <ReportFields
            entries={visibleCustomerEntries}
          />
        </section>
        <ReadyMixAverageStrengthTable rows={orderedTestRows} />
      </div>

      <div className="ready-mix-test-summary">
        <section className="report-ready-mix-test-details">
          <SectionHeading>Test Details</SectionHeading>
          <ReportFields
            entries={[
              ["Casting Date", formatReportDate(record.sampleDate)],
              ...(castedBy ? [["Casted By", castedBy] as const] : []),
              ["Cube Size (L × W × H, mm)", cubeSize],
              ["Sample No.", sampleNumber],
            ]}
          />
        </section>
        <ReadyMixComplianceBlock
          record={record}
          standards={standards}
          selectedStandard={selectedStandard}
          reportedStrength={average28DayStrength}
        />
      </div>

      <section className="report-ready-mix-measures">
        <SectionHeading>Test Result</SectionHeading>
        <div className="report-measure-grid">
          <ReportField label="Slump Test (mm)" value={detailValue(details, ["slump", "slumpTest"])} />
          <ReportField label="Temperature" value={detailValue(details, ["temperature"])} />
          <ReportField label="Compaction Type" value={detailValue(details, ["compactionType", "compaction"])} />
        </div>
      </section>

      <ReportRemarks record={record} layout={layout} inFlow />

      <section className="report-ready-mix-results">
        <table className="report-table report-results-table">
          <thead>
            <tr>{resultColumns.map((column) => <th key={column.key} style={{ width: `${column.width}%` }}>{column.label}</th>)}</tr>
          </thead>
          <tbody>
            {orderedTestRows.map((row, index) => {
              const values = typeof row === "object" && row !== null
                ? row as Record<string, unknown>
                : {};
              const weight = firstPresentValue([values.dryWeight, values.wetWeight]);
              const strength = cubeRowStrength(row);
              const displayValues: ValueMap = {
                ...values,
                testAge: firstPresentValue([
                  values.testAge,
                  values.sampleAge,
                  values.cubeAge,
                  values.age,
                  details.cubeAge,
                  details.age,
                ]),
                weight,
                load: firstPresentValue([values.load]),
                calculatedStrength: strength,
                dryWeight: values.dryWeight,
                wetWeight: values.wetWeight,
              };
              return (
                <tr key={index}>{resultColumns.map((column) => {
                  const value = column.key === "testingDate"
                    ? readyMixTestingDate(row, record.sampleDate)
                    : column.key === "age"
                      ? textValue(displayValues.testAge)
                    : column.key === "weight"
                      ? readyMixWeightInGrams(displayValues.weight)
                      : column.key === "strength"
                        ? strength === null ? "-" : formatNumber(strength)
                        : column.key === "absorption"
                          ? calculatedWaterAbsorption(displayValues)
                          : textValue(displayValues[column.key]);
                  return <td key={column.key}>{value}</td>;
                })}</tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <ReadyMixStrengthStandardsTable />
    </div>
  );
}

function RecordContextFields({
  record,
  includeSampleDate = true,
}: {
  record: QcRecord;
  includeSampleDate?: boolean;
}) {
  const entries = [
    ["Location", record.location],
    ["Material", record.material],
    ["Tested By", record.testedBy],
  ] as [string, string][];
  if (includeSampleDate) {
    entries.unshift(["Sample Date", formatReportDate(record.sampleDate)]);
  }
  return (
    <ReportFields entries={entries} />
  );
}

function BlocksReport({
  record,
  standards,
  layout,
}: {
  record: QcRecord;
  standards: StrengthStandard[];
  layout?: ReportLayout;
}) {
  const details = record.details;
  const evaluation = objectValue(details.strengthEvaluation);
  const savedTestRows = Array.isArray(details.testRows) ? details.testRows : [];
  const testRows = filterRowsWithLoad(savedTestRows);
  const blockAge = blockAgeFromRecord(details, testRows);
  const enteredTestingDate =
    typeof details.testingDate === "string" ? details.testingDate : null;
  const testingDate =
    (blockAge === null ? null : addDaysToDate(record.sampleDate, blockAge)) ||
    enteredTestingDate;
  const configuredStandard = selectedStrengthStandardForRecord(standards, record);
  const useDammamBasis = isDammamLocation(record.location);
  const dammamSandwich = useDammamBasis && isSandwichBlockType(details.blockType);
  const useDammamNetBasis = useDammamBasis && !dammamSandwich;
  const requiredStrength = useDammamBasis
    ? numericValue(evaluation?.requiredStrength) ??
      configuredStandard?.dammamAverageStrength ??
      null
    : configuredStandard?.requiredStrength ??
      numericValue(evaluation?.requiredStrength);
  const minimumRequiredStrength = useDammamNetBasis
    ? numericValue(evaluation?.minimumRequiredStrength) ??
      configuredStandard?.dammamMinimumStrength ??
      null
    : null;
  const compliance = textValue(evaluation?.status, record.status);
  const complianceLabel = compliance === "Passed"
    ? "PASS"
    : compliance === "Failed"
      ? "NOT PASS"
      : "REVIEW";
  const canPositionRemarks =
    hasPositionedSection(layout, "context") &&
    hasPositionedSection(layout, "results") &&
    hasPositionedSection(layout, "remarks");
  return (
    <>
      {layoutSectionVisible(layout, "context") && (
        <>
          <LayoutElements layout={layout} sectionKey="context" placement="before" />
          <section className="block-compression-report report-layout-section" style={layoutSectionStyle(layout, "context", {
            inFlow: !canPositionRemarks,
          })}>
            <div className="block-report-section-heading">
              <div><span>Test details</span></div>
              <strong className="block-report-air-dry-note">
                {useDammamNetBasis
                  ? "Dammam: Net Strength compliance basis"
                  : dammamSandwich
                    ? "Dammam Sandwich: Air-dry Strength compliance basis"
                    : "Air Dry strength compliance basis"}
              </strong>
            </div>
            <div className="block-report-fields">
              <ReportFields
                entries={[
                  ["BLOCK SIZE:", detailValue(details, ["blockSize"])],
                  ["CASTING DATE:", formatReportDate(record.sampleDate)],
                  ["TESTING DATE:", formatReportDate(testingDate)],
                  [
                    dammamSandwich
                      ? "MIN. AVG. AIR-DRY STRENGTH (N/mm²):"
                      : useDammamBasis
                        ? "MIN. AVG. NET STRENGTH (N/mm²):"
                        : "Sp. Strength (N/mm²):",
                    requiredStrength === null ? "-" : formatNumber(requiredStrength),
                  ],
                  [useDammamBasis ? "Plant:" : "Factory:", record.location],
                  ["STRENGTH BASIS:", useDammamNetBasis ? "NET STRENGTH" : "AIR DRY STRENGTH"],
                ]}
              />
              <ReportFields
                entries={[
                  ["BLOCK AGE IN DAYS:", blockAge === null ? "-" : formatNumber(blockAge)],
                  ["MACHINE TYPE:", detailValue(details, ["machine"])],
                  ["SAMPLE TYPE:", detailValue(details, ["sampleType"])],
                  ["METHOD OF CONDITIONING:", detailValue(details, ["conditioningMethod"])],
                  ["METHOD OF PREPARATION:", detailValue(details, ["preparationMethod"])],
                  ["SHAPE FACTOR:", formatShapeFactor(details.shapeFactor)],
                  ["BLOCK TYPE:", detailValue(details, ["blockType"], record.material)],
                  ...(useDammamNetBasis
                    ? [[
                        "MIN. SPECIMEN NET STRENGTH (N/mm²):",
                        minimumRequiredStrength === null
                          ? "-"
                          : formatNumber(minimumRequiredStrength),
                      ] as [string, string]]
                    : []),
                ]}
              />
            </div>
          </section>
          <LayoutElements layout={layout} sectionKey="context" placement="after" />
        </>
      )}
      <ReportRemarks
        record={record}
        layout={layout}
        inFlow={!canPositionRemarks}
      />
      {layoutSectionVisible(layout, "results") && (
        <>
          <LayoutElements layout={layout} sectionKey="results" placement="before" />
          <section className="block-compression-report report-layout-section" style={layoutSectionStyle(layout, "results", {
            inFlow: !canPositionRemarks,
          })}>
            {testRows.length > 0 && (
              <BlockCompressionRowsTable
                rows={testRows}
                hideWaterStrength={useDammamNetBasis}
                dammamSandwich={dammamSandwich}
                layout={layout}
                blockDetails={details}
              />
            )}
            <div className={`block-report-result ${compliance.toLocaleLowerCase()}`}>
              <span>Overall result</span>
              <strong>{complianceLabel}</strong>
            </div>
          </section>
          <LayoutElements layout={layout} sectionKey="results" placement="after" />
        </>
      )}
    </>
  );
}

function SieveReport({
  record,
  layout,
}: {
  record: QcRecord;
  layout?: ReportLayout;
}) {
  const details = record.details;
  const sieveRows = Array.isArray(details.sieveRows) ? details.sieveRows : [];
  const evaluation = objectValue(details.sieveEvaluation);
  const isAggregate = record.testType === "Aggregate Sieve";
  const sieveSampleWeight = calculateSieveSampleWeight(
    sieveRows.map((row) => {
      const values = typeof row === "object" && row !== null
        ? row as Record<string, unknown>
        : {};
      return { amountReturned: String(values.amountReturned ?? "") };
    }),
  );
  const siltContent = calculateSiltContent(
    details.siltBefore,
    details.siltAfter,
  );
  const siltStatus = evaluateSiltContent(siltContent);
  const chlorideContent = calculateChlorideContent(
    details.silverNitrateContent,
    details.firstChlorideTitrationPoint,
    details.secondChlorideTitrationPoint,
  );
  const chlorideStatus = evaluateContentAgainstLimit(
    chlorideContent,
    AGGREGATE_CHLORIDE_LIMIT_PERCENT,
  );
  const sulphateContent = calculateSulphateContent(
    details.crucibleWeight,
    details.crucibleAshWeight,
  );
  const sulphateStatus = evaluateContentAgainstLimit(
    sulphateContent,
    AGGREGATE_SULPHATE_LIMIT_PERCENT,
  );
  const chemicalResults = [
    {
      label: "Silt Content",
      result: siltContent === null ? "—" : `${siltContent.toFixed(2)}%`,
      standard: `< ${SIEVE_SILT_LIMIT_PERCENT}%`,
      status: siltStatus,
    },
    {
      label: "Chloride Content",
      result: chlorideContent === null ? "—" : `${chlorideContent.toFixed(3)}%`,
      standard: `≤ ${AGGREGATE_CHLORIDE_LIMIT_PERCENT.toFixed(2)}%`,
      status: chlorideStatus,
    },
    {
      label: "Sulphate Content",
      result: sulphateContent === null ? "—" : `${sulphateContent.toFixed(2)}%`,
      standard: `≤ ${AGGREGATE_SULPHATE_LIMIT_PERCENT.toFixed(2)}%`,
      status: sulphateStatus,
    },
  ] as const;
  const measurementEntries = [
    ["Supplier", detailValue(details, ["supplier"])],
    [
      "Material Condition",
      detailValue(details, ["materialCondition", "condition"]),
    ],
    ...(isAggregate
      ? [[
          "Silt Content",
          siltContent === null ? "-" : `${siltContent.toFixed(2)}%`,
        ] as const]
      : []),
  ] as const;
  const sampleAge = numericValue(details.sampleAge);
  const testingDate =
    sampleAge !== null && sampleAge > 0
      ? addDaysToDate(record.sampleDate, sampleAge)
      : stringValue(details.testingDate);

  return (
    <>
      <div className="report-two-column">
        <section>
          <SectionHeading>Sample Details</SectionHeading>
          <ReportFields
            entries={[
              ["Sampling Date", formatReportDate(record.sampleDate)],
              ["Age (days)", sampleAge === null ? "-" : formatNumber(sampleAge)],
              [
                "Testing Date",
                testingDate ? formatReportDate(testingDate) : "-",
              ],
              ["Factory", record.location],
              ["Material Type", record.material],
            ]}
          />
        </section>
        <section className="report-summary">
          <SectionHeading>{isAggregate ? "Aggregate Details" : "Sand Details"}</SectionHeading>
          <ReportFields entries={measurementEntries} />
        </section>
      </div>
      <ReportRemarks record={record} layout={layout} inFlow />
      <SieveRowsTable
        rows={sieveRows}
        layout={layout}
        evaluation={evaluation}
        sampleWeight={sieveSampleWeight}
      />
      <section className="report-summary mt-3">
        <SectionHeading>Chemical Test Results</SectionHeading>
        <table className="report-table">
          <thead>
            <tr>
              <th>Test</th>
              <th>Result</th>
              <th>Standard</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {chemicalResults.map((result) => (
              <tr key={result.label}>
                <td>{result.label}</td>
                <td>{result.result}</td>
                <td>{result.standard}</td>
                <td
                  className={
                    result.status === "Pass"
                      ? "font-semibold text-green-700"
                      : result.status === "Fail"
                        ? "font-semibold text-red-700"
                        : "text-muted-foreground"
                  }
                >
                  {result.status}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}

function PavingBlocksReport({ record, standards, layout }: {
  record: QcRecord;
  standards: StrengthStandard[];
  layout?: ReportLayout;
}) {
  const details = record.details;
  const evaluation = objectValue(details.strengthEvaluation);
  const rows = filterRowsWithLoad(
    Array.isArray(details.testRows) ? details.testRows : [],
  );
  const matchingStandard = standards
    .filter((standard) => strengthStandardMatchesRecord(standard, record))
    .sort((left, right) => left.id - right.id)[0];
  const requiredStrength =
    numericValue(evaluation?.requiredStrength) ??
    numericValue(matchingStandard?.requiredStrength);
  const strengthUnit = textValue(
    evaluation?.strengthUnit,
    matchingStandard?.strengthUnit || "N/mm²",
  );
  const status = textValue(evaluation?.status, record.status);
  const castingDate = record.sampleDate;
  const legacyRowAge = rows
    .map((row) => (
      typeof row === "object" && row !== null
        ? (row as Record<string, unknown>).sampleAge
        : undefined
    ))
    .find((value) => numericValue(value) !== null && numericValue(value)! > 0);
  const configuredAge = numericValue(details.blockAge) ?? numericValue(legacyRowAge);
  const enteredTestingDate = textValue(details.testingDate);
  const castingTimestamp = Date.parse(castingDate);
  const testingTimestamp = Date.parse(enteredTestingDate);
  const dateAge =
    Number.isFinite(castingTimestamp) && Number.isFinite(testingTimestamp)
      ? Math.max(
          0,
          Math.floor((testingTimestamp - castingTimestamp) / 86_400_000),
        )
      : null;
  const blockAge = configuredAge !== null && configuredAge > 0
    ? configuredAge
    : dateAge;
  const testingDate =
    (blockAge === null ? null : addDaysToDate(castingDate, blockAge)) ||
    enteredTestingDate;
  return (
    <div className="paving-block-report">
      <div className="block-report-section-heading">
        <div>
          <span>Customer and Mix Details</span>
        </div>
      </div>
      <div className="block-report-fields">
        <ReportFields
          entries={[
            ["Block Size:", detailValue(details, ["pavingBlockSize", "blockSize"])],
            ["Casting Date:", formatReportDate(castingDate)],
            ["Testing Date:", testingDate ? formatReportDate(testingDate) : "—"],
            [
              "SP. Strength:",
              requiredStrength === null
                ? "—"
                : `${formatNumber(requiredStrength)} ${strengthUnit}`,
            ],
            ["Factory:", record.location],
          ]}
        />
        <ReportFields
          entries={[
            [
              "Block Age:",
              blockAge === null ? "—" : `${formatNumber(blockAge)} DAYS`,
            ],
            ["Machine Type:", detailValue(details, ["machineType", "machine"])],
            ["Sample Type:", detailValue(details, ["sampleType"])],
            ["Correction Factor:", detailValue(details, ["correctionFactor"])],
            [
              "Paving Block Type:",
              detailValue(details, ["blockType"], record.material),
            ],
          ]}
        />
      </div>
      <ReportRemarks record={record} layout={layout} inFlow />
      {rows.length > 0 && (
        <>
          <SpecimenRowsTable
            rows={rows}
            status={status}
            layout={layout}
          />
          <PavingStrengthStatistics rows={rows} />
        </>
      )}
    </div>
  );
}

function KerbstoneResultsSummary({
  record,
  standard,
}: {
  record: QcRecord;
  standard?: StrengthStandard;
}) {
  const rows = Array.isArray(record.details.testRows)
    ? record.details.testRows
    : [];
  const measuredStrengths = rows.map((rawRow) => {
    const row = objectValue(rawRow) ?? {};
    const value = calculateKerbBendingStrength(record.details.kerbType, {
      failureLoad: String(row.failureLoad ?? row.load ?? ""),
      spanLength: String(row.spanLength ?? ""),
    });
    return value ? Number(value) : null;
  });
  const completeStrengths = measuredStrengths.filter(
    (value): value is number => value !== null && Number.isFinite(value),
  );
  const average = completeStrengths.length
    ? completeStrengths.reduce((sum, value) => sum + value, 0) / completeStrengths.length
    : null;
  const minimum = completeStrengths.length ? Math.min(...completeStrengths) : null;
  const requiredAverage = numericValue(standard?.requiredStrength);
  const requiredIndividual = numericValue(standard?.minimumIndividualStrength);
  const strengthStatus =
    average === null ||
    completeStrengths.length !== rows.length ||
    requiredAverage === null ||
    requiredIndividual === null
      ? "Review"
      : average < requiredAverage || minimum! < requiredIndividual
        ? "Fail"
        : "Pass";
  const absorptionResults = rows
    .map((rawRow) => {
      const row = objectValue(rawRow) ?? {};
      return evaluateKerbWaterAbsorption(
        row.weight,
        row.wetWeight,
        standard?.waterAbsorptionLimit,
      );
    })
    .filter((result): result is NonNullable<typeof result> => result !== null);
  const absorptionStatus = absorptionResults.length === 0
    ? "Skipped"
    : absorptionResults.some((result) => result.status === "Fail")
      ? "Fail"
      : absorptionResults.every((result) => result.status === "Pass")
        ? "Pass"
        : "Review";
  const absorptionValues = rows
    .map((rawRow) => {
      const row = objectValue(rawRow) ?? {};
      const dryWeight = numericValue(row.weight);
      const wetWeight = numericValue(row.wetWeight);
      return dryWeight !== null && wetWeight !== null && dryWeight > 0
        ? ((wetWeight - dryWeight) / dryWeight) * 100
        : null;
    })
    .filter((value): value is number => value !== null);
  const averageAbsorption = absorptionValues.length
    ? absorptionValues.reduce((sum, value) => sum + value, 0) / absorptionValues.length
    : null;
  const summaryRows = [
    {
      test: "Characteristic bending strength",
      result: average === null ? "—" : `${formatKerbResult(average)} MPa`,
      requirement: requiredAverage === null ? "Not configured" : `≥ ${formatKerbResult(requiredAverage)} MPa`,
      status: strengthStatus,
    },
    {
      test: "Minimum individual bending strength",
      result: minimum === null ? "—" : `${formatKerbResult(minimum)} MPa`,
      requirement: requiredIndividual === null ? "Not configured" : `≥ ${formatKerbResult(requiredIndividual)} MPa`,
      status: strengthStatus,
    },
    {
      test: "Water absorption",
      result: averageAbsorption !== null
        ? `${formatKerbResult(averageAbsorption)}%`
        : "Not entered",
      requirement: standard?.waterAbsorptionLimit == null
        ? "Not configured"
        : `< ${standard.waterAbsorptionLimit}%`,
      status: absorptionStatus,
    },
  ];
  return (
    <section className="kerb-results-summary">
      <SectionHeading>Test Results Summary</SectionHeading>
      <table className="report-table">
        <thead>
          <tr><th>Test</th><th>Result</th><th>Standard</th><th>Outcome</th></tr>
        </thead>
        <tbody>
          {summaryRows.map((row) => (
            <tr key={row.test}>
              <td>{row.test}</td>
              <td>{row.result}</td>
              <td>{row.requirement}</td>
              <td className={`report-compliance-status ${row.status.toLocaleLowerCase()}`}>
                {row.status.toLocaleUpperCase()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function ConfiguredDetailsReport({
  record,
  tableKey,
  layout,
  strengthStandard,
  includeRemarks = true,
}: {
  record: QcRecord;
  tableKey: string;
  layout?: ReportLayout;
  strengthStandard?: StrengthStandard;
  includeRemarks?: boolean;
}) {
  const defaults = REPORT_LAYOUT_FIELD_GROUPS[record.testType]?.[tableKey] ?? [];
  const configured = layout?.config.columns[tableKey];
  const configuredWithNewPrecastFields =
    (record.testType === "Precast" || record.testType === "Kerb Stone") && configured
      ? [
          ...configured,
          ...defaults
            .filter((field) => !configured.some((column) => column.key === field.key))
            .map((field, index) => ({
              ...field,
              visible: true,
              order: Math.max(-1, ...configured.map((column) => column.order)) + index + 1,
            })),
        ]
      : configured;
  const columns = (configuredWithNewPrecastFields === undefined
    ? defaults.map((field, order) => ({ ...field, visible: true, order }))
    : configuredWithNewPrecastFields)
    .filter((field) => field.visible)
    .filter((field) => defaults.some((candidate) => candidate.key === field.key))
    .sort((a, b) => a.order - b.order);
  const standardFieldKeys = new Set([
    "kerbClass",
    "kerbMarking",
    "characteristicBendingStrength",
    "minimumIndividualStrength",
    "waterAbsorptionLimit",
  ]);
  const renderField = (field: (typeof columns)[number]) => {
    const detail = detailValue(record.details, [field.key]);
    const standardValue = record.testType === "Kerb Stone"
      ? field.key === "kerbType" ? strengthStandard?.blockType
        : field.key === "kerbClass" ? strengthStandard?.kerbClass
          : field.key === "kerbMarking" ? strengthStandard?.kerbMarking
            : field.key === "characteristicBendingStrength" ? strengthStandard?.requiredStrength
              : field.key === "minimumIndividualStrength" ? strengthStandard?.minimumIndividualStrength
                : field.key === "waterAbsorptionLimit"
                  ? strengthStandard?.waterAbsorptionLimit == null
                    ? undefined
                    : `< ${strengthStandard.waterAbsorptionLimit}%`
                  : undefined
      : undefined;
    const isKerb = record.testType === "Kerb Stone";
    const integerDetailKeys = new Set([
      "age",
      "kerbClass",
      "spanLength",
      "length",
      "width",
      "height",
      "batterDepth",
      "batterAngle",
    ]);
    const isDateField = field.key === "sampleDate" || field.key === "testingDate";
    const kerbAge = isKerb ? numericValue(detailRawValue(record.details, ["age"], "")) : null;
    const rawValue = field.key === "sampleDate" ? record.sampleDate
      : isKerb && field.key === "testingDate"
        ? kerbAge === null ? "" : addDaysToDate(record.sampleDate, kerbAge)
      : field.key === "location" ? record.location
        : field.key === "material" ? record.material
          : field.key === "testedBy" ? record.testedBy
            : detail || standardValue == null ? detail : String(standardValue);
    const value = (isKerb || record.testType === "Precast") && isDateField
      ? formatKerbReportDate(String(rawValue || ""))
      : isKerb && integerDetailKeys.has(field.key) && numericValue(rawValue) !== null
        ? formatWholeNumber(rawValue)
        : rawValue;
    return (
      <ReportField
        key={field.key}
        label={field.label}
        value={isKerb ? rawTextValue(value) : textValue(value)}
      />
    );
  };
  const kerbDateFields = ["sampleDate", "testingDate"]
    .map((key) => columns.find((field) => field.key === key))
    .filter((field): field is (typeof columns)[number] => field !== undefined);
  const kerbDetails = record.testType === "Kerb Stone"
    ? columns.filter((field) =>
        !standardFieldKeys.has(field.key) &&
        field.key !== "sampleDate" &&
        field.key !== "testingDate")
    : columns;
  const kerbStandardDetails = columns.filter((field) => standardFieldKeys.has(field.key));
  const kerbSize = record.testType === "Kerb Stone"
    ? kerbDimensionsForType(record.details.kerbType)
    : null;
  const kerbSizeLabel = kerbSize
    ? `${kerbSize.length} × ${kerbSize.width} × ${kerbSize.height} mm`
    : "-";
  return <>
    {record.testType === "Kerb Stone" ? (
      <div className="kerb-details-layout">
        <section className="kerb-report-details">
          <SectionHeading>Test Details</SectionHeading>
          <div className="kerb-date-fields">{kerbDateFields.map(renderField)}</div>
          <div className="report-fields">
            {kerbDetails.map(renderField)}
            <ReportField label="Kerb Size" value={kerbSizeLabel} />
            <ReportField label="Test Conducted" value="Bending-load test" />
          </div>
        </section>
        <section className="kerb-report-standard">
          <SectionHeading>Applicable Standard</SectionHeading>
          <div className="report-fields">{kerbStandardDetails.map(renderField)}</div>
        </section>
      </div>
    ) : (
      <section>
        <SectionHeading>{record.testType} Details</SectionHeading>
        <div className="report-fields">{columns.map(renderField)}</div>
      </section>
    )}
    {record.testType === "Kerb Stone" && (
      <KerbstoneResultsSummary record={record} standard={strengthStandard} />
    )}
    {record.testType === "Kerb Stone" &&
      Array.isArray(record.details.testRows) &&
      record.details.testRows.length > 0 && (
        <section className="mt-4 kerbstone-specimen-section">
          <SectionHeading>Kerbstone Specimen Results</SectionHeading>
          <table className="report-table kerbstone-specimen-table">
              <thead>
                <tr>
                  {[
                    "No.",
                    "Length (mm)",
                    "Width (mm)",
                    "Height (mm)",
                    "Span Length (mm)",
                    "Failure Load (kN)",
                    "Bending Strength (MPa)",
                    "Strength Outcome",
                    "Water Absorption (%)",
                    "Absorption Result",
                  ].map((label) => (
                    <th
                      key={label}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {record.details.testRows.map((rawRow, index) => {
                  const row = objectValue(rawRow) ?? {};
                  const bendingStrength = calculateKerbBendingStrength(record.details.kerbType, {
                    failureLoad: String(row.failureLoad ?? row.load ?? ""),
                    spanLength: String(row.spanLength ?? ""),
                  });
                  const numericStrength = numericValue(bendingStrength);
                  const individualLimit = numericValue(strengthStandard?.minimumIndividualStrength);
                  const bendingOutcome = numericStrength === null || individualLimit === null
                    ? "Review"
                    : numericStrength >= individualLimit ? "Pass" : "Fail";
                  const absorption = evaluateKerbWaterAbsorption(
                    row.weight,
                    row.wetWeight,
                    strengthStandard?.waterAbsorptionLimit,
                  );
                  const values = [
                    formatWholeNumber(row.rowNo ?? index + 1),
                    formatWholeNumber(row.length),
                    formatWholeNumber(row.width),
                    formatWholeNumber(row.height),
                    formatWholeNumber(row.spanLength),
                    row.failureLoad ?? row.load,
                    bendingStrength ? `${bendingStrength} MPa` : "",
                    bendingOutcome,
                    absorption?.value ? `${absorption.value}%` : "",
                    absorption?.status ?? "",
                  ];
                  return (
                    <tr key={index}>
                      {values.map((value, columnIndex) => (
                        <td
                          key={columnIndex}
                        >
                          {rawTextValue(value, "")}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
          </table>
        </section>
      )}
    {includeRemarks && <ReportRemarks record={record} layout={layout} inFlow />}
  </>;
}

function PrecastReport({
  record,
  standards,
  layout,
}: {
  record: QcRecord;
  standards: StrengthStandard[];
  layout?: ReportLayout;
}) {
  const details = record.details;
  const matchingPrecastStandards = standards.filter(
    (standard) =>
      standard.testType === "Precast" &&
      standard.cubeAge !== null &&
      strengthStandardMatchesRecord(standard, record),
  );
  const rows = sortCubeRowsByAge(
    Array.isArray(details.testRows) ? details.testRows : [],
  );
  const columns = layoutColumns(layout, "precastResults", [
    { key: "age", label: "Cube Age (days)", visible: true, order: 0, width: 8 },
    { key: "testingDate", label: "Testing Date", visible: true, order: 1, width: 16 },
    { key: "cubeSize", label: "Cube Size (mm)", visible: true, order: 2, width: 14 },
    { key: "weight", label: "Weight (g)", visible: true, order: 3, width: 11 },
    { key: "density", label: "Density (kg/m³)", visible: true, order: 4, width: 14 },
    { key: "load", label: "Load (kN)", visible: true, order: 5, width: 14 },
    { key: "strength", label: "Compressive Strength (N/mm²)", visible: true, order: 6, width: 23 },
  ]);
  const cubeSize = detailValue(
    details,
    ["cubeSize"],
    "100*100*100",
  ).replace(/\*/g, " × ");
  const legacyAverageKeys: Record<number, string[]> = {
    1: ["averageStrength1Day", "avgStrength1Day", "day1AverageStrength"],
    7: ["averageStrength7Days", "avgStrength7Days", "day7AverageStrength"],
    28: ["averageStrength28Days", "avgStrength28Days", "day28AverageStrength"],
  };
  const averageStrengthRows = PRECAST_AGE_STRENGTH_CRITERIA.map((criterion) => {
    const summary = precastAgeStrengthSummary(rows, criterion.age);
    const legacyAverage = detailValue(details, legacyAverageKeys[criterion.age]);
    const legacyNumber = Number(legacyAverage);
    const average = summary.averageStrength ??
      (Number.isFinite(legacyNumber) ? legacyNumber : null);
    const configuredStandard = matchingPrecastStandards.find(
      (standard) => Number(standard.cubeAge) === criterion.age,
    );
    const minimumStrength =
      numericValue(configuredStandard?.requiredStrength) ??
      criterion.minimumStrength;
    return {
      age: criterion.age,
      minimumStrength,
      strengthUnit: configuredStandard?.strengthUnit ?? "N/mm²",
      average: average === null
        ? legacyAverage
        : formatNumber(average),
      outcome: average === null
        ? "Pending"
        : average >= minimumStrength
          ? "Pass"
          : "Fail",
    };
  });
  return (
    <>
      <div className="precast-overview">
        <ConfiguredDetailsReport
          record={record}
          layout={layout}
          tableKey="precastDetails"
          includeRemarks={false}
        />
        <div className="report-average-block precast-average-block">
          <p className="report-centered-title">Average Strength</p>
          <table className="report-table report-average-table precast-average-table">
            <thead>
              <tr>
                <th>Cube Age</th>
                <th>Average Strength (N/mm²)</th>
                <th>Required Strength</th>
                <th>Outcome</th>
              </tr>
            </thead>
            <tbody>
              {averageStrengthRows.map((row) => (
                <tr key={row.age}>
                  <td>{row.age} day{row.age === 1 ? "" : "s"}</td>
                  <td>{row.average}</td>
                  <td>{formatNumber(row.minimumStrength)} {row.strengthUnit}</td>
                  <td className={`report-compliance-status ${row.outcome.toLocaleLowerCase()}`}>
                    {row.outcome.toLocaleUpperCase()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <ReportRemarks record={record} layout={layout} inFlow />
      <section>
        <SectionHeading>Precast Compression Results</SectionHeading>
        {rows.length ? (
          <table className="report-table precast-compression-results">
            <thead>
              <tr>
                {columns.map((column) => (
                  <th key={column.key}>
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                const values = objectValue(row) ?? {};
                const rowAge =
                  values.testAge ?? values.sampleAge ?? values.cubeAge ?? values.age;
                const numericAge = cubeRowAge(row);
                const testingDate = numericAge === null
                  ? "-"
                  : formatKerbReportDate(
                      addDaysToDate(record.sampleDate, numericAge),
                    );
                const strength = cubeRowStrength(row);
                const hasSavedWeight =
                  values.weight !== undefined &&
                  values.weight !== null &&
                  values.weight !== "";
                const weight = hasSavedWeight ? values.weight : values.wetWeight;
                const weightUnit =
                  hasSavedWeight && details.cubeWeightUnit === "g" ? "g" : "kg";
                const density =
                  values.density ||
                  calculateCubeDensity(
                    detailValue(details, ["cubeSize"], "100*100*100"),
                    weight,
                    weightUnit,
                  );
                const densityNumber = Number(density);
                const cells: Record<string, string> = {
                  age: rowAge == null || rowAge === "" ? "-" : String(rowAge),
                  testingDate,
                  cubeSize,
                  weight: rawTextValue(cubeWeightInGrams(weight, weightUnit)),
                  density: Number.isFinite(densityNumber)
                    ? `${formatNumber(densityNumber)} kg/m³`
                    : "-",
                  load: values.load == null || values.load === "" ? "-" : String(values.load),
                  strength: strength === null ? "-" : formatNumber(strength),
                };
                return (
                  <tr key={index}>
                    {columns.map((column) => (
                      <td key={column.key}>{cells[column.key] ?? "-"}</td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p className="report-precast-empty">No specimen results entered.</p>
        )}
      </section>
    </>
  );
}

function WaterReport({ record, layout }: { record: QcRecord; layout?: ReportLayout }) {
  const details = record.details;
  const configured = layout?.config.columns.waterDetails;
  const waterFields = (configured === undefined ? REPORT_LAYOUT_FIELD_GROUPS.Water.waterDetails.map((field, order) => ({ ...field, visible: true, order })) : configured)
    .filter((field) => field.visible).sort((a, b) => a.order - b.order);
  return (
    <>
      <section>
        <SectionHeading>Water Quality Details</SectionHeading>
        <div className="report-fields">{waterFields.map((field) => <ReportField key={field.key} label={field.label} value={detailValue(details, [field.key, field.key === "sulphate" ? "sulfate" : field.key])} />)}</div>
      </section>
      <ReportRemarks record={record} layout={layout} inFlow />
    </>
  );
}

function FallbackReport({ record }: { record: QcRecord }) {
  const observations = REPORT_LAYOUT_FIELD_GROUPS[record.testType]?.genericContext ?? [
    { key: "observation1", label: "Observation 1", width: 50 },
    { key: "observation2", label: "Observation 2", width: 50 },
  ];
  return (
    <>
      <section>
        <SectionHeading>{record.testType} Details</SectionHeading>
        <RecordContextFields record={record} />
        <div className="report-fields">{observations.map((field) => <ReportField key={field.key} label={field.label} value={detailValue(record.details, [field.key])} />)}</div>
      </section>
      <ReportRemarks record={record} inFlow />
    </>
  );
}

function reportReferenceNumberFor(record: QcRecord) {
  return record.testType === "Ready Mix"
    ? detailValue(record.details, ["sampleNumber", "sampleNo", "sampleReference", "referenceNumber"], record.recordNo)
    : record.recordNo;
}

function defaultReportTitle(testType: QcRecord["testType"]) {
  return testType === "Ready Mix" ? "Readymix Cube Test Report"
    : testType === "Blocks" ? "Block Compression Test"
    : testType === "Paving Blocks" ? "Paving Block Test Report"
    : `${testType} Test Report`;
}

/**
 * Print-only document surface.  Keeping the document separate from the
 * route/toolbar also lets the layout editor mount the same data renderer.
 */
export function ReportDocument({ report, strengthStandards = [], sieveStandards = [], selectedStrengthStandardId, accordingTo: configuredAccordingTo, reportReferenceNumber: configuredReference, defaultTitle: configuredTitle, templateDesign, formulaPreview = false }: ReportDocumentProps) {
  const { record, companyName, companySubtitle } = report;
  const positionedTemplateDesign = templateDesign
    ? positionRemarksAboveResults(templateDesign, record.remarks, record.testType)
    : undefined;
  const layout = positionedTemplateDesign
    ? layoutWithTemplateDesign(report.layout, record, positionedTemplateDesign)
    : report.layout;
  const hasCompleteBlocksSections = ["context", "results", "remarks"].every((key) =>
    positionedTemplateDesign?.objects.some(
      (object) => object.type === "section" && object.sectionKey === key,
    ),
  );
  const blockFlowMode = record.testType === "Blocks" && !hasCompleteBlocksSections;
  const hasPositionedSections = !blockFlowMode &&
    (positionedTemplateDesign?.objects.some((object) => object.type === "section") ?? false);
  const page = positionedTemplateDesign?.page;
  const pageWidthMm = page
    ? page.orientation === "landscape" ? page.heightMm : page.widthMm
    : 210;
  const pageHeightMm = page
    ? page.orientation === "landscape" ? page.widthMm : page.heightMm
    : 297;
  const reportReferenceNumber = configuredReference ?? reportReferenceNumberFor(record);
  const defaultTitle = configuredTitle ?? defaultReportTitle(record.testType);
  const reportTitle = layout?.config.title.trim() || defaultTitle;
  const matchingStrengthStandards = strengthStandards
    .filter((standard) => strengthStandardMatchesRecord(standard, record))
    .sort((left, right) => left.id - right.id);
  const selectedStrengthStandard = matchingStrengthStandards.find((standard) =>
    String(standard.id) === String(selectedStrengthStandardId ?? ""),
  ) ?? matchingStrengthStandards[0];
  const matchingSieveStandard = sieveStandards
    .filter((standard) => standard.testType === record.testType && matchesText(standard.material, record.material))
    .sort((left, right) => (left.id ?? 0) - (right.id ?? 0))[0];
  const strengthEvaluation = objectValue(record.details.strengthEvaluation);
  const standardValue = firstPresentValue([
    selectedStrengthStandard?.bsStandard,
    strengthEvaluation?.bsStandard,
    matchingSieveStandard?.standardReference,
  ]);
  const configuredStandard = standardValue === undefined ? null : String(standardValue);
  const isSieveReport = record.testType === "Sand Sieve" || record.testType === "Aggregate Sieve";
  const automaticAccordingTo = record.testType === "Blocks"
    ? isDammamLocation(record.location)
      ? "ASTM C140/C140M:2020a"
      : "BS EN 771-3:2003 (BS EN 772-1:2011)"
    : isSieveReport
      ? "BS812:PART103:1985"
      : record.testType === "Paving Blocks"
        ? configuredStandard || "BS EN 1338:2003"
        : configuredStandard || (record.testType === "Ready Mix" ? "BS EN 12390-3:2009" : null);
  const accordingTo = configuredAccordingTo === undefined ? automaticAccordingTo : configuredAccordingTo;
  return <>
    {positionedTemplateDesign && <style data-testid="style-report-template-page">{`@page { size: ${pageWidthMm}mm ${pageHeightMm}mm; margin: 0; }`}</style>}
    <main
      className={`report-paper ${record.testType === "Ready Mix" ? "ready-mix-paper" : ""} ${positionedTemplateDesign ? "report-template-paper" : ""} ${hasPositionedSections ? "report-template-positioned" : ""}`}
      style={layout ? {
        fontFamily: layout.config.fontFamily,
        fontSize: `${Math.max(layout.config.fontSize, 13)}px`,
        color: layout.config.textColor,
        width: `${pageWidthMm}mm`,
        minHeight: `${pageHeightMm}mm`,
        padding: hasPositionedSections ? 0 : page
          ? `${page.marginTopMm}mm ${page.marginRightMm}mm ${page.marginBottomMm}mm ${page.marginLeftMm}mm`
          : `${layout.config.paperPadding}mm`,
        "--report-accent-color": layout.config.accentColor,
      } as CSSProperties : undefined}
    ><div className={`report-layout-content ${positionedTemplateDesign ? "report-layout-content-template" : ""} ${hasPositionedSections ? "report-layout-content-positioned" : ""} ${blockFlowMode ? "report-layout-content-flow" : ""}`}>
    {layoutSectionVisible(layout, "header") && <><LayoutElements layout={layout} sectionKey="header" placement="before" /><header className="report-header report-layout-section" style={layoutSectionStyle(layout, "header", { inFlow: blockFlowMode })}>
      <div className="report-company">{companySubtitle}</div><img src="/al-manaratain-logo.webp" alt="Al Manaratain Logo" className="report-logo" /><div className="report-title"><strong>{reportTitle}</strong><span>Ref: {reportReferenceNumber}</span></div>
    </header><LayoutElements layout={layout} sectionKey="header" placement="after" /></>}
    {layoutSectionVisible(layout, "standard") && <><LayoutElements layout={layout} sectionKey="standard" placement="before" /><p className="report-standard report-layout-section" style={layoutSectionStyle(layout, "standard", { inFlow: blockFlowMode })}>{accordingTo ? `ACCORDING TO ${accordingTo}` : "QUALITY CONTROL TEST REPORT"}</p><LayoutElements layout={layout} sectionKey="standard" placement="after" /></>}
    {record.testType === "Blocks" ? (
      <BlocksReport record={record} standards={strengthStandards} layout={layout} />
    ) : layoutSectionVisible(layout, "results") && (
      <>
        <LayoutElements layout={layout} sectionKey="results" placement="before" />
        <div className="report-layout-section" style={layoutSectionStyle(layout, "results")}>
          {record.testType === "Ready Mix" ? <ReadyMixReport record={record} standards={strengthStandards} selectedStandard={selectedStrengthStandard} layout={layout} /> :
            record.testType === "Precast" ? <PrecastReport record={record} standards={strengthStandards} layout={layout} /> :
            record.testType === "Water" ? <WaterReport record={record} layout={layout} /> :
            record.testType === "Sand Sieve" || record.testType === "Aggregate Sieve" ? <SieveReport record={record} layout={layout} /> :
            record.testType === "Paving Blocks" ? <PavingBlocksReport record={record} standards={strengthStandards} layout={layout} /> :
              <ConfiguredDetailsReport record={record} layout={layout} strengthStandard={selectedStrengthStandard} tableKey={record.testType === "Kerb Stone" ? "kerbStoneDetails" : record.testType === "RMX Trial" ? "rmxTrialDetails" : "flakinessDetails"} />}
        </div>
        <LayoutElements layout={layout} sectionKey="results" placement="after" />
      </>
    )}
    {layoutSectionVisible(layout, "signatures") && <><LayoutElements layout={layout} sectionKey="signatures" placement="before" /><footer className="report-signatures report-layout-section" style={layoutSectionStyle(layout, "signatures", { inFlow: blockFlowMode })}><div><span>Tested by:</span><strong>{record.testedBy}</strong></div><div><span>Approved by:</span><strong>{record.reviewedBy || "ADEL ABBAS EBRAHIM"}</strong></div><small>{companyName} · {companySubtitle}</small></footer><LayoutElements layout={layout} sectionKey="signatures" placement="after" /></>}
  </div>
  {positionedTemplateDesign && <ReportTemplateObjects design={positionedTemplateDesign} record={record} companyName={companyName} reportTitle={reportTitle} formulaPreview={formulaPreview} skipSectionObjects={blockFlowMode} />}
  </main>
  </>;
}

export default function ReportPrint() {
  const { id } = useParams();
  const goBack = useAppBack("/reports");
  const reportId = Number(id);
  const { data: report, isLoading: reportLoading, error } = useGetReport(reportId);
  const {
    data: reportTemplates = [],
    isLoading: templatesLoading,
    isError: templatesError,
  } = useListReportTemplates(
    report ? { testType: report.record.testType } : undefined,
    {
      query: {
        enabled: Boolean(report),
        queryKey: getListReportTemplatesQueryKey(
          report ? { testType: report.record.testType } : undefined,
        ),
      },
    },
  );
  const { data: strengthStandards = [], isLoading: strengthStandardsLoading } =
    useListStrengthStandards();
  const { data: sieveStandards = [], isLoading: sieveStandardsLoading } =
    useListSieveStandards();
  const [selectedStrengthStandardId, setSelectedStrengthStandardId] = useState("");
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<Record<string, number>>({});
  useEffect(() => {
    if (report) {
      setSelectedStrengthStandardId(String(report.record.details.strengthStandardId ?? ""));
    }
  }, [report]);
  const matchingStrengthStandards = useMemo(
    () =>
      report
        ? strengthStandards
            .filter(
              (standard) =>
                standard.testType === report.record.testType &&
                matchesText(standard.material, report.record.material),
            )
            .sort((left, right) => left.id - right.id)
        : [],
    [report, strengthStandards],
  );
  const selectedStrengthStandard = matchingStrengthStandards.find(
    (standard) => String(standard.id) === selectedStrengthStandardId,
  );
  const activeStrengthStandard = selectedStrengthStandard ?? matchingStrengthStandards[0];
  const activeTemplate = report
    ? reportTemplates.find((template) => template.id === selectedTemplateIds[report.record.testType]) ??
      reportTemplates.find((template) => template.isDefault) ??
      reportTemplates[0]
    : undefined;
  const isLoading = reportLoading || strengthStandardsLoading || sieveStandardsLoading;

  if (isLoading) {
    return (
      <div className="p-8 text-center text-muted-foreground print-hide">
        Loading certificate...
      </div>
    );
  }
  if (error || !report) {
    return (
      <div className="p-8 text-center text-destructive print-hide">
        Failed to load certificate.
      </div>
    );
  }

  const { record, companyName, companySubtitle, layout } = report;
  const reportReferenceNumber =
    record.testType === "Ready Mix"
      ? detailValue(
          record.details,
          ["sampleNumber", "sampleNo", "sampleReference", "referenceNumber"],
          record.recordNo,
        )
      : record.recordNo;
  const strengthEvaluation = objectValue(record.details.strengthEvaluation);
  const configuredSieveStandards = sieveStandards
    .filter(
      (standard) =>
        standard.testType === record.testType &&
        matchesText(standard.material, record.material),
    )
    .sort((left, right) => left.id - right.id);
  const configuredStrengthStandard =
    selectedStrengthStandardForRecord(strengthStandards, record);
  const reportStrengthStandard =
    record.testType === "Ready Mix" ? activeStrengthStandard : configuredStrengthStandard;
  const configuredStandard =
    reportStrengthStandard?.bsStandard ??
    strengthEvaluation?.bsStandard ??
    configuredSieveStandards[0]?.standardReference ??
    null;
  const isSieveReport =
    record.testType === "Sand Sieve" ||
    record.testType === "Aggregate Sieve";
  const accordingTo = record.testType === "Blocks"
    ? isDammamLocation(record.location)
      ? "ASTM C140/C140M:2020a"
      : "BS EN 771-3:2003 (BS EN 772-1:2011)"
    : isSieveReport
      ? "BS812:PART103:1985"
    : record.testType === "Paving Blocks"
      ? configuredStandard || "BS EN 1338:2003"
      : configuredStandard
      ? configuredStandard
      : record.testType === "Ready Mix"
        ? "BS EN 12390-3:2009"
        : null;
  const defaultTitle =
    record.testType === "Ready Mix"
      ? "Readymix Cube Test Report"
      : record.testType === "Blocks"
        ? "Block Compression Test"
        : record.testType === "Paving Blocks"
          ? "Paving Block Test Report"
        : `${record.testType} Test Report`;

  return (
    <div className={`report-page ${record.testType === "Ready Mix" ? "ready-mix-page" : ""}`}>
      <div className="report-toolbar print-hide">
        <button
          type="button"
          onClick={goBack}
          className="flex items-center text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </button>
        <div className="flex items-center gap-3">
          {record.testType === "Ready Mix" && matchingStrengthStandards.length > 0 && (
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Report standard</span>
              <select
                value={selectedStrengthStandardId}
                onChange={(event) => setSelectedStrengthStandardId(event.target.value)}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Auto — first matching standard</option>
                {matchingStrengthStandards.map((standard) => (
                  <option key={standard.id} value={standard.id}>
                    {standard.bsStandard} — {standard.requiredStrength} {standard.strengthUnit}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Report template</span>
            <select
              data-testid="select-print-report-template"
              value={activeTemplate?.id ?? ""}
              disabled={templatesLoading || !reportTemplates.length}
              onChange={(event) => setSelectedTemplateIds((current) => ({
                ...current,
                [record.testType]: Number(event.target.value),
              }))}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm outline-none focus:ring-2 focus:ring-ring"
            >
              {!reportTemplates.length && <option value="">Legacy report layout</option>}
              {reportTemplates.map((template: ReportTemplate) => (
                <option key={template.id} value={template.id}>
                  {template.name}{template.isDefault ? " (default)" : ""}
                </option>
              ))}
            </select>
          </label>
          <Button onClick={() => window.print()} className="gap-2">
            <Printer className="w-4 h-4" /> Print Certificate
          </Button>
        </div>
      </div>

      {templatesError && (
        <p className="print-hide mx-auto mb-3 max-w-4xl text-sm text-amber-700" role="status" data-testid="status-report-template-load-error">
          Saved templates could not be loaded. The existing report layout is being used.
        </p>
      )}
      <ReportDocument
        report={{
          ...report,
          layout: activeTemplate
            ? { id: activeTemplate.id, testType: activeTemplate.testType, name: activeTemplate.name, config: activeTemplate.design.layout }
            : layout,
        }}
        strengthStandards={strengthStandards}
        sieveStandards={sieveStandards}
        selectedStrengthStandardId={selectedStrengthStandardId}
        accordingTo={accordingTo}
        reportReferenceNumber={reportReferenceNumber}
        defaultTitle={defaultTitle}
        templateDesign={activeTemplate?.design}
      />
    </div>
  );
}
