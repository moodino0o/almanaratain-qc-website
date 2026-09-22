import { useParams, Link, useLocation } from "wouter";
import { useGetRecord, useUpdateRecord, useDeleteRecord, RecordStatus } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import { CheckCircle2, AlertTriangle, XCircle, ArrowLeft, Printer, Trash2, Edit2, Check, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@workspace/replit-auth-web";
import { useQueryClient } from "@tanstack/react-query";
import { getListRecordsQueryKey, getGetDashboardQueryKey, getGetRecordQueryKey } from "@workspace/api-client-react";
import { useState } from "react";

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

function strengthSummary(rows: unknown[]) {
  const strengths = rows
    .map(cubeRowStrength)
    .filter((strength): strength is number => strength !== null);
  if (!strengths.length) return { average: null, minimum: null, maximum: null };
  return {
    average: strengths.reduce((total, strength) => total + strength, 0) / strengths.length,
    minimum: Math.min(...strengths),
    maximum: Math.max(...strengths),
  };
}

function formatStrengthMetric(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toFixed(2) : "—";
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

function TestRowsTable({
  rows,
  includeAbsorption,
  includeAge = true,
  sortByAge = false,
}: {
  rows: unknown[];
  includeAbsorption: boolean;
  includeAge?: boolean;
  sortByAge?: boolean;
}) {
  const displayRows = sortByAge ? sortCubeRowsByAge(rows) : rows;
  return (
    <div className="overflow-x-auto">
      <table className={`w-full ${includeAbsorption ? "min-w-[1040px]" : "min-w-[900px]"} text-xs`}>
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
            <th className="p-2 text-left">Loaded Face Area (mm²)</th>
            <th className="p-2 text-left">Calculated Strength (N/mm²)</th>
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
                <td className="p-2">{displayValue(values.loadedFaceArea)}</td>
                <td className="p-2 font-semibold">
                  {displayValue(values.calculatedStrength ?? values.strength ?? values.compressiveStrength)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SieveRowsTable({ rows }: { rows: unknown[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[620px] text-xs">
        <thead className="bg-muted/30">
          <tr className="border-b">
            <th className="p-2 text-left">No.</th>
            <th className="p-2 text-left">Sieve / Pore Size</th>
            <th className="p-2 text-left">Amount Returned</th>
            <th className="p-2 text-left">Amount Passing</th>
            <th className="p-2 text-left">% Passing</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const values = typeof row === "object" && row !== null
              ? row as Record<string, unknown>
              : {};
            return (
              <tr key={index} className="border-b last:border-b-0">
                <td className="p-2 font-semibold">{displayValue(values.rowNo, String(index + 1))}</td>
                <td className="p-2">{displayValue(values.sieveSize)}</td>
                <td className="p-2">{displayValue(values.amountReturned)}</td>
                <td className="p-2">{displayValue(values.passingAmount)}</td>
                <td className="p-2">{displayValue(values.passingPercentage)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function StrengthEvaluation({ value }: { value: unknown }) {
  if (typeof value !== "object" || value === null) {
    return (
      <span className="text-muted-foreground">
        No automatic evaluation has been recorded for this historical record.
      </span>
    );
  }
  const evaluation = value as Record<string, unknown>;
  const status = String(evaluation.status ?? "Review");
  const statusClass =
    status === RecordStatus.Passed
      ? "text-success"
      : status === RecordStatus.Failed
        ? "text-destructive"
        : "text-warning";
  return (
    <div className="space-y-1">
      <p className={`font-bold ${statusClass}`}>{status}</p>
      {evaluation.averageStrength != null && (
        <>
          <p>Average strength: {formatStrengthMetric(evaluation.averageStrength)} {String(evaluation.strengthUnit ?? "N/mm²")}</p>
          <p>Minimum strength: {formatStrengthMetric(evaluation.minimumStrength)} {String(evaluation.strengthUnit ?? "N/mm²")}</p>
          <p>Maximum strength: {formatStrengthMetric(evaluation.maximumStrength)} {String(evaluation.strengthUnit ?? "N/mm²")}</p>
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
  const summaryEntries: Array<readonly [string, unknown]> = [
    ["Record No.", record.recordNo],
    ["Test Type", record.testType],
    ["Sample Date", formatDate(record.sampleDate)],
    ["Location", record.location],
    ["Material / Product", record.material],
    ["Tested By", record.testedBy],
    ["Approved By", record.reviewedBy || "ADEL ABBAS EBRAHIM"],
  ];

  if (record.testType === "Ready Mix") {
    summaryEntries.push(
      ["Reference Number", detailText(recordDetails, "referenceNumber")],
      ["Customer Name", detailText(recordDetails, "customerName", record.location)],
      ["Customer Location", detailText(recordDetails, "customerLocation", record.location)],
    );
  }
  if (record.testType === "Blocks" || record.testType === "Paving Blocks") {
    summaryEntries.push(
      ["Block Type", detailText(recordDetails, "blockType", record.material)],
      ["Block Size", detailText(recordDetails, "blockSize")],
      ["Block Age (days)", detailText(recordDetails, "blockAge")],
      ["Machine", detailText(recordDetails, "machine")],
    );
  }
  if (record.testType === "Sand Sieve" || record.testType === "Aggregate Sieve") {
    summaryEntries.push(
      ["Sample Weight", detailText(recordDetails, "sampleWeight")],
      ["Supplier", detailText(recordDetails, "supplier")],
      [
        record.testType === "Aggregate Sieve" ? "Material Condition" : "Condition",
        detailText(recordDetails, record.testType === "Aggregate Sieve" ? "materialCondition" : "condition"),
      ],
      ["Dry Sample", detailText(recordDetails, "drySample")],
      ["Wet Sample", detailText(recordDetails, "wetSample")],
    );
    if (record.testType === "Aggregate Sieve") {
      summaryEntries.push(["Fineness Modulus", detailText(recordDetails, "finenessModulus")]);
    } else {
      summaryEntries.push(
        ["Silt Before", detailText(recordDetails, "siltBefore")],
        ["Silt After", detailText(recordDetails, "siltAfter")],
      );
    }
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
  const blockStrengthSummary = strengthSummary(specimenRows);

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
      default: return <Badge variant="secondary" className="text-sm px-3 py-1">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/records" className="p-2 rounded-md hover:bg-muted transition-colors">
            <ArrowLeft className="w-5 h-5 text-muted-foreground" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight text-foreground">{record.recordNo}</h1>
              {getStatusBadge(record.status)}
            </div>
            <p className="text-muted-foreground text-sm mt-1">{record.testType} Quality Control Record</p>
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

      {record.testType === "Blocks" && (
        <>
          <Card>
            <CardHeader className="bg-muted/30 border-b">
              <CardTitle>Specimen Measurements</CardTitle>
              <CardDescription>Block sample dimensions, weights, load, and calculated strength.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {specimenRows.length > 0
                 ? <TestRowsTable rows={specimenRows} includeAbsorption={false} includeAge={false} />
                : <p className="p-6 text-center text-muted-foreground">No specimen measurements recorded.</p>}
            </CardContent>
          </Card>
          <MeasurementTable
            title="Block Test Result"
            entries={[
              ["Block No.", detailText(recordDetails, "blockNo", detailText(recordDetails, "blockNumber"))],
              ["Average Strength (N/mm²)", formatStrengthMetric(strengthEvaluation.averageStrength ?? blockStrengthSummary.average)],
              ["Minimum Strength (N/mm²)", formatStrengthMetric(strengthEvaluation.minimumStrength ?? blockStrengthSummary.minimum)],
              ["Maximum Strength (N/mm²)", formatStrengthMetric(strengthEvaluation.maximumStrength ?? blockStrengthSummary.maximum)],
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
                ? <SieveRowsTable rows={sieveRows} />
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
                <CardDescription>Saved specimen dimensions, weights, load, and calculated strength.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <TestRowsTable rows={specimenRows} includeAbsorption={false} />
              </CardContent>
            </Card>
          ) : (
            <MeasurementTable
              title="Paving Block Measurements"
              entries={[
                ["Weight (kg)", detailText(recordDetails, "weight")],
                ["Length (mm)", detailText(recordDetails, "length")],
                ["Width (mm)", detailText(recordDetails, "width")],
                ["Height (mm)", detailText(recordDetails, "height")],
                ["Compressive Strength (N/mm²)", detailText(recordDetails, "compressiveStrength")],
              ]}
            />
          )}
          <MeasurementTable
            title="Paving Block Test Result"
            entries={[
              ["Target", detailText(recordDetails, "target")],
              ["Strength", detailText(recordDetails, "strength", detailText(recordDetails, "compressiveStrength"))],
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
            <StrengthEvaluation value={recordDetails.strengthEvaluation} />
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
