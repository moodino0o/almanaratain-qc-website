import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "wouter";
import {
  useGetReport,
  useListSieveStandards,
  useListStrengthStandards,
} from "@workspace/api-client-react";
import type {
  QcRecord,
  StrengthStandard,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer } from "lucide-react";
import { blockMaterialMatches, blockSizeMatches, blockTypeMatches } from "./record-form-utils";

type DetailMap = QcRecord["details"];
type ValueMap = Record<string, unknown>;

function textValue(value: unknown, fallback = "-") {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
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

function objectValue(value: unknown): ValueMap | null {
  return typeof value === "object" && value !== null
    ? value as ValueMap
    : null;
}

function normalizedText(value: unknown) {
  return String(value ?? "").trim().toLocaleLowerCase();
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

function formatNumber(value: number, digits = 1) {
  return Number.isInteger(value) ? String(value) : value.toFixed(digits);
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

function numericStrength(value: string) {
  const number = Number.parseFloat(value);
  return Number.isFinite(number) ? number : null;
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
  return numericValue(values.calculatedStrength ?? values.strength ?? values.compressiveStrength);
}

function averageStrengthForAge(rows: unknown[], age: number) {
  const strengths = rows
    .filter((row) => cubeRowAge(row) === age)
    .map(cubeRowStrength)
    .filter((strength): strength is number => strength !== null);
  if (!strengths.length) return null;
  return strengths.reduce((total, strength) => total + strength, 0) / strengths.length;
}

function strengthSummary(rows: unknown[]) {
  const strengths = rows
    .map(cubeRowStrength)
    .filter((strength): strength is number => strength !== null);
  if (!strengths.length) {
    return { average: null, minimum: null, maximum: null };
  }
  return {
    average: strengths.reduce((total, strength) => total + strength, 0) / strengths.length,
    minimum: Math.min(...strengths),
    maximum: Math.max(...strengths),
  };
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
  const ages = [...new Set(
    rows
      .map(cubeRowAge)
      .filter((age): age is number => age !== null),
  )].sort((left, right) => left - right);

  if (!ages.length) return null;

  return (
    <div className="report-average-block">
      <p className="report-centered-title">Average Strength by Cube Age:</p>
      <table className="report-table report-average-table">
        <thead>
          <tr>
            <th>Test Age</th>
            <th>Average Strength (N/mm2)</th>
          </tr>
        </thead>
        <tbody>
          {ages.map((age) => (
            <tr key={age}>
              <td>{age} days</td>
              <td>
                {averageStrengthForAge(rows, age) === null
                  ? "-"
                  : `${formatNumber(averageStrengthForAge(rows, age) ?? 0, 2)} N/mm2`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SpecimenRowsTable({
  rows,
  ageLabel,
  showAge = true,
}: {
  rows: unknown[];
  ageLabel: string;
  showAge?: boolean;
}) {
  if (!hasSpecimenMeasurements(rows)) return null;
  return (
    <div className="report-specimen-block">
      <p className="report-centered-title">Specimen Dimensions and Weights:</p>
      <table className="report-table report-specimen-table">
        <thead>
          <tr>
            <th>No.</th>
            {showAge && <th>{ageLabel}</th>}
            <th>Length (mm)</th>
            <th>Width (mm)</th>
            <th>Height (mm)</th>
            <th>Dry Weight</th>
            <th>Wet Weight</th>
            <th>Load (kN)</th>
            <th>Loaded Face Area (mm2)</th>
            <th>Calculated Strength (N/mm2)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const values =
              typeof row === "object" && row !== null
                ? (row as Record<string, unknown>)
                : {};
            return (
              <tr key={index}>
                <td>{textValue(values.rowNo, String(index + 1))}</td>
                {showAge && <td>{textValue(values.testAge || values.sampleAge)}</td>}
                <td>{textValue(values.length)}</td>
                <td>{textValue(values.width)}</td>
                <td>{textValue(values.height)}</td>
                <td>{textValue(values.dryWeight)}</td>
                <td>{textValue(values.wetWeight)}</td>
                <td>{textValue(values.load)}</td>
                <td>{textValue(values.loadedFaceArea)}</td>
                <td>{textValue(values.calculatedStrength || values.strength || values.compressiveStrength)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SieveRowsTable({ rows }: { rows: unknown[] }) {
  const visibleRows = rows.filter((row) => {
    const values = typeof row === "object" && row !== null
      ? row as Record<string, unknown> : {};
    return hasSieveSize(values.sieveSize) && [
      values.amountReturned,
      values.passingAmount,
      values.passingPercentage,
    ].some(hasSieveEntry);
  });
  if (!visibleRows.length) return null;
  return (
    <div className="report-specimen-block">
      <p className="report-centered-title">Sieve Measurements:</p>
      <table className="report-table">
        <thead>
          <tr>
            <th>No.</th>
            <th>Sieve / Pore Size</th>
            <th>Amount Returned</th>
            <th>Amount Passing</th>
            <th>% Passing</th>
          </tr>
        </thead>
        <tbody>
          {visibleRows.map((row, index) => {
            const values = typeof row === "object" && row !== null
              ? row as Record<string, unknown> : {};
            return (
              <tr key={index}>
                <td>{index + 1}</td>
                <td>{textValue(values.sieveSize)}</td>
                <td>{textValue(values.amountReturned)}</td>
                <td>{textValue(values.passingAmount)}</td>
                <td>{textValue(values.passingPercentage)}</td>
              </tr>
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
  const criteria = (Array.isArray(evaluation.criteria) ? evaluation.criteria : []).filter((criterion) => {
    const item = typeof criterion === "object" && criterion !== null
      ? criterion as Record<string, unknown> : {};
    return hasSieveSize(item.sieveSize);
  });
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
              <td>{textValue(item.sieveSize)}</td>
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
    <div className="report-standard-block">
      <p className="report-centered-title">Standard Required Strength:</p>
      <table className="report-table report-strength-table">
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
                <th>BS STANDARD</th>
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
                  <td>{standard.bsStandard}</td>
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
    <section className="report-compliance-block">
      <SectionHeading>BS Standard Compliance</SectionHeading>
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
              : `${formatNumber(reportedStrength, 2)} ${strengthUnit}`}
          </strong>
        </div>
        <div>
          <span>Compliance</span>
          <strong className={`report-compliance-status ${statusClass}`}>{status}</strong>
        </div>
      </div>
      <p className="report-compliance-reason">{reason}</p>
    </section>
  );
}

function ReportField({ label, value }: { label: string; value: string }) {
  return (
    <div className="report-field">
      <span>{label}:</span>
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

function ReadyMixReport({
  record,
  standards,
  selectedStandard,
}: {
  record: QcRecord;
  standards: StrengthStandard[];
  selectedStandard?: StrengthStandard;
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
  const average28DayStrength = averageStrengthForAge(orderedTestRows, 28);

  return (
    <>
      <section className="report-ready-mix-info">
        <SectionHeading>General Information</SectionHeading>
        <ReportFields
          entries={[
            ["Sample Date", formatReportDate(record.sampleDate)],
            ["Plant / Production Location", record.location],
            ["Material / Product", record.material],
            ["Tested By (Technician)", record.testedBy],
            ["Reference Number", detailValue(details, ["referenceNumber"])],
            ["Ready Mix Customer Name", detailValue(details, ["customerName", "customer"], record.location)],
            ["Customer Location", detailValue(details, ["customerLocation"], record.location)],
          ]}
        />
      </section>

      <section className="report-ready-mix-measures">
        <SectionHeading>Measurement Details: Ready Mix</SectionHeading>
        <div className="report-measure-grid">
          <ReportField label="Slump (mm)" value={detailValue(details, ["slump", "slumpTest"])} />
          <ReportField label="Temperature (°C)" value={detailValue(details, ["temperature"])} />
        </div>
      </section>

      <section className="report-ready-mix-results">
        <SectionHeading>Specimen Measurements</SectionHeading>
        <table className="report-table report-results-table">
          <thead>
            <tr>
              <th>No.</th>
              <th>Test Age</th>
              <th>Length (mm)</th>
              <th>Width (mm)</th>
              <th>Height (mm)</th>
              <th>Dry Weight</th>
              <th>Wet Weight</th>
              <th>Water Absorption (%)</th>
              <th>Load (kN)</th>
              <th>Calculated Strength</th>
            </tr>
          </thead>
          <tbody>
            {orderedTestRows.map((row, index) => {
              const values =
                typeof row === "object" && row !== null
                  ? (row as Record<string, unknown>)
                  : {};
              const displayValues: ValueMap = {
                ...values,
                testAge:
                  values.testAge ||
                  values.sampleAge ||
                  values.cubeAge ||
                  values.age ||
                  detailValue(details, ["cubeAge", "age"]),
                length: values.length || detailValue(details, ["length"], ""),
                width: values.width || detailValue(details, ["width"], ""),
                height: values.height || detailValue(details, ["height"], ""),
                dryWeight: values.dryWeight || detailValue(details, ["dryWeight"], ""),
                wetWeight: values.wetWeight || detailValue(details, ["wetWeight"], ""),
                load: values.load || detailValue(details, ["load"], ""),
                strength:
                  values.calculatedStrength ||
                  values.strength ||
                  values.compressiveStrength ||
                  detailValue(details, ["strength", "compressiveStrength"], ""),
              };
              return (
                <tr key={index}>
                  <td>{index + 1}</td>
                  <td>{textValue(displayValues.testAge)}</td>
                  <td>{textValue(displayValues.length)}</td>
                  <td>{textValue(displayValues.width)}</td>
                  <td>{textValue(displayValues.height)}</td>
                  <td>{textValue(displayValues.dryWeight)}</td>
                  <td>{textValue(displayValues.wetWeight)}</td>
                  <td>{calculatedWaterAbsorption(displayValues)}</td>
                  <td>{textValue(displayValues.load)}</td>
                  <td>{textValue(displayValues.strength)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <ReadyMixAverageStrengthTable rows={orderedTestRows} />
      </section>
      <ReadyMixComplianceBlock
        record={record}
        standards={standards}
        selectedStandard={selectedStandard}
        reportedStrength={average28DayStrength}
      />
    </>
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
  const testingDate = blockAge === null ? null : addDaysToDate(record.sampleDate, blockAge);
  const calculatedSummary = strengthSummary(testRows);
  const strengthUnit = textValue(evaluation?.strengthUnit, "N/mm²");
  const averageStrength = numericValue(evaluation?.averageStrength) ?? calculatedSummary.average;
  const minimumStrength = numericValue(evaluation?.minimumStrength) ?? calculatedSummary.minimum;
  const maximumStrength = numericValue(evaluation?.maximumStrength) ?? calculatedSummary.maximum;
  const compliance = textValue(evaluation?.status, record.status);
  return (
    <>
      <div className="report-two-column">
        <section>
          <SectionHeading>Block Details</SectionHeading>
          <ReportFields
            entries={[
              ["Block Type", detailValue(details, ["blockType"], record.material)],
              ["Block Size", detailValue(details, ["blockSize"])],
              ["Block No.", detailValue(details, ["blockNo", "blockNumber"])],
              ["Machine", detailValue(details, ["machine"])],
              ["Casting Date", formatReportDate(record.sampleDate)],
              ["Testing Date", formatReportDate(testingDate)],
              ["Block Age", blockAge === null ? "-" : `${formatNumber(blockAge)} days`],
            ]}
          />
        </section>
        <section className="report-summary">
          <SectionHeading>Test Result</SectionHeading>
          <ReportFields
            entries={[
              ["Average Strength", averageStrength === null ? "-" : `${formatNumber(averageStrength, 2)} ${strengthUnit}`],
              ["Minimum Strength", minimumStrength === null ? "-" : `${formatNumber(minimumStrength, 2)} ${strengthUnit}`],
              ["Maximum Strength", maximumStrength === null ? "-" : `${formatNumber(maximumStrength, 2)} ${strengthUnit}`],
              ["Shape Factor", detailValue(details, ["shapeFactor"])],
              ["Compliance", compliance],
            ]}
          />
        </section>
      </div>

      <div className="report-two-column report-test-details">
        <section>
          <SectionHeading>Test Information</SectionHeading>
          <RecordContextFields record={record} includeSampleDate={false} />
        </section>
        <section className="report-test-measures">
          <ReportFields
            entries={[
              ["Required Minimum", evaluation?.requiredStrength == null
                ? "-"
                : `${textValue(evaluation.requiredStrength)} ${strengthUnit}`],
              ["Applicable BS", textValue(evaluation?.bsStandard)],
            ]}
          />
        </section>
      </div>

      <SpecimenRowsTable rows={testRows} ageLabel="Sample Age" showAge={false} />
      <StrengthStandardsTable record={record} standards={standards} evaluation={evaluation} />
    </>
  );
}

function SieveReport({
  record,
}: {
  record: QcRecord;
}) {
  const details = record.details;
  const sieveRows = Array.isArray(details.sieveRows) ? details.sieveRows : [];
  const evaluation = objectValue(details.sieveEvaluation);
  const isAggregate = record.testType === "Aggregate Sieve";
  const measurementEntries = isAggregate
    ? [
        ["Supplier", detailValue(details, ["supplier"])],
        ["Material Condition", detailValue(details, ["materialCondition", "condition"])],
        ["Dry Sample", detailValue(details, ["drySample"])],
        ["Wet Sample", detailValue(details, ["wetSample"])],
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
              ["Sample Weight", detailValue(details, ["sampleWeight"])],
            ]}
          />
        </section>
        <section className="report-summary">
          <SectionHeading>{isAggregate ? "Aggregate Details" : "Sand Details"}</SectionHeading>
          <ReportFields entries={measurementEntries} />
        </section>
      </div>

      <SieveRowsTable rows={sieveRows} />
      {evaluation && (
        <SieveEvaluationTable value={evaluation} />
      )}
    </>
  );
}

function PavingBlocksReport({ record, standards }: {
  record: QcRecord;
  standards: StrengthStandard[];
}) {
  const details = record.details;
  const evaluation = objectValue(details.strengthEvaluation);
  return (
    <>
      <div className="report-two-column">
        <section>
          <SectionHeading>Paving Block Details</SectionHeading>
          <ReportFields
            entries={[
              ["Sample Date", formatReportDate(record.sampleDate)],
              ["Location", record.location],
              ["Block Type", detailValue(details, ["blockType"])],
              ["Block Size (mm)", detailValue(details, ["blockSize"])],
              ["Machine", detailValue(details, ["machine"])],
            ]}
          />
        </section>
        <section className="report-summary">
          <SectionHeading>Test Result</SectionHeading>
          <ReportFields
            entries={[
              ["Target", detailValue(details, ["target"])],
              ["Strength", detailValue(details, ["strength", "compressiveStrength"])],
              ["Correction Factor", detailValue(details, ["correctionFactor"])],
              ["Evaluation", textValue(evaluation?.status ?? record.status)],
            ]}
          />
        </section>
      </div>
      <div className="report-two-column report-test-details">
        <section>
          <SectionHeading>Test Information</SectionHeading>
          <RecordContextFields record={record} />
        </section>
        <section className="report-test-measures">
          <ReportFields
            entries={[
              ["Required Minimum", evaluation?.requiredStrength == null
                ? "-"
                : `${textValue(evaluation.requiredStrength)} ${textValue(evaluation.strengthUnit, "N/mm²")}`],
              ["Applicable BS", textValue(evaluation?.bsStandard)],
            ]}
          />
        </section>
      </div>
      <SpecimenRowsTable
        rows={Array.isArray(details.testRows) ? details.testRows : []}
        ageLabel="Sample Age"
      />
      <StrengthStandardsTable record={record} standards={standards} evaluation={evaluation} />
    </>
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

  const { record, companyName, companySubtitle } = report;
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

  return (
    <div className="report-page">
      <div className="report-toolbar print-hide">
        <Link
          href="/reports"
          className="flex items-center text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Reports
        </Link>
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

      <main className="report-paper">
        <header className="report-header">
          <div className="report-company">{companySubtitle}</div>
          <img
            src="/al-manaratain-logo.webp"
            alt="Al Manaratain Logo"
            className="report-logo"
          />
          <div className="report-title">
            <strong>
              {record.testType === "Ready Mix"
                ? "Readymix Cube Test Report"
                : `${record.testType} Test Report`}
            </strong>
            <span>Ref: {record.recordNo}</span>
          </div>
        </header>
        <p className="report-standard">
          {configuredStandard
            ? `ACCORDING TO ${String(configuredStandard)}`
            : record.testType === "Ready Mix"
              ? "ACCORDING TO BS EN 12390-3:2009"
              : "QUALITY CONTROL TEST REPORT"}
        </p>

        {record.testType === "Ready Mix" ? (
          <ReadyMixReport
            record={record}
            standards={strengthStandards}
            selectedStandard={reportStrengthStandard}
          />
        ) : record.testType === "Blocks" ? (
          <BlocksReport record={record} standards={strengthStandards} />
        ) : record.testType === "Sand Sieve" || record.testType === "Aggregate Sieve" ? (
          <SieveReport record={record} />
        ) : record.testType === "Paving Blocks" ? (
          <PavingBlocksReport record={record} standards={strengthStandards} />
        ) : record.testType === "Water" ? (
          <WaterReport record={record} />
        ) : (
          <FallbackReport record={record} />
        )}

        {record.remarks && (
          <div className="report-remarks">
            <span>Remarks:</span> {record.remarks}
          </div>
        )}

        <footer className="report-signatures">
          <div>
            <span>Tested by:</span>
            <strong>{record.testedBy}</strong>
          </div>
          <div>
            <span>Approved by:</span>
            <strong>{record.reviewedBy || "________________"}</strong>
          </div>
          <small>
            {companyName} · {companySubtitle}
          </small>
        </footer>
      </main>
    </div>
  );
}