import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useParams } from "wouter";
import {
  useGetReport,
  useListSieveStandards,
  useListStrengthStandards,
} from "@workspace/api-client-react";
import type {
  QcRecord,
  ReportLayout,
  StrengthStandard,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer } from "lucide-react";
import { useAppBack } from "@/hooks/use-app-back";
import {
  blockMaterialMatches,
  blockSizeMatches,
  blockTypeMatches,
  calculateMoistureContent,
  sortSieveRowsByPoreSize,
} from "./record-form-utils";

type DetailMap = QcRecord["details"];
type ValueMap = Record<string, unknown>;
type LayoutColumn = ReportLayout["config"]["columns"][string][number];

function layoutSectionVisible(layout: ReportLayout | undefined, key: string) {
  const section = layout?.config.sections.find((item) => item.key === key);
  return section?.visible ?? true;
}

function layoutSectionOrder(layout: ReportLayout | undefined, key: string) {
  const section = layout?.config.sections.find((item) => item.key === key);
  return section?.order ?? 0;
}

function layoutColumns(
  layout: ReportLayout | undefined,
  tableKey: string,
  fallback: LayoutColumn[],
) {
  const configured = layout?.config.columns[tableKey];
  const selectedColumns = configured?.length ? configured : fallback;
  const compatibleColumns =
    tableKey === "pavingResults" && configured?.length
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
  return normalizedText(value) === "dammam";
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

function formatNumber(value: number) {
  return value.toFixed(1);
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
}: {
  rows: unknown[];
  hideWaterStrength: boolean;
}) {
  const rowValues = rows.map((row) => (
    typeof row === "object" && row !== null ? row as ValueMap : {}
  ));
  const columns = {
    water: rowValues.map(blockWaterStrength),
    airDry: rowValues.map((values) => blockAirDryStrength(values, hideWaterStrength)),
    normalized: rowValues.map((values) => numericValue(values.normalizedStrength)),
    density: rowValues.map(blockDensity),
    wetWeight: rowValues.map((values) => numericValue(values.wetWeight)),
  };
  const averages = {
    water: numericSummary(columns.water).average,
    airDry: numericSummary(columns.airDry).average,
    normalized: numericSummary(columns.normalized).average,
    density: numericSummary(columns.density).average,
    wetWeight: numericSummary(columns.wetWeight).average,
  };
  const strengthSummary = numericSummary(columns.airDry);
  const strengthLabel = "Air Dry Strength";
  const displayNumber = (value: number | null) =>
    value === null ? "-" : formatNumber(value);
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
              <th>No.</th>
              <th>Length<br />(mm)</th>
              <th>Width<br />(mm)</th>
              <th>Height<br />(mm)</th>
              <th>Load<br />(kN)</th>
              {!hideWaterStrength && <th>Water<br />(N/mm2)</th>}
              <th>Air Dry<br />(N/mm2)</th>
              <th>Normalized<br />(N/mm2)</th>
              <th>Density<br />(kg/m3)</th>
              <th>Wet Weight<br />(kg)</th>
            </tr>
          </thead>
          <tbody>
            {rowValues.map((values, index) => (
              <tr key={index}>
                <td>{rawTextValue(values.rowNo, String(index + 1))}</td>
                <td>{textValue(values.length)}</td>
                <td>{textValue(values.width)}</td>
                <td>{textValue(values.height)}</td>
                <td>{textValue(values.load)}</td>
                {!hideWaterStrength && <td>{displayNumber(columns.water[index])}</td>}
                <td>{displayNumber(columns.airDry[index])}</td>
                <td>{displayNumber(columns.normalized[index])}</td>
                <td>{displayNumber(columns.density[index])}</td>
                <td>{displayNumber(columns.wetWeight[index])}</td>
              </tr>
            ))}
            <tr className="block-report-average-row">
              <td colSpan={hideWaterStrength ? 4 : 5}>AVERAGE:</td>
              {!hideWaterStrength && <td>{displayNumber(averages.water)}</td>}
              <td>{displayNumber(averages.airDry)}</td>
              <td>{displayNumber(averages.normalized)}</td>
              <td>{displayNumber(averages.density)}</td>
              <td>{displayNumber(averages.wetWeight)}</td>
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
  if (configuredAge !== null && configuredAge > 0) return configuredAge;
  for (const row of rows) {
    const age = cubeRowAge(row);
    if (age !== null && age > 0) return age;
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
}: {
  rows: unknown[];
  layout?: ReportLayout;
}) {
  const visibleRows = sortSieveRowsByPoreSize(rows.filter((row) => {
    const values = typeof row === "object" && row !== null
      ? row as Record<string, unknown> : {};
    return hasSieveSize(values.sieveSize) && [
      values.amountReturned,
      values.passingAmount,
      values.passingPercentage,
    ].some(hasSieveEntry);
  }), (row) => objectValue(row)?.sieveSize);
  if (!visibleRows.length) return null;
  const tableColumns = layoutColumns(layout, "sieveResults", [
    { key: "no", label: "No.", visible: true, order: 0, width: 7 },
    { key: "size", label: "Sieve / Pore Size", visible: true, order: 1, width: 26 },
    { key: "returned", label: "Amount Returned", visible: true, order: 2, width: 22 },
    { key: "passing", label: "Amount Passing", visible: true, order: 3, width: 22 },
    { key: "percentage", label: "% Passing", visible: true, order: 4, width: 23 },
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
            return (
              <tr key={index}>{tableColumns.map((column) => {
                const value = column.key === "no"
                  ? index + 1
                  : column.key === "size"
                    ? rawTextValue(values.sieveSize)
                    : column.key === "returned"
                      ? textValue(values.amountReturned)
                      : column.key === "passing"
                        ? textValue(values.passingAmount)
                        : textValue(values.passingPercentage);
                return <td key={column.key}>{value}</td>;
              })}</tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SieveEvaluationTable({ value }: { value: unknown }) {
  if (typeof value !== "object" || value === null) return null;
  const evaluation = value as Record<string, unknown>;
  const criteria = sortSieveRowsByPoreSize(
    (Array.isArray(evaluation.criteria) ? evaluation.criteria : []).filter(
      (criterion) => hasSieveSize(objectValue(criterion)?.sieveSize),
    ),
    (criterion) => objectValue(criterion)?.sieveSize,
  );
  if (!criteria.length) return null;
  return (
    <div className="report-evaluation-block">
      <p className="report-centered-title">
        Sieve Evaluation: {textValue(evaluation.status)}{evaluation.reason ? ` — ${textValue(evaluation.reason)}` : ""}
      </p>
      <table className="report-table">
        <thead><tr><th>Sieve / Pore Size</th><th>Measured</th><th>Allowed Range</th><th>Result</th></tr></thead>
        <tbody>
          {criteria.map((criterion, index) => {
            const item = typeof criterion === "object" && criterion !== null
              ? criterion as Record<string, unknown> : {};
            return <tr key={index}>
              <td>{rawTextValue(item.sieveSize)}</td>
              <td>{item.measuredValue == null ? "Missing" : `${textValue(item.measuredValue)} ${textValue(item.unit)}`}</td>
              <td>{item.minimum == null ? "—" : textValue(item.minimum)} to {item.maximum == null ? "—" : textValue(item.maximum)} {textValue(item.unit)}</td>
              <td>{item.withinLimits === true ? "Pass" : item.withinLimits === false ? "Fail" : "Review"}</td>
            </tr>;
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
          bsStandard: textValue(evaluation.bsStandard),
          requiredStrength: Number(evaluation.requiredStrength),
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
          strength: detailValue(details, ["strength", "compressiveStrength"]),
          waterAbsorption: detailValue(details, ["waterAbsorption", "absorption"]),
        },
      ];
  const orderedTestRows = sortCubeRowsByAge(testRows);
  const average28DayStrength = averageStrengthForAgeRange(orderedTestRows, 28, 29);
  const resultColumnDefaults: LayoutColumn[] = [
    { key: "testingDate", label: "Testing Date", visible: true, order: 0, width: 18 },
    { key: "age", label: "Cube Age", visible: true, order: 1, width: 12 },
    { key: "weight", label: "Cube Weight (g)", visible: true, order: 2, width: 16 },
    { key: "load", label: "Load (kN)", visible: true, order: 3, width: 16 },
    { key: "strength", label: "Strength (N/mm²)", visible: true, order: 4, width: 19 },
    { key: "absorption", label: "Water Absorption (%)", visible: true, order: 5, width: 19 },
  ];
  const savedResultColumns = layout?.config.columns.readyMixResults ?? [];
  const resultColumns = resultColumnDefaults
    .map((fallback) => {
      const saved = savedResultColumns.find((column) => column.key === fallback.key);
      return saved ? { ...fallback, label: saved.label, order: saved.order, width: saved.width } : fallback;
    })
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

      <section className="report-ready-mix-results">
        <table className="report-table report-results-table">
          <thead>
            <tr>{resultColumns.map((column) => <th key={column.key}>{column.label}</th>)}</tr>
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
                load: firstPresentValue([values.load, details.load]),
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
}: {
  record: QcRecord;
  standards: StrengthStandard[];
}) {
  const details = record.details;
  const evaluation = objectValue(details.strengthEvaluation);
  const testRows = Array.isArray(details.testRows) ? details.testRows : [];
  const blockAge = blockAgeFromRecord(details, testRows);
  const enteredTestingDate =
    typeof details.testingDate === "string" ? details.testingDate : null;
  const testingDate = enteredTestingDate ||
    (blockAge === null ? null : addDaysToDate(record.sampleDate, blockAge));
  const configuredStandard = standards
    .filter((standard) => strengthStandardMatchesRecord(standard, record))
    .sort((left, right) => left.id - right.id)[0];
  const requiredStrength = configuredStandard?.requiredStrength ??
    numericValue(evaluation?.requiredStrength);
  const useDammamBasis = isDammamLocation(record.location);
  const compliance = textValue(evaluation?.status, record.status);
  const complianceLabel = compliance === "Passed"
    ? "PASS"
    : compliance === "Failed"
      ? "NOT PASS"
      : "REVIEW";
  return (
    <div className="block-compression-report">
      <div className="block-report-section-heading">
        <div>
          <span>Test details</span>
        </div>
        <strong className="block-report-air-dry-note">
          {useDammamBasis
            ? "Dammam: Air Dry compliance basis"
            : "Air Dry strength compliance basis"}
        </strong>
      </div>
      <div className="block-report-fields">
        <ReportFields
          entries={[
            ["BLOCK SIZE:", detailValue(details, ["blockSize"])],
            ["CASTING DATE:", formatReportDate(record.sampleDate)],
            ["TESTING DATE:", formatReportDate(testingDate)],
            ["Sp. Strength (N/mm²):", requiredStrength === null ? "-" : formatNumber(requiredStrength)],
            ["Factory:", record.location],
            ["STRENGTH BASIS:", "AIR DRY STRENGTH"],
          ]}
        />
        <ReportFields
          entries={[
            ["BLOCK AGE IN DAYS:", blockAge === null ? "-" : formatNumber(blockAge)],
            ["MACHINE TYPE:", detailValue(details, ["machine"])],
            ["SAMPLE TYPE:", detailValue(details, ["sampleType"])],
            ["METHOD OF CONDITIONING:", detailValue(details, ["conditioningMethod"])],
            ["METHOD OF PREPARATION:", detailValue(details, ["preparationMethod"])],
            ["SHAPE FACTOR:", detailValue(details, ["shapeFactor"])],
            ["BLOCK TYPE:", detailValue(details, ["blockType"], record.material)],
          ]}
        />
      </div>
      <div className="block-report-remarks">
        <strong>Remarks:</strong>
        <span>{record.remarks || ""}</span>
      </div>
      <BlockCompressionRowsTable rows={testRows} hideWaterStrength={useDammamBasis} />
      <div className={`block-report-result ${compliance.toLocaleLowerCase()}`}>
        <span>Overall result</span>
        <strong>{complianceLabel}</strong>
      </div>
    </div>
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
  const drySampleWeight = detailRawValue(details, ["dryWeight", "drySample"], "");
  const wetSampleWeight = detailRawValue(details, ["wetWeight", "wetSample"], "");
  const moistureContent = calculateMoistureContent(
    drySampleWeight,
    wetSampleWeight,
  );
  const measurementEntries = isAggregate
    ? [
        ["Supplier", detailValue(details, ["supplier"])],
        ["Material Condition", detailValue(details, ["materialCondition", "condition"])],
        ["Dry Sample Weight (g)", drySampleWeight || "-"],
        ["Wet Sample Weight (g)", wetSampleWeight || "-"],
        ["Moisture Content (%)", moistureContent || "-"],
        ["Fineness Modulus", detailValue(details, ["finenessModulus"])],
      ] as const
    : [
        ["Supplier", detailValue(details, ["supplier"])],
        ["Condition", detailValue(details, ["condition"])],
        ["Dry Sample", detailValue(details, ["drySample"])],
        ["Wet Sample", detailValue(details, ["wetSample"])],
        ["Silt Before", detailValue(details, ["siltBefore"])],
        ["Silt After", detailValue(details, ["siltAfter"])],
      ] as const;

  return (
    <>
      <div className="report-two-column">
        <section>
          <SectionHeading>Sample Details</SectionHeading>
          <ReportFields
            entries={[
              ["Sample Date", formatReportDate(record.sampleDate)],
              ["Location", record.location],
              ["Material", record.material],
              ["Tested By", record.testedBy],
            ]}
          />
        </section>
        <section className="report-summary">
          <SectionHeading>{isAggregate ? "Aggregate Details" : "Sand Details"}</SectionHeading>
          <ReportFields entries={measurementEntries} />
        </section>
      </div>

      <SieveRowsTable rows={sieveRows} layout={layout} />
      {evaluation && (
        <SieveEvaluationTable value={evaluation} />
      )}
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
  const rows = Array.isArray(details.testRows) ? details.testRows : [];
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
  const testingDate = textValue(details.testingDate);
  const configuredAge = numericValue(details.blockAge);
  const castingTimestamp = Date.parse(castingDate);
  const testingTimestamp = Date.parse(testingDate);
  const dateAge =
    Number.isFinite(castingTimestamp) && Number.isFinite(testingTimestamp)
      ? Math.max(
          0,
          Math.floor((testingTimestamp - castingTimestamp) / 86_400_000),
        )
      : null;
  const blockAge = configuredAge ?? dateAge;
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
      {layoutSectionVisible(layout, "remarks") && record.remarks && (
        <div className="block-report-remarks">
          <strong>Remark:</strong>
          <span>{record.remarks}</span>
        </div>
      )}
      <SpecimenRowsTable
        rows={rows}
        status={status}
        layout={layout}
      />
      <PavingStrengthStatistics rows={rows} />
    </div>
  );
}

function WaterReport({ record }: { record: QcRecord }) {
  const details = record.details;
  return (
    <section>
      <SectionHeading>Water Quality Details</SectionHeading>
      <div className="report-two-column">
        <ReportFields
          entries={[
            ["Sample Date", formatReportDate(record.sampleDate)],
            ["Location", record.location],
            ["Material", record.material],
            ["Source", detailValue(details, ["source"])],
          ]}
        />
        <ReportFields
          className="report-summary"
          entries={[
            ["Tested By", record.testedBy],
            ["pH", detailValue(details, ["ph", "pH"])],
            ["TDS", detailValue(details, ["tds"])],
            ["Chloride", detailValue(details, ["chloride"])],
            ["Sulphate", detailValue(details, ["sulphate", "sulfate"])],
          ]}
        />
      </div>
    </section>
  );
}

function FallbackReport({ record }: { record: QcRecord }) {
  return (
    <section>
      <SectionHeading>{record.testType} Details</SectionHeading>
      <RecordContextFields record={record} />
    </section>
  );
}

export default function ReportPrint() {
  const { id } = useParams();
  const goBack = useAppBack("/reports");
  const reportId = Number(id);
  const { data: report, isLoading: reportLoading, error } = useGetReport(reportId);
  const { data: strengthStandards = [], isLoading: strengthStandardsLoading } =
    useListStrengthStandards();
  const { data: sieveStandards = [], isLoading: sieveStandardsLoading } =
    useListSieveStandards();
  const [selectedStrengthStandardId, setSelectedStrengthStandardId] = useState("");
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
  const configuredStrengthStandard = strengthStandards
    .filter((standard) => strengthStandardMatchesRecord(standard, record))
    .sort((left, right) => left.id - right.id)[0];
  const reportStrengthStandard =
    record.testType === "Ready Mix" ? activeStrengthStandard : configuredStrengthStandard;
  const configuredStandard =
    reportStrengthStandard?.bsStandard ??
    strengthEvaluation?.bsStandard ??
    configuredSieveStandards[0]?.standardReference ??
    null;
  const accordingTo = record.testType === "Blocks"
    ? isDammamLocation(record.location)
      ? "ASTM C140/C140M:2020a"
      : "BS EN 771-3:2003 (BS EN 772-1:2011)"
    : record.testType === "Paving Blocks"
      ? configuredStandard || "BS EN 1338:2003"
      : configuredStandard
      ? configuredStandard
      : record.testType === "Ready Mix"
        ? "BS EN 12390-3:2009"
        : null;
  const paperStyle = layout
    ? {
        fontFamily: layout.config.fontFamily,
        fontSize: `${Math.max(layout.config.fontSize, 13)}px`,
        color: layout.config.textColor,
        padding: `${layout.config.paperPadding}mm`,
        "--report-accent-color": layout.config.accentColor,
      } as CSSProperties
    : undefined;
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
          <Button onClick={() => window.print()} className="gap-2">
            <Printer className="w-4 h-4" /> Print Certificate
          </Button>
        </div>
      </div>

      <main
        className={`report-paper ${record.testType === "Ready Mix" ? "ready-mix-paper" : ""}`}
        style={paperStyle}
      >
        <div className="report-layout-content">
        {layoutSectionVisible(layout, "header") && <header
          className="report-header report-layout-section"
          style={{ order: layoutSectionOrder(layout, "header") }}
        >
          <div className="report-company">{companySubtitle}</div>
          <img
            src="/al-manaratain-logo.webp"
            alt="Al Manaratain Logo"
            className="report-logo"
          />
          <div className="report-title">
            <strong>
              {layout?.config.title || defaultTitle}
            </strong>
            <span>Ref: {reportReferenceNumber}</span>
          </div>
        </header>}
        {layoutSectionVisible(layout, "standard") && <p
          className="report-standard report-layout-section"
          style={{ order: layoutSectionOrder(layout, "standard") }}
        >
          {accordingTo
            ? `ACCORDING TO ${accordingTo}`
            : "QUALITY CONTROL TEST REPORT"}
        </p>}
        {layoutSectionVisible(layout, "results") && <div
          className="report-layout-section"
          style={{ order: layoutSectionOrder(layout, "results") }}
        >
          {record.testType === "Ready Mix" ? (
            <ReadyMixReport
              record={record}
              standards={strengthStandards}
              selectedStandard={reportStrengthStandard}
              layout={layout}
            />
          ) : record.testType === "Blocks" ? (
          <BlocksReport record={record} standards={strengthStandards} />
          ) : record.testType === "Sand Sieve" || record.testType === "Aggregate Sieve" ? (
            <SieveReport record={record} layout={layout} />
          ) : record.testType === "Paving Blocks" ? (
            <PavingBlocksReport record={record} standards={strengthStandards} layout={layout} />
          ) : record.testType === "Water" ? (
            <WaterReport record={record} />
          ) : (
            <FallbackReport record={record} />
          )}
        </div>}

        {layoutSectionVisible(layout, "remarks") &&
          record.testType !== "Blocks" &&
          record.testType !== "Paving Blocks" &&
          record.remarks && (
          <div
            className="report-remarks report-layout-section"
            style={{ order: layoutSectionOrder(layout, "remarks") }}
          >
            <span>Remarks:</span> {record.remarks}
          </div>
        )}

        {layoutSectionVisible(layout, "signatures") && <footer
          className="report-signatures report-layout-section"
          style={{ order: layoutSectionOrder(layout, "signatures") }}
        >
          <div>
            <span>Tested by:</span>
            <strong>{record.testedBy}</strong>
          </div>
          <div>
            <span>Approved by:</span>
            <strong>{record.reviewedBy || "ADEL ABBAS EBRAHIM"}</strong>
          </div>
          <small>
            {companyName} · {companySubtitle}
          </small>
        </footer>}
        </div>
      </main>
    </div>
  );
}