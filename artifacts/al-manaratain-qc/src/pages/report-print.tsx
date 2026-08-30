import { useParams, Link } from "wouter";
import {
  useGetReport,
  useListSieveStandards,
  useListStrengthStandards,
} from "@workspace/api-client-react";
import type {
  QcRecord,
  SieveStandard,
  StrengthStandard,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer } from "lucide-react";

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

function numericStrength(value: string) {
  const number = Number.parseFloat(value);
  return Number.isFinite(number) ? number : null;
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

function SpecimenRowsTable({
  rows,
  ageLabel,
}: {
  rows: unknown[];
  ageLabel: string;
}) {
  if (!hasSpecimenMeasurements(rows)) return null;
  return (
    <div className="report-specimen-block">
      <p className="report-centered-title">Specimen Dimensions and Weights:</p>
      <table className="report-table report-specimen-table">
        <thead>
          <tr>
            <th>No.</th>
            <th>{ageLabel}</th>
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
                <td>{textValue(values.testAge || values.sampleAge)}</td>
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
  if (!rows.length) return null;
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
          {rows.map((row, index) => {
            const values = typeof row === "object" && row !== null
              ? row as Record<string, unknown> : {};
            return (
              <tr key={index}>
                <td>{textValue(values.rowNo, String(index + 1))}</td>
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
  const criteria = Array.isArray(evaluation.criteria) ? evaluation.criteria : [];
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
  const configuredStandards = standards
    .filter((standard) => standard.testType === record.testType)
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

  const isBlocks = record.testType === "Blocks";
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

function SieveStandardsTable({
  standards,
  record,
}: {
  standards: SieveStandard[];
  record: QcRecord;
}) {
  const matchingStandards = standards
    .filter(
      (standard) =>
        standard.testType === record.testType &&
        matchesText(standard.material, record.material),
    )
    .sort((left, right) => left.id - right.id);

  if (!matchingStandards.length) return null;

  return (
    <div className="report-standard-block report-sieve-standard-block">
      <p className="report-centered-title">
        Applicable Sieve Standard: {matchingStandards[0].standardReference}
      </p>
      <table className="report-table report-strength-table">
        <thead>
          <tr>
            <th>SIEVE / PORE SIZE</th>
            <th>LIMIT</th>
            <th>MEASUREMENT</th>
          </tr>
        </thead>
        <tbody>
          {matchingStandards.map((standard) => (
            <tr key={standard.id}>
              <td>{standard.sieveSize}</td>
              <td>
                {standard.minimum == null ? "—" : formatNumber(standard.minimum)} to{" "}
                {standard.maximum == null ? "—" : formatNumber(standard.maximum)}{" "}
                {standard.unit}
              </td>
              <td>{standard.measurementType === "amount" ? "Amount" : "Percentage"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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
}: {
  record: QcRecord;
  standards: StrengthStandard[];
}) {
  const details = record.details;
  const strengthEvaluation =
    typeof details.strengthEvaluation === "object" && details.strengthEvaluation !== null
      ? details.strengthEvaluation as Record<string, unknown>
      : null;
  const designStrength = detailValue(
    details,
    ["designStrength", "mixStrength", "mixType"],
    record.material,
  );
  const strengthNumber = numericStrength(designStrength);
  const sevenDayStrength = detailValue(
    details,
    ["sevenDayStrength", "strength7Days", "avg3To5Days", "average3To5Days"],
    strengthNumber ? `${(strengthNumber * 0.7).toFixed(1)} N/mm²` : "-",
  );
  const twentyEightDayStrength = detailValue(
    details,
    [
      "twentyEightDayStrength",
      "strength28Days",
      "avg28To29Days",
      "average28To29Days",
      "compressiveStrength",
    ],
    "-",
  );
  const compliance = detailValue(
    details,
    ["compliance", "complianceStatus"],
    String(strengthEvaluation?.status ?? record.status),
  );
  const testRows = Array.isArray(details.testRows)
    ? details.testRows
    : [
        {
          testingDate: formatReportDate(record.sampleDate),
          cubeAge: detailValue(details, ["cubeAge", "age"]),
          density: detailValue(details, ["density", "densityKgM3"]),
          load: detailValue(details, ["load"]),
          strength: detailValue(details, ["strength", "compressiveStrength"]),
          waterAbsorption: detailValue(details, ["waterAbsorption", "absorption"]),
        },
      ];

  return (
    <>
      <div className="report-two-column">
        <section>
          <SectionHeading>Customer and Mix Details</SectionHeading>
          <div className="report-fields">
            <ReportField
              label="Customer Name"
              value={detailValue(
                details,
                ["customerName", "customer"],
                record.location,
              )}
            />
            <ReportField
              label="Location"
              value={detailValue(details, ["customerLocation"], record.location)}
            />
            <ReportField
              label="Mix Type"
              value={detailValue(details, ["mixType"], designStrength)}
            />
            <ReportField
              label="Project Name"
              value={detailValue(details, ["projectName", "project"])}
            />
            <ReportField
              label="Other Details"
              value={detailValue(
                details,
                ["otherDetails", "remarks"],
                record.remarks || "-",
              )}
            />
          </div>
        </section>
        <section className="report-summary">
          <SectionHeading>Average Strength</SectionHeading>
          <ReportField
            label="3-5 Days"
            value={detailValue(details, ["avg3To5Days", "average3To5Days"])}
          />
          <ReportField
            label="6-7 Days"
            value={detailValue(
              details,
              ["avg6To7Days", "average6To7Days"],
              sevenDayStrength,
            )}
          />
          <ReportField
            label="28-29 Days"
            value={detailValue(
              details,
              ["avg28To29Days", "average28To29Days"],
              twentyEightDayStrength,
            )}
          />
          <p className="report-subheading">28-29 Days Compliance with BS</p>
          <p className="report-centered-value">{compliance}</p>
        </section>
      </div>

      <div className="report-two-column report-test-details">
        <section>
          <SectionHeading>Test Details</SectionHeading>
          <div className="report-fields">
            <ReportField
              label="Casting Date"
              value={detailValue(
                details,
                ["castingDate", "castDate"],
                formatReportDate(record.sampleDate),
              )}
            />
            <ReportField label="Casted by" value={record.testedBy} />
            <ReportField
              label="Cube Size (mm)"
              value={detailValue(details, ["cubeSize", "sampleSize"])}
            />
            <ReportField
              label="Sample No."
              value={detailValue(details, ["sampleNo", "sampleNumber"], record.recordNo)}
            />
          </div>
        </section>
        <div className="report-fields report-test-measures">
          <ReportField
            label="Slump Test (mm)"
            value={detailValue(details, ["slump", "slumpTest"])}
          />
          <ReportField
            label="Temperature"
            value={detailValue(details, ["temperature"])}
          />
          <ReportField
            label="Compaction Type"
            value={detailValue(details, ["compactionType"], "Hand Compaction")}
          />
        </div>
      </div>

      <table className="report-table report-results-table">
        <thead>
          <tr>
            <th>Testing date</th>
            <th>Cube Age</th>
            <th>Density (kg/m3)</th>
            <th>Load (kN)</th>
            <th>Strength (N/mm2)</th>
            <th>Water Absorption%</th>
          </tr>
        </thead>
        <tbody>
          {testRows.map((row, index) => {
            const values =
              typeof row === "object" && row !== null
                ? (row as Record<string, unknown>)
                : {};
            return (
              <tr key={index}>
                <td>
                  {textValue(
                    values.testingDate || values.date,
                    formatReportDate(record.sampleDate),
                  )}
                </td>
                <td>{textValue(values.cubeAge || values.age)}</td>
                <td>{textValue(values.density || values.densityKgM3)}</td>
                <td>{textValue(values.load)}</td>
                <td>
                  {textValue(values.strength || values.compressiveStrength)}
                </td>
                <td>
                  {textValue(values.waterAbsorption || values.absorption)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <SpecimenRowsTable rows={testRows} ageLabel="Test Age" />

      <StrengthStandardsTable
        record={record}
        standards={standards}
        evaluation={strengthEvaluation}
      />
    </>
  );
}

function RecordContextFields({ record }: { record: QcRecord }) {
  return (
    <ReportFields
      entries={[
        ["Sample Date", formatReportDate(record.sampleDate)],
        ["Location", record.location],
        ["Material", record.material],
        ["Tested By", record.testedBy],
      ]}
    />
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
  return (
    <>
      <div className="report-two-column">
        <section>
          <SectionHeading>Block Details</SectionHeading>
          <ReportFields
            entries={[
              ["Block Type", detailValue(details, ["blockType"], record.material)],
              ["Block Size (mm)", detailValue(details, ["blockSize"])],
              ["Block No.", detailValue(details, ["blockNo", "blockNumber"])],
              ["Machine", detailValue(details, ["machine"])],
              ["Sample Date", formatReportDate(record.sampleDate)],
            ]}
          />
        </section>
        <section className="report-summary">
          <SectionHeading>Test Result</SectionHeading>
          <ReportFields
            entries={[
              ["Strength", detailValue(details, ["strength", "compressiveStrength"])],
              ["Shape Factor", detailValue(details, ["shapeFactor"])],
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

      <SpecimenRowsTable rows={testRows} ageLabel="Sample Age" />
      <StrengthStandardsTable record={record} standards={standards} evaluation={evaluation} />
    </>
  );
}

function SieveReport({
  record,
  standards,
}: {
  record: QcRecord;
  standards: SieveStandard[];
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
      <SieveStandardsTable standards={standards} record={record} />
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
  const configuredStandard =
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
        <Button onClick={() => window.print()} className="gap-2">
          <Printer className="w-4 h-4" /> Print Certificate
        </Button>
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
          <ReadyMixReport record={record} standards={strengthStandards} />
        ) : record.testType === "Blocks" ? (
          <BlocksReport record={record} standards={strengthStandards} />
        ) : record.testType === "Sand Sieve" || record.testType === "Aggregate Sieve" ? (
          <SieveReport record={record} standards={sieveStandards} />
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