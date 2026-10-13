import { useMemo, useState } from "react";
import { useListRecords, TestType, RecordStatus, type QcRecord } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Link } from "wouter";
import { CheckCircle2, AlertTriangle, XCircle, Search, Plus, Printer, TableProperties, Clock3 } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import { useAuth } from "@workspace/replit-auth-web";
import { useLocation } from "wouter";
import { REGISTER_SECTIONS, type RegisterSection } from "./register-sections";
import {
  calculateReadyMixAgeBandAverages,
  filterRecordsByDashboardStatus,
  parseDashboardRegisterFilters,
  registerTestingDate,
  type ReadyMixAgeBandAverages,
} from "./records-utils";
import { averageCubeStrengthAtAge } from "./record-form-utils";
import {
  summarizeRecordStrengths,
  type RecordStrengthSummary,
} from "./reports-utils";

function detailValue(record: QcRecord, keys: string[], fallback = "—") {
  const details = record.details as Record<string, unknown>;
  const normalized = new Map(
    Object.entries(details).map(([key, value]) => [
      key.toLowerCase().replace(/[^a-z0-9]/g, ""),
      value,
    ]),
  );
  const value = keys
    .map((key) => normalized.get(key.toLowerCase().replace(/[^a-z0-9]/g, "")))
    .find((candidate) => candidate !== undefined && candidate !== null && String(candidate).trim());
  return value === undefined ? fallback : String(value);
}

function precastAverageStrength(record: QcRecord, age: number, legacyKeys: string[]) {
  const details = record.details as Record<string, unknown>;
  const rows = Array.isArray(details.testRows) ? details.testRows : [];
  const average = averageCubeStrengthAtAge(rows, age);
  return average === null
    ? detailValue(record, legacyKeys)
    : average.toFixed(2);
}

function kerbStrengthValue(
  record: QcRecord,
  evaluationKey: "averageStrength" | "minimumStrength" | "maximumStrength",
  legacyKeys: string[],
) {
  const details = record.details as Record<string, unknown>;
  const evaluation = typeof details.strengthEvaluation === "object" &&
    details.strengthEvaluation !== null
    ? details.strengthEvaluation as Record<string, unknown>
    : {};
  const value = evaluation[evaluationKey];
  if (value !== undefined && value !== null && value !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed.toFixed(2) : String(value);
  }
  return detailValue(record, legacyKeys);
}

function strengthEvaluationReason(record: QcRecord) {
  const details = record.details as Record<string, unknown>;
  const evaluation = typeof details.strengthEvaluation === "object" &&
    details.strengthEvaluation !== null
    ? details.strengthEvaluation as Record<string, unknown>
    : {};
  return typeof evaluation.reason === "string" ? evaluation.reason : "";
}

function derivedAge(record: QcRecord) {
  const direct = detailValue(record, ["age"], "").trim();
  if (direct) return direct;
  const testing = detailValue(record, ["testingDate"], "").slice(0, 10);
  const casting = record.sampleDate.slice(0, 10);
  const start = Date.parse(`${casting}T00:00:00.000Z`);
  const end = Date.parse(`${testing}T00:00:00.000Z`);
  if (!testing || !Number.isFinite(start) || !Number.isFinite(end) || end < start) return "—";
  const days = (end - start) / 86_400_000;
  return Number.isSafeInteger(days) ? String(days) : "—";
}

function formatRegisterDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    timeZone: "UTC",
  }).format(date);
}

function masonryBlockAge(record: QcRecord) {
  const details = record.details as Record<string, unknown>;
  const directAgeText = String(details.blockAge ?? "").trim();
  const directAge = directAgeText ? Number(directAgeText) : Number.NaN;
  if (Number.isSafeInteger(directAge) && directAge >= 0) return String(directAge);

  const rows = Array.isArray(details.testRows) ? details.testRows : [];
  const legacyRowAge = rows
    .map((row) => (
      typeof row === "object" && row !== null
        ? String((row as Record<string, unknown>).sampleAge ?? "").trim()
        : Number.NaN
    ))
    .map((value) => typeof value === "string" && value ? Number(value) : Number.NaN)
    .find((value) => Number.isSafeInteger(value) && value >= 0);
  if (legacyRowAge !== undefined) return String(legacyRowAge);

  const sampleDay = record.sampleDate.slice(0, 10);
  const testingDay = registerTestingDate(record).slice(0, 10);
  const sampleTime = Date.parse(`${sampleDay}T00:00:00.000Z`);
  const testingTime = Date.parse(`${testingDay}T00:00:00.000Z`);
  if (
    !Number.isFinite(sampleTime) ||
    !Number.isFinite(testingTime) ||
    new Date(sampleTime).toISOString().slice(0, 10) !== sampleDay ||
    new Date(testingTime).toISOString().slice(0, 10) !== testingDay
  ) return "—";
  const age = (testingTime - sampleTime) / 86_400_000;
  return Number.isSafeInteger(age) && age >= 0 ? String(age) : "—";
}

