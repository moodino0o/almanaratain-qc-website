import { useParams, Link, useLocation } from "wouter";
import { useGetRecord, useUpdateRecord, useDeleteRecord, RecordStatus } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate, formatDateTime } from "@/lib/utils";
import { CheckCircle2, AlertTriangle, XCircle, ArrowLeft, Printer, Trash2, Edit2, Check, X, Clock3 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@workspace/replit-auth-web";
import { useQueryClient } from "@tanstack/react-query";
import { getListRecordsQueryKey, getGetDashboardQueryKey, getGetRecordQueryKey } from "@workspace/api-client-react";
import { Fragment, useState } from "react";
import { useAppBack } from "@/hooks/use-app-back";
import {
  AGGREGATE_CHLORIDE_LIMIT_PERCENT,
  AGGREGATE_CHEMISTRY_FIELDS,
  AGGREGATE_SULPHATE_LIMIT_PERCENT,
  blockAirDryRowStrength,
  isDammamBlockLocation,
  isSandwichBlockType,
  calculateCubeDensity,
  cubeWeightInGrams,
  calculateRetainedPercentage,
  calculateSieveSampleWeight,
  calculateChlorideContent,
  calculateMoistureContent,
  calculateSiltContent,
  calculateSulphateContent,
  evaluateContentAgainstLimit,
  evaluateSiltContent,
  getDammamBlockThicknessDefaults,
  findSieveEvaluationCriterion,
  PRECAST_AGE_STRENGTH_CRITERIA,
  precastAgeStrengthSummary,
  precastStrengthOutcome,
  SIEVE_SILT_LIMIT_PERCENT,
  sortSieveRowsByPoreSize,
  cubeRowStrength as getCubeRowStrength,
} from "./record-form-utils";
import {
  dammamBlockDisplayResults,
  summarizeDammamBlockAirDryStrengths,
  summarizeDammamBlockNetStrengths,
} from "./record-detail-utils";

function calculatedWaterAbsorption(values: Record<string, unknown>) {
  const dryWeight = Number(values.dryWeight);
  const wetWeight = Number(values.wetWeight);
  if (!Number.isFinite(dryWeight) || !Number.isFinite(wetWeight) || dryWeight <= 0) {
    return String(values.waterAbsorption ?? "-");
  }
  return (((wetWeight - dryWeight) / dryWeight) * 100).toFixed(2);
}

type DetailMap = Record<string, unknown>;

function displayValue(value: unknown, fallback = "—") {
  return value === undefined || value === null || value === "" ? fallback : String(value);
}

function ageDerivedTestingDate(sampleDate: string, ageValue: unknown) {
  const ageText = String(ageValue ?? "").trim();
  const age = ageText ? Number(ageText) : Number.NaN;
  if (!Number.isSafeInteger(age) || age < 0) return null;
  const sampleDay = sampleDate.slice(0, 10);
  const date = new Date(`${sampleDay}T00:00:00.000Z`);
  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== sampleDay
  ) return null;
  date.setUTCDate(date.getUTCDate() + age);
  return date.toISOString();
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
  const age = Number.parseFloat(String(rawAge).replace(/,/g, ""));
  return Number.isFinite(age) ? age : null;
}

function cubeRowStrength(row: unknown) {
  const values = typeof row === "object" && row !== null
    ? row as Record<string, unknown>
    : {};
  const strength = Number.parseFloat(String(
    values.calculatedStrength ?? values.strength ?? values.compressiveStrength ?? "",
  ));
  return Number.isFinite(strength) ? strength : null;
}

function averageStrengthForAge(rows: unknown[], age: number) {
  const strengths = rows
    .filter((row) => cubeRowAge(row) === age)
    .map(cubeRowStrength)
    .filter((strength): strength is number => strength !== null);
  if (!strengths.length) return null;
  return strengths.reduce((total, strength) => total + strength, 0) / strengths.length;
}

function strengthSummary(
  rows: unknown[],
  strengthForRow: (row: unknown) => number | null = cubeRowStrength,
) {
  const strengths = rows
    .map(strengthForRow)
    .filter((strength): strength is number => strength !== null);
  if (!strengths.length) return { average: null, minimum: null, maximum: null };
  return {
    average: strengths.reduce((total, strength) => total + strength, 0) / strengths.length,
    minimum: Math.min(...strengths),
    maximum: Math.max(...strengths),
  };
}

function formatStrengthMetric(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toFixed(2) : "—";
}

function formatBlockNetArea(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0
    ? Math.round(parsed).toLocaleString("en-US")
    : "—";
}

