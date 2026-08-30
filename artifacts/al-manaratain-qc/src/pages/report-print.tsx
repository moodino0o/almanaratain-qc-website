import { useParams, Link } from "wouter";
import { useGetReport } from "@workspace/api-client-react";
import type { QcRecord } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer } from "lucide-react";

type DetailMap = QcRecord["details"];

const keyLabel = (key: string) =>
  key
    .replace(/([A-Z])/g, " $1")
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .trim();

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

function ReadyMixReport({ record }: { record: QcRecord }) {
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
              label="Customer Location"
              value={detailValue(details, ["customerLocation"], "-")}
            />
            <ReportField label="Plant / Production Location" value={record.location} />
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
              label="Applicable BS"
              value={textValue(strengthEvaluation?.bsStandard)}
            />
            <ReportField
              label="Required Minimum"
              value={
                strengthEvaluation?.requiredStrength == null
                  ? "-"
                  : `${textValue(strengthEvaluation.requiredStrength)} ${textValue(strengthEvaluation.strengthUnit, "N/mm²")}`
              }
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

      <div className="report-strength-block">
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
            <tr>
              <td>{designStrength}</td>
              <td>{sevenDayStrength}</td>
              <td>{twentyEightDayStrength}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}

function GenericReport({ record }: { record: QcRecord }) {
  const entries = Object.entries(record.details).filter(
    ([key]) => key !== "testRows" && key !== "strengthEvaluation",
  );
  const testRows = Array.isArray(record.details.testRows) ? record.details.testRows : [];
  const strengthEvaluation =
    typeof record.details.strengthEvaluation === "object" && record.details.strengthEvaluation !== null
      ? record.details.strengthEvaluation as Record<string, unknown>
      : null;
  return (
    <section>
      <SectionHeading>{record.testType} Details</SectionHeading>
      <div className="report-generic-grid">
        <ReportField label="Sample Date" value={formatReportDate(record.sampleDate)} />
        <ReportField label="Location" value={record.location} />
        <ReportField label="Material" value={record.material} />
        <ReportField label="Tested By" value={record.testedBy} />
        {strengthEvaluation && (
          <>
            <ReportField label="Applicable BS" value={textValue(strengthEvaluation.bsStandard)} />
            <ReportField
              label="Required Minimum"
              value={
                strengthEvaluation.requiredStrength == null
                  ? "-"
                  : `${textValue(strengthEvaluation.requiredStrength)} ${textValue(strengthEvaluation.strengthUnit, "N/mm²")}`
              }
            />
            <ReportField label="Automatic Evaluation" value={textValue(strengthEvaluation.status)} />
          </>
        )}
        {entries.map(([key, value]) => (
          <ReportField key={key} label={keyLabel(key)} value={textValue(value)} />
        ))}
      </div>
      <SpecimenRowsTable rows={testRows} ageLabel={record.testType === "Blocks" ? "Sample Age" : "Test Age"} />
    </section>
  );
}

export default function ReportPrint() {
  const { id } = useParams();
  const reportId = Number(id);
  const { data: report, isLoading, error } = useGetReport(reportId);

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
  const configuredStandard =
    typeof record.details.strengthEvaluation === "object" && record.details.strengthEvaluation !== null
      ? (record.details.strengthEvaluation as Record<string, unknown>).bsStandard
      : null;

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
          {record.testType === "Ready Mix"
            ? configuredStandard
              ? `ACCORDING TO ${String(configuredStandard)}`
              : "ACCORDING TO BS EN 12390-3:2009"
            : "QUALITY CONTROL TEST REPORT"}
        </p>

        {record.testType === "Ready Mix" ? (
          <ReadyMixReport record={record} />
        ) : (
          <GenericReport record={record} />
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