export default function Records() {
  const [location] = useLocation();
  const { role } = useAuth();
  const canEditQc = role === "technician" || role === "managerial" || role === "administrator";
  const [search, setSearch] = useState("");
  const section = REGISTER_SECTIONS.find(({ href }) => href === location)?.id ?? "all";
  const dashboardFilters = parseDashboardRegisterFilters(
    typeof window === "undefined" ? "" : window.location.search,
  );
  const dashboardMonthLabel = dashboardFilters.month
    ? new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(
        new Date(`${dashboardFilters.month}-01T00:00:00`),
      )
    : null;

  const { data: records, isLoading } = useListRecords({
    search: search || undefined,
    limit: 1000,
  });
  const sectionRecordsByType = useMemo(() => {
    const allRecords = records ?? [];
    switch (section) {
      case "readymix":
        return allRecords.filter((record) => record.testType === TestType.Ready_Mix);
      case "masonry":
        return allRecords.filter((record) =>
          record.testType === TestType.Blocks ||
          record.testType === TestType.Paving_Blocks,
        );
      case "aggregate":
        return allRecords.filter((record) =>
          record.testType === TestType.Sand_Sieve ||
          record.testType === TestType.Aggregate_Sieve ||
          record.testType === TestType["Flakiness_&_Elongation"],
        );
      case "precast":
        return allRecords.filter((record) => record.testType === TestType.Precast);
      case "kerbstone":
        return allRecords.filter((record) => record.testType === TestType.Kerb_Stone);
      case "water":
        return allRecords.filter((record) => record.testType === TestType.Water);
      default:
        return allRecords;
    }
  }, [records, section]);
  const sectionRecords = useMemo(
    () => filterRecordsByDashboardStatus(sectionRecordsByType, dashboardFilters),
    [sectionRecordsByType, dashboardFilters.month, dashboardFilters.status],
  );
  const isReadyMixSection = section === "readymix";
  const isMasonrySection = section === "masonry";
  const isAggregateSection = section === "aggregate";
  const isPrecastSection = section === "precast";
  const isKerbStoneSection = section === "kerbstone";
  const isWaterSection = section === "water";
  const hideCustomerAndSiteLocation =
    isMasonrySection || isAggregateSection;
  const tableColumnCount =
    10 -
    (hideCustomerAndSiteLocation ? 2 : 0) +
    (isMasonrySection ? 6 : 0);
  const readyMixAgeAverages = useMemo(() => {
    const averages = new Map<number, ReadyMixAgeBandAverages>();
    if (isReadyMixSection) {
      for (const record of sectionRecords) {
        averages.set(record.id, calculateReadyMixAgeBandAverages(record.details));
      }
    }
    return averages;
  }, [isReadyMixSection, sectionRecords]);
  const masonryStrengthSummaries = useMemo(() => {
    const summaries = new Map<number, RecordStrengthSummary | null>();
    if (isMasonrySection) {
      for (const record of sectionRecords) {
        summaries.set(record.id, summarizeRecordStrengths(record));
      }
    }
    return summaries;
  }, [isMasonrySection, sectionRecords]);
  const columnWidths = {
    record: isReadyMixSection
      ? "w-[9%]"
      : isMasonrySection
        ? "w-[7%]"
        : isAggregateSection
          ? "w-[10%]"
          : "w-[8%]",
    testType: isReadyMixSection
      ? "w-[9%]"
      : isMasonrySection
        ? "w-[8%]"
        : isAggregateSection
          ? "w-[14%]"
          : "w-[11%]",
    location: isReadyMixSection
      ? "w-[7%]"
      : isMasonrySection
        ? "w-[8%]"
        : isAggregateSection
          ? "w-[12%]"
          : "w-[9%]",
    customer: isReadyMixSection ? "w-[9%]" : "w-[11%]",
    siteLocation: isReadyMixSection
      ? "w-[8%]"
      : isMasonrySection
        ? "w-[9%]"
        : isAggregateSection
          ? "w-[12%]"
          : "w-[10%]",
    material: isReadyMixSection
      ? "w-[10%]"
      : isAggregateSection
        ? "w-[14%]"
        : "w-[12%]",
    sampleDate: isReadyMixSection
      ? "w-[7%]"
      : isMasonrySection
        ? "w-[7%]"
        : isAggregateSection
          ? "w-[10%]"
          : "w-[8%]",
    testingDate: "w-[7%]",
    blockAge: "w-[5%]",
    testedBy: isReadyMixSection
      ? "w-[8%]"
      : isMasonrySection
        ? "w-[8%]"
        : isAggregateSection
          ? "w-[10%]"
          : "w-[9%]",
    remarks: isMasonrySection
      ? "w-[8%]"
      : isAggregateSection
        ? "w-[10%]"
        : "w-[9%]",
    blockType: isMasonrySection ? "w-[10%]" : "w-[13%]",
    machine: isMasonrySection ? "w-[7%]" : "w-[8%]",
    status: isReadyMixSection
      ? "w-[7%]"
      : isMasonrySection
        ? "w-[9%]"
        : isAggregateSection
          ? "w-[9%]"
          : "w-[8%]",
    actions: isReadyMixSection
      ? "w-[14%]"
      : isMasonrySection
        ? "w-[9%]"
        : isAggregateSection
          ? "w-[21%]"
          : "w-[14%]",
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case RecordStatus.Passed: return <Badge variant="success" className="whitespace-normal px-1.5 py-0.5 text-[11px] leading-tight sm:text-xs"><CheckCircle2 className="mr-1 h-3 w-3 shrink-0" /> Passed</Badge>;
      case RecordStatus.Review: return <Badge variant="warning" className="whitespace-normal px-1.5 py-0.5 text-[11px] leading-tight sm:text-xs"><AlertTriangle className="mr-1 h-3 w-3 shrink-0" /> Review</Badge>;
      case RecordStatus.Failed: return <Badge variant="destructive" className="whitespace-normal px-1.5 py-0.5 text-[11px] leading-tight sm:text-xs"><XCircle className="mr-1 h-3 w-3 shrink-0" /> Failed</Badge>;
      case "Waiting for results": return <Badge variant="outline" className="whitespace-normal border-lime-300 bg-lime-100 px-1.5 py-0.5 text-[11px] leading-tight text-lime-800 dark:border-lime-700 dark:bg-lime-950 dark:text-lime-200 sm:text-xs"><Clock3 className="mr-1 h-3 w-3 shrink-0" /> Waiting</Badge>;
      default: return <Badge variant="secondary" className="whitespace-normal px-1.5 py-0.5 text-[11px] leading-tight sm:text-xs">{status}</Badge>;
    }
  };
  const getWaterResultBadge = (status: string) => {
    switch (status) {
      case RecordStatus.Passed:
        return <Badge variant="success" className="whitespace-nowrap px-1.5 py-0.5 text-[11px] leading-tight sm:text-xs">Pass</Badge>;
      case RecordStatus.Failed:
        return <Badge variant="destructive" className="whitespace-nowrap px-1.5 py-0.5 text-[11px] leading-tight sm:text-xs">Fail</Badge>;
      case RecordStatus.Review:
        return <Badge variant="warning" className="whitespace-nowrap px-1.5 py-0.5 text-[11px] leading-tight sm:text-xs">Review</Badge>;
      default:
        return getStatusBadge(status);
    }
  };

  const getRecordDetail = (
    details: Record<string, unknown>,
    keys: string[],
    fallback = "—",
  ) => detailValue({ details } as QcRecord, keys, fallback);

  return (
    <div className="space-y-6 flex flex-col md:h-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">QC Register</h1>
          <p className="text-muted-foreground mt-1 text-sm">Browse QC records by test section. Section membership follows each record’s test type.</p>
          {(dashboardMonthLabel || dashboardFilters.status) && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {dashboardMonthLabel && (
                <Badge variant="outline">Month: {dashboardMonthLabel}</Badge>
              )}
              {dashboardFilters.status && (
                <Badge variant="outline">Status: {dashboardFilters.status}</Badge>
              )}
              <Link
                href="/records"
                className="text-xs font-medium text-primary underline-offset-4 hover:underline"
              >
                Clear filters
              </Link>
            </div>
          )}
        </div>
         {canEditQc && (
           <div className="flex flex-wrap gap-2">
                 <Link data-testid="link-edit-all-records" href={`/records/edit-all?section=${section}`} className="inline-flex h-7 items-center justify-center whitespace-nowrap rounded-md border border-input bg-background px-2 text-[10px] font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground sm:h-8 sm:px-3 sm:text-xs md:h-10 md:px-5 md:text-sm">
                <TableProperties className="mr-1 h-3 w-3 sm:mr-1.5 sm:h-3.5 sm:w-3.5 md:mr-2 md:h-4 md:w-4" />
               Edit All Records
             </Link>
               <Link data-testid="link-new-record" href={`/records/new?section=${section}`} className="inline-flex h-7 items-center justify-center whitespace-nowrap rounded-md bg-primary px-2 text-[10px] font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring sm:h-8 sm:px-3 sm:text-xs md:h-10 md:px-6 md:text-sm">
                <Plus className="mr-1 h-3 w-3 sm:mr-1.5 sm:h-3.5 sm:w-3.5 md:mr-2 md:h-4 md:w-4" />
               New Record
             </Link>
           </div>
         )}
      </div>
      <Card className="flex flex-col border-t-4 border-t-primary md:min-h-0 md:flex-1">
        <CardHeader className="pb-4 shrink-0">
          <div className="flex flex-col gap-4">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search record no, location, material..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <nav aria-label="QC register sections" className="grid grid-cols-4 gap-2 sm:grid-cols-3 lg:grid-cols-7">
              {REGISTER_SECTIONS.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  data-testid={`register-section-${item.id}`}
                  aria-current={section === item.id ? "page" : undefined}
                  className={`inline-flex min-h-7 items-center justify-center rounded-md border px-1.5 py-1 text-[10px] font-medium transition-colors sm:min-h-9 sm:px-2 sm:py-1.5 sm:text-xs md:min-h-10 md:px-3 md:py-2 md:text-sm ${
                    section === item.id
                      ? "border-primary bg-primary text-primary-foreground shadow-sm"
                      : "border-input bg-background hover:bg-accent hover:text-accent-foreground"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </CardHeader>
        <CardContent className="p-0 md:flex-1 md:overflow-auto">
          {isWaterSection ? (
            <div className="qc-register-table-container w-full min-w-0">
              <Table className="qc-register-table qc-table-readable min-w-[1220px] w-full table-fixed text-[10px]">
                <TableHeader className="sticky top-0 z-10 bg-card shadow-sm">
                  <TableRow>
                    <TableHead className="w-[7%] whitespace-normal break-words px-2 py-2 text-[10px] leading-tight">Serial<br />No.</TableHead>
                    <TableHead className="w-[9%] whitespace-normal break-words px-2 py-2 text-[10px] leading-tight">Sampling<br />Date</TableHead>
                    <TableHead className="w-[9%] whitespace-normal break-words px-2 py-2 text-[10px] leading-tight">Testing<br />Date</TableHead>
                    <TableHead className="w-[12%] whitespace-normal break-words px-2 py-2 text-[10px] leading-tight">Tested By</TableHead>
                    <TableHead className="w-[8%] whitespace-normal break-words px-2 py-2 text-[10px] leading-tight">Factory</TableHead>
                    <TableHead className="w-[5%] whitespace-normal break-words px-2 py-2 text-[10px] leading-tight">pH</TableHead>
                    <TableHead className="w-[7%] whitespace-normal break-words px-2 py-2 text-[10px] leading-tight">TDS<br />(ppm)</TableHead>
                    <TableHead className="w-[9%] whitespace-normal break-words px-2 py-2 text-[10px] leading-tight">Chloride<br />content</TableHead>
                    <TableHead className="w-[9%] whitespace-normal break-words px-2 py-2 text-[10px] leading-tight">Sulphate<br />Content</TableHead>
                    <TableHead className="w-[10%] whitespace-normal break-words px-2 py-2 text-[10px] leading-tight">Remark</TableHead>
                    <TableHead className="w-[7%] whitespace-normal break-words px-2 py-2 text-[10px] leading-tight">Pass / Fail</TableHead>
                    <TableHead className="w-[8%] whitespace-normal break-words px-2 py-2 text-[10px] leading-tight">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={12} className="h-32 text-center text-muted-foreground">Loading register...</TableCell></TableRow>
                  ) : sectionRecords.length === 0 ? (
                    <TableRow><TableCell colSpan={12} className="h-32 text-center text-muted-foreground">No Water records found.</TableCell></TableRow>
                  ) : sectionRecords.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="whitespace-normal break-words px-2 py-2 font-semibold text-primary">{record.recordNo}</TableCell>
                      <TableCell className="whitespace-normal break-words px-2 py-2 tabular-nums">{formatRegisterDate(record.sampleDate)}</TableCell>
                      <TableCell className="whitespace-normal break-words px-2 py-2 tabular-nums">{formatRegisterDate(getRecordDetail(record.details, ["testingDate"], ""))}</TableCell>
                      <TableCell className="whitespace-normal break-words px-2 py-2">{record.testedBy || "—"}</TableCell>
                      <TableCell className="whitespace-normal break-words px-2 py-2">{getRecordDetail(record.details, ["factory"], record.location || "—")}</TableCell>
                      <TableCell className="whitespace-normal break-words px-2 py-2 tabular-nums">{getRecordDetail(record.details, ["ph"])}</TableCell>
                      <TableCell className="whitespace-normal break-words px-2 py-2 tabular-nums">{getRecordDetail(record.details, ["tds"])}</TableCell>
                      <TableCell className="whitespace-normal break-words px-2 py-2 tabular-nums">{getRecordDetail(record.details, ["chloride", "chlorideContent"])}</TableCell>
                      <TableCell className="whitespace-normal break-words px-2 py-2 tabular-nums">{getRecordDetail(record.details, ["sulphate", "sulfate", "sulphateContent"])}</TableCell>
                      <TableCell className="whitespace-normal break-words px-2 py-2">{record.remarks?.trim() || "—"}</TableCell>
                      <TableCell className="px-2 py-2">{getWaterResultBadge(record.status)}</TableCell>
                      <TableCell className="px-2 py-2 text-right">
                         <div className="flex justify-center gap-1">
                           <Link href={`/records/${record.id}`} className="inline-flex h-5 items-center rounded-md bg-secondary px-1 text-[9px] font-medium text-secondary-foreground sm:h-6 sm:px-1.5 sm:text-[10px] md:h-7 md:px-2 md:text-xs">View</Link>
                            <Link href={`/reports/${record.id}`} className="inline-flex h-5 items-center rounded-md border px-1 text-[9px] font-medium sm:h-6 sm:px-1.5 sm:text-[10px] md:h-7 md:px-2 md:text-xs">
                              <Printer className="mr-0.5 h-2.5 w-2.5 shrink-0 sm:mr-1 sm:h-3 sm:w-3" />
                              Print
                            </Link>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : isPrecastSection ? (
            <div className="qc-register-table-container precast-register-table-container w-full min-w-0">
              <Table className="qc-register-table qc-precast-register-table qc-table-readable w-full table-fixed">
                <TableHeader className="sticky top-0 z-10 bg-card shadow-sm">
                  <TableRow>
                    {[
                      { label: "Record No." },
                      { label: "Sample No." },
                      { label: "Customer Name" },
                      { label: "Product Type" },
                      { label: "Casting Date" },
                      { label: "Avg. Strength", age: "(1 day)" },
                      { label: "Avg. Strength", age: "(7 days)" },
                      { label: "Avg. Strength", age: "(28 days)" },
                      { label: "Status" },
                      { label: "Actions" },
                    ].map(({ label, age }, index) => (
                      <TableHead key={`${label}-${age ?? index}`} className="whitespace-normal break-words px-1 py-1.5 leading-tight">
                        {label}
                        {age && <><br /><span className="whitespace-nowrap">{age}</span></>}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={10} className="h-32 text-center text-muted-foreground">Loading register...</TableCell></TableRow>
                  ) : sectionRecords.length === 0 ? (
                    <TableRow><TableCell colSpan={10} className="h-32 text-center text-muted-foreground">No Precast records found.</TableCell></TableRow>
                  ) : sectionRecords.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="break-words px-1 py-1.5 font-semibold text-primary">{record.recordNo}</TableCell>
                      <TableCell className="break-words px-1 py-1.5">{detailValue(record, ["sampleNo"])}</TableCell>
                      <TableCell className="break-words px-1 py-1.5">{detailValue(record, ["customerName", "customer"])}</TableCell>
                      <TableCell className="break-words px-1 py-1.5">{record.material}</TableCell>
                      <TableCell className="break-words px-1 py-1.5 tabular-nums">{formatRegisterDate(record.sampleDate)}</TableCell>
                      <TableCell className="px-1 py-1.5 text-right tabular-nums">{precastAverageStrength(record, 1, ["averageStrength1Day", "avgStrength1Day", "day1AverageStrength"])}</TableCell>
                      <TableCell className="px-1 py-1.5 text-right tabular-nums">{precastAverageStrength(record, 7, ["averageStrength7Days", "avgStrength7Days", "day7AverageStrength"])}</TableCell>
                      <TableCell className="px-1 py-1.5 text-right tabular-nums">{precastAverageStrength(record, 28, ["averageStrength28Days", "avgStrength28Days", "day28AverageStrength"])}</TableCell>
                      <TableCell className="px-1 py-1.5 text-center" title={strengthEvaluationReason(record)}>{getWaterResultBadge(record.status)}</TableCell>
                      <TableCell className="px-1 py-1.5">
                        <div className="flex flex-wrap justify-center gap-0.5">
                          <Link href={`/records/${record.id}`} className="inline-flex h-5 items-center justify-center rounded-md bg-secondary px-1 text-[9px] font-medium text-secondary-foreground">View</Link>
                          <Link href={`/reports/${record.id}`} className="inline-flex h-5 items-center justify-center whitespace-nowrap rounded-md border px-1 text-[9px] font-medium">
                            <Printer className="mr-0.5 h-2.5 w-2.5 shrink-0" />
                            Print
                          </Link>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : isKerbStoneSection ? (
            <div className="qc-register-table-container kerbstone-register-table-container w-full min-w-0">
              <Table className="qc-register-table qc-kerbstone-register-table qc-table-readable w-full table-fixed">
                <TableHeader className="sticky top-0 z-10 bg-card shadow-sm">
                  <TableRow>
                    {["Record No.", "Casting Date", "Testing Date", "Age", "Kerb Type", "Factory", "Avg.", "Min.", "Max.", "Status", "Actions"].map((label) => (
                      <TableHead key={label} className="whitespace-normal break-words px-1 py-1.5 leading-tight">{label}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={11} className="h-32 text-center text-muted-foreground">Loading register...</TableCell></TableRow>
                  ) : sectionRecords.length === 0 ? (
                    <TableRow><TableCell colSpan={11} className="h-32 text-center text-muted-foreground">No Kerb Stone records found.</TableCell></TableRow>
                  ) : sectionRecords.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="break-words px-1 py-1.5 font-semibold text-primary">{record.recordNo}</TableCell>
                      <TableCell className="break-words px-1 py-1.5 tabular-nums">{formatRegisterDate(record.sampleDate)}</TableCell>
                      <TableCell className="break-words px-1 py-1.5 tabular-nums">{formatRegisterDate(registerTestingDate(record))}</TableCell>
                      <TableCell className="px-1 py-1.5 text-center tabular-nums">{derivedAge(record)}</TableCell>
                      <TableCell className="break-words px-1 py-1.5">{detailValue(record, ["kerbType", "productType"], record.material || "—")}</TableCell>
                      <TableCell className="break-words px-1 py-1.5">{detailValue(record, ["factory"], record.location || "—")}</TableCell>
                      <TableCell className="px-1 py-1.5 text-right tabular-nums">{kerbStrengthValue(record, "averageStrength", ["averageStrength", "avgStrength"])}</TableCell>
                      <TableCell className="px-1 py-1.5 text-right tabular-nums">{kerbStrengthValue(record, "minimumStrength", ["minimumStrength", "minStrength"])}</TableCell>
                      <TableCell className="px-1 py-1.5 text-right tabular-nums">{kerbStrengthValue(record, "maximumStrength", ["maximumStrength", "maxStrength"])}</TableCell>
                      <TableCell className="px-1 py-1.5 text-center" title={strengthEvaluationReason(record)}>{getWaterResultBadge(record.status)}</TableCell>
                      <TableCell className="px-1 py-1.5">
                        <div className="flex flex-wrap justify-center gap-0.5">
                          <Link href={`/records/${record.id}`} className="inline-flex h-5 items-center justify-center rounded-md bg-secondary px-1 text-[9px] font-medium text-secondary-foreground">View</Link>
                          <Link href={`/reports/${record.id}`} className="inline-flex h-5 items-center justify-center whitespace-nowrap rounded-md border px-1 text-[9px] font-medium">
                            <Printer className="mr-0.5 h-2.5 w-2.5 shrink-0" />
                            Print
                          </Link>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
          <div className="qc-register-table-container w-full min-w-0">
          {isMasonrySection && (
            <p className="px-2 py-2 text-xs text-muted-foreground">
              Strength basis: Dammam Blocks — Net Strength; other Blocks — Air-dry Strength; Paving — Tensile Strength.
            </p>
          )}
          <Table className="qc-register-table qc-table-readable w-full table-fixed text-[9px] leading-tight sm:text-[10px]">
            <TableHeader className="sticky top-0 bg-card z-10 shadow-sm">
              <TableRow>
                <TableHead className={`${columnWidths.record} whitespace-normal break-words px-1 py-1.5 text-[9px] leading-tight sm:text-[10px]`}>
                  {section === "readymix" ? "Reference No." : "Record No."}
                </TableHead>
                <TableHead className={`${columnWidths.testType} whitespace-normal break-words px-1 py-1.5 text-[9px] leading-tight sm:text-[10px]`}>Test Type</TableHead>
                <TableHead className={`${columnWidths.location} whitespace-normal break-words px-1 py-1.5 text-[9px] leading-tight sm:text-[10px]`}>Location</TableHead>
                {!hideCustomerAndSiteLocation && (
                  <TableHead className={`${columnWidths.customer} whitespace-normal break-words px-1 py-1.5 text-[9px] leading-tight sm:text-[10px]`}>Customer Name</TableHead>
                )}
                {!hideCustomerAndSiteLocation && (
                  <TableHead className={`${columnWidths.siteLocation} whitespace-normal break-words px-1 py-1.5 text-[9px] leading-tight sm:text-[10px]`}>Site Location</TableHead>
                )}
                {isMasonrySection ? (
                  <>
                    <TableHead className={`${columnWidths.blockType} whitespace-normal break-words px-1 py-1.5 text-[9px] leading-tight sm:text-[10px]`}>
                      Block Type
                    </TableHead>
                    <TableHead className={`${columnWidths.machine} whitespace-normal break-words px-1 py-1.5 text-[9px] leading-tight sm:text-[10px]`}>
                      Machine
                    </TableHead>
                  </>
                ) : (
                  <TableHead className={`${columnWidths.material} whitespace-normal break-words px-1 py-1.5 text-[9px] leading-tight sm:text-[10px]`}>
                    Material
                  </TableHead>
                )}
                {isMasonrySection ? (
                  <>
                    <TableHead className={`${columnWidths.sampleDate} whitespace-normal break-words px-1 py-1.5 text-[9px] leading-tight sm:text-[10px]`}>
                      Sample Date
                    </TableHead>
                    <TableHead className={`${columnWidths.testingDate} whitespace-normal break-words px-1 py-1.5 text-[9px] leading-tight sm:text-[10px]`}>
                      Testing Date
                    </TableHead>
                    <TableHead className={`${columnWidths.blockAge} whitespace-normal break-words px-1 py-1.5 text-[9px] leading-tight sm:text-[10px]`}>
                      Block Age (days)
                    </TableHead>
                  </>
                ) : (
                  <TableHead className={`${columnWidths.sampleDate} whitespace-normal break-words px-1 py-1.5 text-[9px] leading-tight sm:text-[10px]`}>
                    Sample Date
                  </TableHead>
                )}
                {(isMasonrySection || isAggregateSection) ? (
                  <TableHead className={`${columnWidths.remarks} whitespace-normal break-words px-1 py-1.5 text-[9px] leading-tight sm:text-[10px]`}>
                    Remarks
                  </TableHead>
                ) : !isReadyMixSection && (
                  <TableHead className={`${columnWidths.testedBy} whitespace-normal break-words px-1 py-1.5 text-[9px] leading-tight sm:text-[10px]`}>Tested By</TableHead>
                )}
                <TableHead className={`${columnWidths.status} whitespace-normal break-words px-1 py-1.5 text-[9px] leading-tight sm:text-[10px]`}>Status</TableHead>
                {isMasonrySection && (
                  <>
                    <TableHead title="Dammam Blocks: Net Strength. Other Blocks: Air-dry Strength. Paving: Tensile Strength." className="masonry-strength-header w-[5%] whitespace-normal break-words px-1 py-1.5 text-right sm:text-[10px] text-[9px]">Avg. (N/mm²)</TableHead>
                    <TableHead className="masonry-strength-header w-[5%] whitespace-normal break-words px-1 py-1.5 text-right sm:text-[10px] text-[9px]">Min. (N/mm²)</TableHead>
                    <TableHead className="masonry-strength-header w-[5%] whitespace-normal break-words px-1 py-1.5 text-right sm:text-[10px] text-[9px]">Max. (N/mm²)</TableHead>
                  </>
                )}
                {isReadyMixSection && (
                  <TableHead className="w-[20%] whitespace-normal break-words px-1 py-1.5 text-[9px] leading-tight sm:text-[10px]">
                    Avg. strength by age (N/mm²)
                  </TableHead>
                )}
                <TableHead className={`${columnWidths.actions} whitespace-normal break-words px-1 py-1.5 text-right text-[9px] leading-tight sm:text-[10px]`}>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={tableColumnCount} className="text-center h-48 text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
                      Loading register...
                    </div>
                  </TableCell>
                </TableRow>
              ) : sectionRecords.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={tableColumnCount} className="text-center h-48 text-muted-foreground">
                    <div className="flex flex-col items-center justify-center">
                      <Search className="w-10 h-10 text-muted-foreground/30 mb-2" />
                      <p>No records found matching your filters.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                sectionRecords.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="whitespace-normal break-words px-1 py-1 font-semibold text-primary">
                      <div>
                        {isReadyMixSection
                          ? getRecordDetail(record.details, ["referenceNumber", "referenceNo", "reference"])
                          : record.recordNo}
                      </div>
                      <div className="mt-0.5 break-words text-[10px] font-normal leading-tight text-black dark:text-white">
                        Added by {record.createdBy?.trim() || "Not recorded"} ·{" "}
                        {formatDateTime(record.createdAt)}
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-normal break-words px-1 py-1">
                      <span className="inline-block max-w-full break-words rounded-sm bg-muted px-1 py-0.5 text-xs font-medium leading-tight">
                        {record.testType}
                      </span>
                    </TableCell>
                    <TableCell className="whitespace-normal break-words px-1 py-1">{record.location}</TableCell>
                    {!hideCustomerAndSiteLocation && (
                      <TableCell className="whitespace-normal break-words px-1 py-1 text-[12px]">
                        {getRecordDetail(record.details, ["customerName", "customer"])}
                      </TableCell>
                    )}
                    {!hideCustomerAndSiteLocation && (
                      <TableCell className="whitespace-normal break-words px-1 py-1">
                        {getRecordDetail(record.details, ["customerLocation", "siteLocation", "site"])}
                      </TableCell>
                    )}
                    {isMasonrySection ? (
                      <>
                        <TableCell className="whitespace-normal break-words px-1 py-1">
                          {getRecordDetail(
                            record.details,
                            ["blockType"],
                            record.material || "—",
                          )}
                        </TableCell>
                        <TableCell className="whitespace-normal break-words px-1 py-1">
                          {getRecordDetail(record.details, ["machineType", "machine"])}
                        </TableCell>
                      </>
                    ) : (
                      <TableCell className="whitespace-normal break-words px-1 py-1">
                        {record.material}
                      </TableCell>
                    )}
                    {isMasonrySection ? (
                      <>
                        <TableCell className="whitespace-normal break-words px-1 py-1 tabular-nums">
                          {formatRegisterDate(record.sampleDate)}
                        </TableCell>
                        <TableCell className="whitespace-normal break-words px-1 py-1 tabular-nums">
                          {formatRegisterDate(registerTestingDate(record))}
                        </TableCell>
                        <TableCell className="whitespace-normal break-words px-1 py-1 text-center tabular-nums">
                          {masonryBlockAge(record)}
                        </TableCell>
                      </>
                    ) : (
                      <TableCell className="whitespace-normal break-words px-1 py-1 tabular-nums text-[12px]">
                        {formatRegisterDate(record.sampleDate)}
                      </TableCell>
                    )}
                    {(isMasonrySection || isAggregateSection) ? (
                      <TableCell className="whitespace-normal break-words px-1 py-1">
                        {record.remarks?.trim() || "—"}
                      </TableCell>
                    ) : !isReadyMixSection && (
                      <TableCell className="whitespace-normal break-words px-1 py-1">{record.testedBy}</TableCell>
                    )}
                    <TableCell className="px-1 py-1 pl-[5px] pr-[5px]">{getStatusBadge(record.status)}</TableCell>
                    {isReadyMixSection && (
                      <TableCell className="px-1 py-1 pl-[10px] pr-[10px]">
                        <div className="space-y-1 text-[10px] leading-tight tabular-nums sm:text-[11px]">
                          <div className="flex items-center justify-center gap-1 whitespace-nowrap text-center mb-[4px] pl-[4px] pr-[4px]">
                            <span className="text-black dark:text-white pl-[15px] pr-[15px]">2–5 days</span>
                            <span className="font-medium text-center">
                              {readyMixAgeAverages.get(record.id)?.twoToFiveDays?.toFixed(2) ?? "—"}
                            </span>
                          </div>
                          <div className="flex items-center justify-center gap-1 whitespace-nowrap text-center">
                            <span className="text-black dark:text-white pl-[16px] pr-[16px]">6–8 days</span>
                            <span className="font-medium">
                              {readyMixAgeAverages.get(record.id)?.sixToEightDays?.toFixed(2) ?? "—"}
                            </span>
                          </div>
                          <div className="flex items-center justify-center gap-1 whitespace-nowrap text-center">
                            <span className="text-black dark:text-white pl-[10px] pr-[10px]">28–29 days</span>
                            <span className="font-medium">
                              {readyMixAgeAverages.get(record.id)?.twentyEightToTwentyNineDays?.toFixed(2) ?? "—"}
                            </span>
                          </div>
                        </div>
                      </TableCell>
                    )}
                    {isMasonrySection && (
                      <>
                        <TableCell className="masonry-strength-value masonry-average-strength px-1 py-1 text-right tabular-nums text-[10px]">
                          {masonryStrengthSummaries.get(record.id)?.averageStrength.toFixed(2) ?? "—"}
                        </TableCell>
                        <TableCell className="masonry-strength-value px-1 py-1 text-right tabular-nums text-[12px]">
                          {masonryStrengthSummaries.get(record.id)?.minimumStrength.toFixed(2) ?? "—"}
                        </TableCell>
                        <TableCell className="masonry-strength-value px-1 py-1 text-right tabular-nums text-[12px]">
                          {masonryStrengthSummaries.get(record.id)?.maximumStrength.toFixed(2) ?? "—"}
                        </TableCell>
                      </>
                    )}
                    <TableCell className="px-1 py-1 text-right">
                       <div className="flex flex-wrap justify-center gap-0.5">
                        <Link
                          href={`/records/${record.id}`}
                          className="inline-flex h-5 items-center justify-center whitespace-nowrap rounded-md bg-secondary px-1 text-[9px] font-medium text-secondary-foreground shadow-sm transition-colors hover:bg-secondary/80 sm:h-6 sm:px-1.5 sm:text-[10px] md:h-7 md:px-2 md:text-xs"
                        >
                          View
                        </Link>
                        <Link
                          href={`/reports/${record.id}`}
                          className="inline-flex h-5 items-center justify-center whitespace-nowrap rounded-md border border-input bg-background px-1 text-[9px] font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground sm:h-6 sm:px-1.5 sm:text-[10px] md:h-7 md:px-2 md:text-xs"
                        >
                          <Printer className="mr-0.5 h-2.5 w-2.5 shrink-0 sm:mr-1 sm:h-3 sm:w-3" />
                          Print
                        </Link>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