function formatAverageStrength(value: number | null) {
  if (value === null) return "—";
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function CubeAgeAveragesTable({ rows }: { rows: unknown[] }) {
  const ages = [...new Set(
    rows
      .map(cubeRowAge)
      .filter((age): age is number => age !== null),
  )].sort((left, right) => left - right);

  if (!ages.length) return null;

  return (
    <div className="flex justify-center overflow-x-auto border-t bg-muted/10 p-4">
      <table className="w-full max-w-md text-xs">
        <thead className="bg-muted/30">
          <tr className="border-b">
            <th className="p-2 text-center">Test Age</th>
            <th className="p-2 text-center">Average Strength (N/mm²)</th>
          </tr>
        </thead>
        <tbody>
          {ages.map((age) => (
            <tr key={age} className="border-b last:border-b-0">
              <td className="p-2 text-center font-semibold">{age} days</td>
              <td className="p-2 text-center font-bold">
                {formatAverageStrength(averageStrengthForAge(rows, age))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DetailSummaryTable({ entries }: { entries: ReadonlyArray<readonly [string, unknown]> }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <tbody>
          {entries.map(([label, value]) => (
            <tr key={label} className="border-b last:border-b-0">
              <th className="w-[30%] bg-muted/20 p-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {label}
              </th>
              <td className="p-3 font-medium text-foreground">{displayValue(value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MeasurementTable({
  title,
  entries,
}: {
  title: string;
  entries: ReadonlyArray<readonly [string, unknown]>;
}) {
  return (
    <Card>
      <CardHeader className="bg-muted/30 border-b">
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <DetailSummaryTable entries={entries} />
      </CardContent>
    </Card>
  );
}

function CompactMeasurementTable({
  title,
  entries,
}: {
  title: string;
  entries: ReadonlyArray<readonly [string, unknown]>;
}) {
  const groupedEntries = Array.from(
    { length: Math.ceil(entries.length / 2) },
    (_, index) => entries.slice(index * 2, index * 2 + 2),
  );

  return (
    <Card>
      <CardHeader className="bg-muted/30 border-b">
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] table-fixed text-xs">
            <tbody>
              {groupedEntries.map((group, index) => (
                <tr key={group[0]?.[0] ?? index} className="border-b last:border-b-0">
                  {group.map(([label, value]) => (
                    <Fragment key={label}>
                      <th
                        scope="row"
                        className="w-[18%] bg-muted/20 p-2 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
                      >
                        {label}
                      </th>
                      <td className="w-[32%] break-words p-2 text-left font-medium text-foreground">
                        {displayValue(value)}
                      </td>
                    </Fragment>
                  ))}
                  {group.length === 1 && (
                    <td colSpan={2} aria-hidden="true" className="p-2" />
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function TestRowsTable({
  rows,
  includeAbsorption,
  includeAge = true,
  sortByAge = false,
  strengthLabel = "Calculated Strength (N/mm²)",
  areaLabel = "Loaded Face Area (mm²)",
  strengthValueForRow,
  areaValueForRow,
  normalizedValueForRow,
}: {
  rows: unknown[];
  includeAbsorption: boolean;
  includeAge?: boolean;
  sortByAge?: boolean;
  strengthLabel?: string;
  areaLabel?: string;
  strengthValueForRow?: (row: Record<string, unknown>) => unknown;
  areaValueForRow?: (row: Record<string, unknown>) => unknown;
  normalizedValueForRow?: (row: Record<string, unknown>) => unknown;
}) {
  const displayRows = sortByAge ? sortCubeRowsByAge(rows) : rows;
  return (
    <div className="overflow-x-auto">
      <table className={`w-full ${normalizedValueForRow ? "min-w-[1040px]" : includeAbsorption ? "min-w-[1040px]" : "min-w-[900px]"} text-xs`}>
        <thead className="bg-muted/30">
          <tr className="border-b">
            <th className="p-2 text-left">No.</th>
            {includeAge && <th className="p-2 text-left">Age</th>}
            <th className="p-2 text-left">Length (mm)</th>
            <th className="p-2 text-left">Width (mm)</th>
            <th className="p-2 text-left">Height (mm)</th>
            <th className="p-2 text-left">Dry Weight</th>
            <th className="p-2 text-left">Wet Weight</th>
            {includeAbsorption && <th className="p-2 text-left">Water Absorption (%)</th>}
            <th className="p-2 text-left">Load (kN)</th>
            <th className="p-2 text-left">{areaLabel}</th>
            <th className="p-2 text-left">{strengthLabel}</th>
            {normalizedValueForRow && (
              <th className="p-2 text-left">Normalized Strength (N/mm²)</th>
            )}
          </tr>
        </thead>
        <tbody>
          {displayRows.map((row, index) => {
            const values = typeof row === "object" && row !== null
              ? row as Record<string, unknown>
              : {};
            return (
              <tr key={index} className="border-b last:border-b-0">
                <td className="p-2 font-semibold">
                  {sortByAge ? index + 1 : displayValue(values.rowNo, String(index + 1))}
                </td>
                {includeAge && <td className="p-2">{displayValue(values.testAge ?? values.sampleAge)}</td>}
                <td className="p-2">{displayValue(values.length)}</td>
                <td className="p-2">{displayValue(values.width)}</td>
                <td className="p-2">{displayValue(values.height)}</td>
                <td className="p-2">{displayValue(values.dryWeight)}</td>
                <td className="p-2">{displayValue(values.wetWeight)}</td>
                {includeAbsorption && <td className="p-2">{calculatedWaterAbsorption(values)}</td>}
                <td className="p-2">{displayValue(values.load)}</td>
                <td className="p-2">
                  {displayValue(
                    areaValueForRow ? areaValueForRow(values) : values.loadedFaceArea,
                  )}
                </td>
                <td className="p-2 font-semibold">
                  {displayValue(
                    strengthValueForRow
                      ? strengthValueForRow(values)
                      : values.tensileStrength ??
                          values.correctedStrength ??
                          values.calculatedStrength ??
                          values.strength ??
                          values.compressiveStrength,
                  )}
                </td>
                {normalizedValueForRow && (
                  <td className="p-2 font-semibold">
                    {displayValue(normalizedValueForRow(values))}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SieveRowsTable({
  rows,
  evaluation,
}: {
  rows: unknown[];
  evaluation: unknown;
}) {
  const measuredRows = rows.filter((row) => {
    const values = typeof row === "object" && row !== null
      ? row as Record<string, unknown>
      : {};
    const hasSize = String(values.sieveSize ?? "").trim().length > 0;
    const hasEnteredMass = values.amountReturned !== null &&
      values.amountReturned !== undefined &&
      String(values.amountReturned).trim().length > 0;
    return hasSize && hasEnteredMass;
  });
  const orderedRows = sortSieveRowsByPoreSize(measuredRows, (row) => {
    if (typeof row !== "object" || row === null) return "";
    return (row as Record<string, unknown>).sieveSize;
  });
  if (!orderedRows.length) {
    return (
      <p className="p-6 text-center text-muted-foreground">
        No sieve measurements recorded.
      </p>
    );
  }
  const sampleWeight = calculateSieveSampleWeight(
    orderedRows.map((row) => {
      const values = typeof row === "object" && row !== null
        ? row as Record<string, unknown>
        : {};
      return { amountReturned: String(values.amountReturned ?? "") };
    }),
  );
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1040px] text-xs">
        <thead className="bg-muted/30">
          <tr className="border-b">
            <th className="p-2 text-left">No.</th>
            <th className="p-2 text-left">Sieve / Pore Size</th>
            <th className="p-2 text-left">Mass Retained (g)</th>
            <th className="p-2 text-left">Retained (%)</th>
            <th className="p-2 text-left">Passing (%)</th>
            <th className="p-2 text-left">Lower Limit</th>
            <th className="p-2 text-left">Upper Limit</th>
            <th className="p-2 text-left">Remarks</th>
          </tr>
        </thead>
        <tbody>
          {orderedRows.map((row, index) => {
            const values = typeof row === "object" && row !== null
              ? row as Record<string, unknown>
              : {};
            const criterion = findSieveEvaluationCriterion(
              evaluation,
              values.sieveSize,
            );
            const result = criterion?.withinLimits === true
              ? "Pass"
              : criterion?.withinLimits === false
                ? "Fail"
                : criterion
                  ? "Pending"
                  : "—";
            const limitUnit = displayValue(criterion?.unit, "");
            return (
              <tr key={index} className="border-b last:border-b-0">
                <td className="p-2 font-semibold">{index + 1}</td>
                <td className="p-2">{displayValue(values.sieveSize)}</td>
                <td className="p-2">{displayValue(values.amountReturned)}</td>
                <td className="p-2">
                  {calculateRetainedPercentage(values.amountReturned, sampleWeight) || "—"}
                </td>
                <td className="p-2">{displayValue(values.passingPercentage)}</td>
                <td className="p-2">
                  {criterion?.minimum == null
                    ? "—"
                    : `${displayValue(criterion.minimum)}${limitUnit ? ` ${limitUnit}` : ""}`}
                </td>
                <td className="p-2">
                  {criterion?.maximum == null
                    ? "—"
                    : `${displayValue(criterion.maximum)}${limitUnit ? ` ${limitUnit}` : ""}`}
                </td>
                <td
                  className={
                    result === "Pass"
                      ? "p-2 font-semibold text-green-700"
                      : result === "Fail"
                        ? "p-2 font-semibold text-red-700"
                        : "p-2 text-muted-foreground"
                  }
                >
                  {result}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function StrengthEvaluation({
  value,
  strengthName = "strength",
}: {
  value: unknown;
  strengthName?: string;
}) {
  if (typeof value !== "object" || value === null) {
    return (
      <span className="text-muted-foreground">
        No automatic evaluation has been recorded for this historical record.
      </span>
    );
  }
  const evaluation = value as Record<string, unknown>;
  const storedStatus = String(evaluation.status ?? "Review");
  const status = storedStatus === "Waiting for results" ? "Waiting" : storedStatus;
  const statusClass =
    status === RecordStatus.Passed
      ? "text-success"
      : status === RecordStatus.Failed
        ? "text-destructive"
        : status === "Waiting"
          ? "text-lime-700 dark:text-lime-300"
        : "text-warning";
  return (
    <div className="space-y-1">
      <p className={`font-bold ${statusClass}`}>{status}</p>
      {evaluation.averageStrength != null && (
        <>
          <p>Average {strengthName}: {formatStrengthMetric(evaluation.averageStrength)} {String(evaluation.strengthUnit ?? "N/mm²")}</p>
          <p>Minimum {strengthName}: {formatStrengthMetric(evaluation.minimumStrength)} {String(evaluation.strengthUnit ?? "N/mm²")}</p>
          <p>Maximum {strengthName}: {formatStrengthMetric(evaluation.maximumStrength)} {String(evaluation.strengthUnit ?? "N/mm²")}</p>
        </>
      )}
      <p>
        Minimum: {evaluation.requiredStrength == null
          ? "Not configured"
          : `${evaluation.requiredStrength} ${String(evaluation.strengthUnit ?? "N/mm²")}`}
      </p>
      <p>BS reference: {String(evaluation.bsStandard ?? "Not configured")}</p>
      {evaluation.reason != null && (
        <p className="text-muted-foreground">{String(evaluation.reason)}</p>
      )}
    </div>
  );
}

function detailText(details: Record<string, unknown>, key: string, fallback = "—") {
  const normalizedKey = key.toLocaleLowerCase();
  const value = Object.entries(details).find(([candidate]) => candidate.toLocaleLowerCase() === normalizedKey)?.[1];
  return value === undefined || value === null || value === "" ? fallback : String(value);
}

function SieveEvaluation({ value }: { value: unknown }) {
  if (typeof value !== "object" || value === null) {
    return <span className="text-muted-foreground">No automatic sieve evaluation has been recorded.</span>;
  }
  const evaluation = value as Record<string, unknown>;
  const status = String(evaluation.status ?? "Review");
  const criteria = Array.isArray(evaluation.criteria) ? evaluation.criteria : [];
  const statusClass =
    status === RecordStatus.Passed ? "text-success" :
      status === RecordStatus.Failed ? "text-destructive" : "text-warning";
  return (
    <div className="space-y-3">
      <p className={`font-bold ${statusClass}`}>{status}</p>
      <p>Reference: {String(evaluation.standardReference ?? "Not configured")}</p>
      {evaluation.reason != null && <p className="text-muted-foreground">{String(evaluation.reason)}</p>}
      {criteria.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-xs">
            <thead className="bg-muted/30"><tr className="border-b">
              <th className="p-2 text-left">Sieve / Pore Size</th>
              <th className="p-2 text-left">Measured</th>
              <th className="p-2 text-left">Allowed Range</th>
              <th className="p-2 text-left">Result</th>
            </tr></thead>
            <tbody>
              {criteria.map((criterion, index) => {
                const item = typeof criterion === "object" && criterion !== null
                  ? criterion as Record<string, unknown> : {};
                const within = item.withinLimits;
                return <tr key={index} className="border-b last:border-b-0">
                  <td className="p-2">{String(item.sieveSize ?? "-")}</td>
                  <td className="p-2">{item.measuredValue == null ? "Missing" : `${item.measuredValue} ${String(item.unit ?? "")}`}</td>
                  <td className="p-2">{item.minimum == null ? "—" : String(item.minimum)} to {item.maximum == null ? "—" : String(item.maximum)} {String(item.unit ?? "")}</td>
                  <td className={`p-2 font-semibold ${within === true ? "text-success" : within === false ? "text-destructive" : "text-warning"}`}>
                    {within === true ? "Pass" : within === false ? "Fail" : "Review"}
                  </td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function RecordDetail() {
  const { id } = useParams();
  const { role } = useAuth();
  const canEditQc = role === "technician" || role === "managerial" || role === "administrator";
  const canEditApprovedBy = role === "administrator";
  const recordId = Number(id);
  const [, setLocation] = useLocation();
  const goBack = useAppBack("/records");
  const queryClient = useQueryClient();
  const [isDeleting, setIsDeleting] = useState(false);

  const { data: record, isLoading, error } = useGetRecord(recordId);
  const updateRecord = useUpdateRecord();
  const deleteRecord = useDeleteRecord();

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Loading record details...</div>;
  if (error || !record) return <div className="p-8 text-center text-destructive">Failed to load record.</div>;

  const handleStatusUpdate = (status: RecordStatus) => {
    updateRecord.mutate({
      id: recordId,
      data: {
        status,
        ...(canEditApprovedBy ? { reviewedBy: record.reviewedBy || "ADEL ABBAS EBRAHIM" } : {}),
      },
    }, {
      onSuccess: () => {
        toast.success(`Record marked as ${status}.`);
        queryClient.invalidateQueries({ queryKey: getGetRecordQueryKey(recordId) });
        queryClient.invalidateQueries({ queryKey: getListRecordsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
      },
      onError: () => {
        toast.error("Failed to update status.");
      }
    });
  };

  const isStrengthEvaluated = record.testType === "Ready Mix" || record.testType === "Blocks";
  const isSieveEvaluated = record.testType === "Sand Sieve" || record.testType === "Aggregate Sieve";
  const recordDetails = record.details as DetailMap;
  const isSieveRecord = isSieveEvaluated;
  const ageKey = record.testType === "Blocks" || record.testType === "Paving Blocks"
    ? "blockAge"
    : "sampleAge";
  const configuredAge = Number(String(recordDetails[ageKey] ?? "").trim());
  const legacyRows = Array.isArray(recordDetails.testRows) ? recordDetails.testRows : [];
  const legacyRowAge = legacyRows
    .map((row) => (
      typeof row === "object" && row !== null
        ? (row as Record<string, unknown>).sampleAge
        : undefined
    ))
    .find((value) => Number.isFinite(Number(value)) && Number(value) > 0);
  const ageForDate =
    Number.isFinite(configuredAge) && configuredAge > 0
      ? recordDetails[ageKey]
      : legacyRowAge;
  const calculatedTestingDate = ageDerivedTestingDate(record.sampleDate, ageForDate);
  const summaryEntries: Array<readonly [string, unknown]> = [
    ["Record No.", record.recordNo],
    ["Test Type", record.testType],
    [
      isSieveRecord
        ? "Sampling Date"
        : record.testType === "Precast" || record.testType === "Blocks" || record.testType === "Paving Blocks"
          ? "Casting Date"
          : "Sample Date",
      formatDate(record.sampleDate),
    ],
    [
      isSieveRecord ? "Factory" : record.testType === "Precast" ? "Testing Location" : "Location",
      record.location,
    ],
    [
      isSieveRecord ? "Material Type" : record.testType === "Precast" ? "Product Type" : "Material / Product",
      record.material,
    ],
    [isSieveRecord ? "Sampled-Tested By" : "Tested By", record.testedBy],
    ["Approved By", record.reviewedBy || "ADEL ABBAS EBRAHIM"],
  ];

  if (record.testType === "Ready Mix") {
    summaryEntries.push(
      ["Reference Number", detailText(recordDetails, "referenceNumber")],
      ["Truck Number", detailText(recordDetails, "truckNumber")],
      ["Customer Name", detailText(recordDetails, "customerName", record.location)],
      ["Customer Location", detailText(recordDetails, "customerLocation", record.location)],
    );
  }
  if (record.testType === "Precast") {
    summaryEntries.push(
      ["Sample No.", detailText(recordDetails, "sampleNo")],
      ["Precast Mould No.", detailText(recordDetails, "precastMouldNo")],
      ["Job No.", detailText(recordDetails, "jobNo")],
      ["Customer Name", detailText(recordDetails, "customerName")],
      ["Cube Size", detailText(recordDetails, "cubeSize", "100*100*100")],
      ["Compaction", detailText(recordDetails, "compactionType", "Mechanical compaction")],
    );
  }
  if (record.testType === "Blocks" || record.testType === "Paving Blocks") {
    summaryEntries.push(
      ["Block Type", detailText(recordDetails, "blockType", record.material)],
      ["Block Size", detailText(recordDetails, "blockSize")],
      ["Block Age (days)", detailText(recordDetails, "blockAge")],
      ["Testing Date", calculatedTestingDate ? formatDate(calculatedTestingDate) : detailText(recordDetails, "testingDate")],
      ["Machine", detailText(recordDetails, "machine")],
    );
  }
  if (record.testType === "Water") {
    summaryEntries.push(["Source", detailText(recordDetails, "source")]);
  }
  const testRows = Array.isArray(recordDetails.testRows) ? recordDetails.testRows : [];
  const hasLegacySpecimen = ["length", "width", "height", "dryWeight", "wetWeight", "load", "loadedFaceArea", "calculatedStrength"]
    .some((key) => recordDetails[key] !== undefined && recordDetails[key] !== "");
  const specimenRows = testRows.length > 0
    ? testRows
    : hasLegacySpecimen
      ? [recordDetails]
      : [];
  const sieveRows = Array.isArray(recordDetails.sieveRows) ? recordDetails.sieveRows : [];
  const strengthEvaluation = typeof recordDetails.strengthEvaluation === "object" &&
    recordDetails.strengthEvaluation !== null
    ? recordDetails.strengthEvaluation as Record<string, unknown>
    : {};
  const isDammamBlock =
    record.testType === "Blocks" && isDammamBlockLocation(record.location);
  const isDammamSandwich =
    isDammamBlock && isSandwichBlockType(recordDetails.blockType);
  const blockStrengthSummary = isDammamBlock
    ? isDammamSandwich
      ? summarizeDammamBlockAirDryStrengths(specimenRows, recordDetails.blockSize, recordDetails)
      : summarizeDammamBlockNetStrengths(specimenRows, recordDetails.blockSize, recordDetails)
    : strengthSummary(
        specimenRows,
        (row) => blockAirDryRowStrength(row, record.location),
      );
  const strengthEvaluationForDisplay = isDammamBlock
    ? {
        ...strengthEvaluation,
        averageStrength: blockStrengthSummary.average,
        minimumStrength: blockStrengthSummary.minimum,
        maximumStrength: blockStrengthSummary.maximum,
      }
    : recordDetails.strengthEvaluation;

  const handleDelete = () => {
    if (!confirm("Are you sure you want to delete this record? This action cannot be undone.")) return;
    setIsDeleting(true);
    deleteRecord.mutate({ id: recordId }, {
      onSuccess: () => {
        toast.success("Record Deleted");
        queryClient.invalidateQueries({ queryKey: getListRecordsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
        queryClient.removeQueries({ queryKey: getGetRecordQueryKey(recordId) });
        setLocation("/records");
      },
      onError: () => {
        toast.error("Failed to delete record.");
        setIsDeleting(false);
      }
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case RecordStatus.Passed: return <Badge variant="success" className="text-sm px-3 py-1"><CheckCircle2 className="w-4 h-4 mr-1.5" /> Passed</Badge>;
      case RecordStatus.Review: return <Badge variant="warning" className="text-sm px-3 py-1"><AlertTriangle className="w-4 h-4 mr-1.5" /> Review Required</Badge>;
      case RecordStatus.Failed: return <Badge variant="destructive" className="text-sm px-3 py-1"><XCircle className="w-4 h-4 mr-1.5" /> Failed</Badge>;
      case "Waiting for results": return <Badge variant="outline" className="border-lime-300 bg-lime-100 px-3 py-1 text-sm text-lime-800 dark:border-lime-700 dark:bg-lime-950 dark:text-lime-200"><Clock3 className="mr-1.5 h-4 w-4" /> Waiting</Badge>;
      default: return <Badge variant="secondary" className="text-sm px-3 py-1">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button type="button" onClick={goBack} aria-label="Go back" className="p-2 rounded-md hover:bg-muted transition-colors">
            <ArrowLeft className="w-5 h-5 text-muted-foreground" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight text-foreground">{record.recordNo}</h1>
              {getStatusBadge(record.status)}
            </div>
            <p className="text-muted-foreground text-sm mt-1">{record.testType} Quality Control Record</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Added by {record.createdBy?.trim() || "Not recorded"} ·{" "}
              {formatDateTime(record.createdAt)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canEditQc && (
            <Link
              href={`/records/${recordId}/edit`}
              className="inline-flex h-10 items-center justify-center whitespace-nowrap rounded-md border border-input bg-background px-4 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <Edit2 className="w-4 h-4 mr-2" />
              Edit
            </Link>
          )}
          <Link
            href={`/reports/${recordId}`}
            className="inline-flex h-10 items-center justify-center whitespace-nowrap rounded-md border border-input bg-background px-4 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <Printer className="w-4 h-4 mr-2" />
            Print
          </Link>
          {canEditQc && (
            <Button variant="outline" onClick={handleDelete} disabled={isDeleting} className="text-destructive hover:bg-destructive hover:text-white border-destructive/20">
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
          )}
        </div>
      </div>

      <Card className="border-t-4 border-t-primary">
        <CardHeader className="bg-muted/30 border-b">
          <CardTitle>Record Information</CardTitle>
          <CardDescription>Sample, material, and test context.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <DetailSummaryTable entries={summaryEntries} />
        </CardContent>
      </Card>

      {isSieveEvaluated && (() => {
        const dryWeight = recordDetails.dryWeight ?? recordDetails.drySample;
        const wetWeight = recordDetails.wetWeight ?? recordDetails.wetSample;
        const moistureContent = calculateMoistureContent(dryWeight, wetWeight);
        const siltContent = calculateSiltContent(
          recordDetails.siltBefore,
          recordDetails.siltAfter,
        );
        const chlorideContent = calculateChlorideContent(
          recordDetails.silverNitrateContent,
          recordDetails.firstChlorideTitrationPoint,
          recordDetails.secondChlorideTitrationPoint,
        );
        const sulphateContent = calculateSulphateContent(
          recordDetails.crucibleWeight,
          recordDetails.crucibleAshWeight,
        );
        return (
          <>
            <CompactMeasurementTable
              title="Sieve, Moisture and Chemical Test Details"
              entries={[
              ["Sample Weight", detailText(recordDetails, "sampleWeight")],
              [
                "Material Condition",
                detailText(
                  recordDetails,
                  "materialCondition",
                  detailText(recordDetails, "condition"),
                ),
              ],
              ["Supplier", detailText(recordDetails, "supplier")],
              ["Age (days)", detailText(recordDetails, "sampleAge")],
              ["Testing Date", calculatedTestingDate ? formatDate(calculatedTestingDate) : detailText(recordDetails, "testingDate")],
              [
                "Dry Weight (g)",
                detailText(recordDetails, "dryWeight", detailText(recordDetails, "drySample")),
              ],
              [
                "Wet Weight (g)",
                detailText(recordDetails, "wetWeight", detailText(recordDetails, "wetSample")),
              ],
              [
                "Moisture Content (%)",
                moistureContent || "—",
              ],
              ["Fineness Modulus", detailText(recordDetails, "finenessModulus")],
              ["Silt Before", detailText(recordDetails, "siltBefore")],
              ["Silt After", detailText(recordDetails, "siltAfter")],
              [
                "Silt Content (%)",
                siltContent === null ? "—" : `${siltContent.toFixed(2)}%`,
              ],
              ["Silt Limit", `< ${SIEVE_SILT_LIMIT_PERCENT}%`],
              ["Silt Result", evaluateSiltContent(siltContent)],
              [
                "Chloride Content",
                chlorideContent === null ? "—" : `${chlorideContent.toFixed(3)}%`,
              ],
              [
                "Chloride Standard",
                `${AGGREGATE_CHLORIDE_LIMIT_PERCENT.toFixed(2)}%`,
              ],
              [
                "Chloride Result",
                evaluateContentAgainstLimit(
                  chlorideContent,
                  AGGREGATE_CHLORIDE_LIMIT_PERCENT,
                ),
              ],
              [
                "Sulphate Content",
                sulphateContent === null ? "—" : `${sulphateContent.toFixed(2)}%`,
              ],
              [
                "Sulphate Standard",
                `${AGGREGATE_SULPHATE_LIMIT_PERCENT.toFixed(2)}%`,
              ],
              [
                "Sulphate Result",
                evaluateContentAgainstLimit(
                  sulphateContent,
                  AGGREGATE_SULPHATE_LIMIT_PERCENT,
                ),
              ],
              [
                "Chemical Tested By",
                detailText(recordDetails, "chemicalTestedBy"),
              ],
              ["Chemical Testing Standard", "BS812:Part 117 and 118:1988"],
              ...AGGREGATE_CHEMISTRY_FIELDS.map(
                ({ key, label }) =>
                  [label, detailText(recordDetails, key)] as const,
              ),
              ]}
            />
            <div className="mt-2 space-y-1 text-xs text-muted-foreground">
              <p>
                Retained (%) = retained mass ÷ total retained mass × 100;
                passing mass = sample mass − cumulative retained mass; passing
                (%) = passing mass ÷ sample mass × 100.
              </p>
              <p>
                Moisture (%) = (wet − dry) ÷ dry × 100. Silt (%) = (silt before
                − silt after) ÷ silt before × 100. Chloride (%) = 0.07092 ×
                (silver nitrate content − (10 × 0.1 × (second titration point −
                first titration point))). Sulfate (%) = ((crucible + ash −
                crucible) × 34.3) ÷ 3.
              </p>
            </div>
          </>
        );
      })()}

      {record.testType === "Ready Mix" && (
        <>
          <MeasurementTable
            title="Measurement Details: Ready Mix"
            entries={[
              ["Slump (mm)", detailText(recordDetails, "slump")],
              ["Temperature (°C)", detailText(recordDetails, "temperature")],
            ]}
          />
          <Card>
            <CardHeader className="bg-muted/30 border-b">
              <CardTitle>Specimen Measurements</CardTitle>
              <CardDescription>Concrete cube measurements and calculated strength.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {specimenRows.length > 0
                ? (
                  <>
                    <TestRowsTable rows={specimenRows} includeAbsorption sortByAge />
                    <CubeAgeAveragesTable rows={specimenRows} />
                  </>
                )
                : <p className="p-6 text-center text-muted-foreground">No specimen measurements recorded.</p>}
            </CardContent>
          </Card>
        </>
      )}

      {record.testType === "Precast" && (
        <Card>
          <CardHeader className="bg-muted/30 border-b">
            <CardTitle>Precast Cube Measurements</CardTitle>
            <CardDescription>
              Compression, weight, density, and strength for each cube.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {specimenRows.length ? (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[980px] text-sm">
                    <thead className="bg-muted/50">
                      <tr className="border-b">
                        {["Cube Age (days)", "Cube Size (mm)", "Weight (g)", "Density (kg/m³)", "Load (kN)", "Compressive Strength (N/mm²)"].map((label) => (
                          <th key={label} className="px-3 py-3 text-left font-semibold">{label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sortCubeRowsByAge(specimenRows).map((row, index) => {
                        const values = typeof row === "object" && row !== null
                          ? row as Record<string, unknown>
                          : {};
                        const age = values.testAge ?? values.sampleAge ?? values.cubeAge ?? values.age;
                        const size = detailText(recordDetails, "cubeSize", "100*100*100").replace(/\*/g, " × ");
                        const strength = getCubeRowStrength(row);
                        const hasSavedWeight =
                          values.weight !== undefined &&
                          values.weight !== null &&
                          values.weight !== "";
                        const weight = hasSavedWeight ? values.weight : values.wetWeight;
                        const weightUnit =
                          hasSavedWeight && recordDetails.cubeWeightUnit === "g"
                            ? "g"
                            : "kg";
                        const displayedWeight = cubeWeightInGrams(weight, weightUnit);
                        const calculatedDensity = calculateCubeDensity(
                          detailText(recordDetails, "cubeSize", "100*100*100"),
                          weight,
                          weightUnit,
                        );
                        const density = displayValue(
                          values.density || calculatedDensity,
                          "—",
                        );
                        return (
                          <tr key={index} className="border-b last:border-b-0">
                            <td className="px-3 py-2">{displayValue(age)}</td>
                            <td className="px-3 py-2">{size}</td>
                            <td className="px-3 py-2">{displayValue(displayedWeight)}</td>
                            <td className="px-3 py-2 font-semibold">
                              {density === "—" ? density : `${density} kg/m³`}
                            </td>
                            <td className="px-3 py-2">{displayValue(values.load)}</td>
                            <td className="px-3 py-2 font-semibold">
                              {strength === null ? "—" : formatStrengthMetric(strength)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="grid gap-3 border-t bg-muted/10 p-4 sm:grid-cols-3">
                  {PRECAST_AGE_STRENGTH_CRITERIA.map((criterion) => {
                    const summary = precastAgeStrengthSummary(
                      specimenRows,
                      criterion.age,
                    );
                    const legacyKey =
                      criterion.age === 1
                        ? "averageStrength1Day"
                        : criterion.age === 7
                          ? "averageStrength7Days"
                          : "averageStrength28Days";
                    const legacyAverage = Number(recordDetails[legacyKey]);
                    const averageToDisplay =
                      summary.averageStrength ??
                      (Number.isFinite(legacyAverage) ? legacyAverage : null);
                    const complete =
                      specimenRows.length > 0
                        ? summary.complete
                        : averageToDisplay !== null;
                    const outcome = precastStrengthOutcome(
                      criterion.age,
                      averageToDisplay,
                      complete,
                    );
                    return (
                      <div key={criterion.age} className="rounded-md border bg-background p-3 text-center">
                        <div className="text-xs text-muted-foreground">{criterion.age}-day average strength</div>
                        <div className="mt-1 font-semibold">
                          {averageToDisplay === null
                            ? "—"
                            : `${formatStrengthMetric(averageToDisplay)} N/mm²`}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          Minimum: {criterion.minimumStrength} N/mm²
                        </div>
                        <div className={`mt-2 text-sm font-semibold ${
                          outcome === "Pass" || outcome === "Approved for demolding"
                            ? "text-emerald-700"
                            : outcome === "Pending"
                              ? "text-muted-foreground"
                              : "text-destructive"
                        }`}>
                          {outcome}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <p className="p-6 text-center text-muted-foreground">
                No cube measurements recorded. Legacy average strength fields: 1 day{" "}
                {detailText(recordDetails, "averageStrength1Day")}; 7 days{" "}
                {detailText(recordDetails, "averageStrength7Days")}; 28 days{" "}
                {detailText(recordDetails, "averageStrength28Days")}.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {record.testType === "Blocks" && (
        <>
          <Card>
            <CardHeader className="bg-muted/30 border-b">
              <CardTitle>Specimen Measurements</CardTitle>
              <CardDescription>
                {isDammamBlock
                  ? isDammamSandwich
                    ? "Block sample dimensions, load, Gross Area, Air-dry Strength, and Normalized Strength."
                    : "Block sample dimensions, weights, load, Net Area, and Net Strength."
                  : "Block sample dimensions, weights, load, and air-dry strength."}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {specimenRows.length > 0
                ? (
                  <TestRowsTable
                    rows={specimenRows}
                    includeAbsorption={false}
                    includeAge={false}
                    strengthLabel={isDammamBlock
                      ? isDammamSandwich
                        ? "Air-dry Strength (N/mm²)"
                        : "Net Strength (N/mm²)"
                      : "Air-dry Strength (N/mm²)"}
                    areaLabel={isDammamSandwich ? "Gross Area (mm²)" : "Net Area (mm²)"}
                    areaValueForRow={isDammamBlock
                      ? isDammamSandwich
                        ? (row) => {
                            const results = dammamBlockDisplayResults(
                              row,
                              recordDetails.blockSize,
                              recordDetails,
                            );
                            return results.grossArea === null
                              ? "—"
                              : Math.round(results.grossArea).toLocaleString("en-US");
                          }
                        : (row) => formatBlockNetArea(
                            dammamBlockDisplayResults(row, recordDetails.blockSize, recordDetails).netArea,
                          )
                      : undefined}
                    strengthValueForRow={(row) => isDammamBlock
                      ? formatStrengthMetric(isDammamSandwich
                          ? dammamBlockDisplayResults(
                              row,
                              recordDetails.blockSize,
                              recordDetails,
                            ).airDryStrength
                          : dammamBlockDisplayResults(row, recordDetails.blockSize, recordDetails).netStrength)
                      : blockAirDryRowStrength(row, record.location)}
                    normalizedValueForRow={isDammamSandwich
                      ? (row) => formatStrengthMetric(
                          dammamBlockDisplayResults(
                            row,
                            recordDetails.blockSize,
                            recordDetails,
                          ).normalizedStrength,
                        )
                      : undefined}
                  />
                )
                : <p className="p-6 text-center text-muted-foreground">No specimen measurements recorded.</p>}
            </CardContent>
          </Card>
          <MeasurementTable
            title="Block Test Result"
            entries={[
              ["Block No.", detailText(recordDetails, "blockNo", detailText(recordDetails, "blockNumber"))],
              [
                `Average ${isDammamBlock && !isDammamSandwich ? "Net" : "Air-dry"} Strength (N/mm²)`,
                formatStrengthMetric(
                  isDammamBlock
                    ? blockStrengthSummary.average
                    : strengthEvaluation.averageStrength ?? blockStrengthSummary.average,
                ),
              ],
              [
                    `Minimum ${isDammamBlock && !isDammamSandwich ? "Net" : "Air-dry"} Strength (N/mm²)`,
                formatStrengthMetric(
                  isDammamBlock
                    ? blockStrengthSummary.minimum
                    : blockStrengthSummary.minimum ?? strengthEvaluation.minimumStrength,
                ),
              ],
              [
                    `Maximum ${isDammamBlock && !isDammamSandwich ? "Net" : "Air-dry"} Strength (N/mm²)`,
                formatStrengthMetric(
                  isDammamBlock
                    ? blockStrengthSummary.maximum
                    : blockStrengthSummary.maximum ?? strengthEvaluation.maximumStrength,
                ),
              ],
              ["Shape Factor", detailText(recordDetails, "shapeFactor")],
              ["Compliance", displayValue(strengthEvaluation.status ?? record.status)],
            ]}
          />
        </>
      )}

      {(record.testType === "Sand Sieve" || record.testType === "Aggregate Sieve") && (
        <>
          <Card>
            <CardHeader className="bg-muted/30 border-b">
              <CardTitle>Sieve Measurements</CardTitle>
              <CardDescription>Returned and passing amounts for each sieve or pore size.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {sieveRows.length > 0
                ? (
                  <SieveRowsTable
                    rows={sieveRows}
                    evaluation={recordDetails.sieveEvaluation}
                  />
                )
                : <p className="p-6 text-center text-muted-foreground">No sieve measurements recorded.</p>}
            </CardContent>
          </Card>
        </>
      )}

      {record.testType === "Paving Blocks" && (
        <>
          {specimenRows.length > 0 ? (
            <Card>
              <CardHeader className="bg-muted/30 border-b">
                <CardTitle>Paving Block Specimen Measurements</CardTitle>
                <CardDescription>
                  Saved specimen dimensions, dry and wet weights, load, and
                  calculated tensile strength.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <TestRowsTable
                  rows={specimenRows}
                  includeAbsorption
                  strengthLabel="Tensile Strength (N/mm²)"
                />
              </CardContent>
            </Card>
          ) : (
            <MeasurementTable
              title="Paving Block Measurements"
              entries={[
                ["Dry Weight (kg)", detailText(recordDetails, "dryWeight")],
                ["Wet Weight (kg)", detailText(recordDetails, "wetWeight")],
                ["Length (mm)", detailText(recordDetails, "length")],
                ["Width (mm)", detailText(recordDetails, "width")],
                ["Height (mm)", detailText(recordDetails, "height")],
                [
                  "Tensile Strength (N/mm²)",
                  detailText(
                    recordDetails,
                    "tensileStrength",
                    detailText(recordDetails, "correctedStrength"),
                  ),
                ],
              ]}
            />
          )}
          <MeasurementTable
            title="Paving Block Test Result"
            entries={[
              [
                "Average Tensile Strength (N/mm²)",
                formatStrengthMetric(strengthEvaluation.averageStrength),
              ],
              ["Result", displayValue(strengthEvaluation.status ?? record.status)],
              ["Correction Factor", detailText(recordDetails, "correctionFactor")],
            ]}
          />
        </>
      )}

      {record.testType === "Water" && (
        <MeasurementTable
          title="Water Quality Measurements"
          entries={[
            ["pH", detailText(recordDetails, "ph")],
            ["TDS", detailText(recordDetails, "tds")],
            ["Chloride", detailText(recordDetails, "chloride")],
            ["Sulphate", detailText(recordDetails, "sulphate")],
            ["Observation 1", detailText(recordDetails, "observation1")],
            ["Observation 2", detailText(recordDetails, "observation2")],
          ]}
        />
      )}

      {(record.testType !== "Ready Mix" &&
        record.testType !== "Precast" &&
        record.testType !== "Blocks" &&
        record.testType !== "Sand Sieve" &&
        record.testType !== "Aggregate Sieve" &&
        record.testType !== "Paving Blocks" &&
        record.testType !== "Water") && (
          <MeasurementTable
            title={`${record.testType} Measurements`}
            entries={[
              ["Observation 1", detailText(recordDetails, "observation1")],
              ["Observation 2", detailText(recordDetails, "observation2")],
            ]}
          />
      )}

      {isSieveEvaluated && (
        <Card>
          <CardHeader className="bg-muted/30 border-b">
            <CardTitle>Automatic Sieve Evaluation</CardTitle>
            <CardDescription>Comparison with the configured sieve standard.</CardDescription>
          </CardHeader>
          <CardContent>
            <SieveEvaluation value={recordDetails.sieveEvaluation} />
          </CardContent>
        </Card>
      )}

      {isStrengthEvaluated && (
        <Card>
          <CardHeader className="bg-muted/30 border-b">
            <CardTitle>Automatic Quality Evaluation</CardTitle>
            <CardDescription>Status is based on the configured standard and measured values.</CardDescription>
          </CardHeader>
          <CardContent>
            <StrengthEvaluation
              value={strengthEvaluationForDisplay}
                strengthName={
                  record.testType === "Blocks"
                  ? isDammamBlock && !isDammamSandwich
                    ? "net strength"
                    : "air-dry strength"
                    : record.testType === "Paving Blocks"
                      ? "tensile strength"
                      : "strength"
                }
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Remarks & Observations</CardTitle>
        </CardHeader>
        <CardContent>
          {record.remarks ? (
            <p className="whitespace-pre-wrap text-foreground">{record.remarks}</p>
          ) : (
            <p className="italic text-muted-foreground">No remarks provided.</p>
          )}
        </CardContent>
      </Card>

       {canEditQc && !isStrengthEvaluated && !isSieveEvaluated && (
        <Card>
          <CardHeader>
            <CardTitle>Quality Review</CardTitle>
            <CardDescription>Update the final status of this sample.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">
            <Button
              variant="outline"
              className="text-success border-success/30 hover:bg-success hover:text-white"
              onClick={() => handleStatusUpdate(RecordStatus.Passed)}
              disabled={record.status === RecordStatus.Passed || updateRecord.isPending}
            >
              <Check className="mr-2 h-4 w-4" /> Mark as Passed
            </Button>
            <Button
              variant="outline"
              className="text-destructive border-destructive/30 hover:bg-destructive hover:text-white"
              onClick={() => handleStatusUpdate(RecordStatus.Failed)}
              disabled={record.status === RecordStatus.Failed || updateRecord.isPending}
            >
              <X className="mr-2 h-4 w-4" /> Mark as Failed
            </Button>
            <Button
              variant="outline"
              className="text-warning border-warning/30 hover:bg-warning hover:text-white"
              onClick={() => handleStatusUpdate(RecordStatus.Review)}
              disabled={record.status === RecordStatus.Review || updateRecord.isPending}
            >
              <AlertTriangle className="mr-2 h-4 w-4" /> Set to Review
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
