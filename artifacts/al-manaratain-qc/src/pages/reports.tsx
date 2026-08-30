import { useMemo, useState } from "react";
import {
  DailyReadyMixReferenceType,
  TestType,
  getGetDashboardQueryKey,
  getGetDailyReadyMixResultsQueryKey,
  getGetRecordQueryKey,
  getGetReportQueryKey,
  getListRecordsQueryKey,
  useGetDailyReadyMixResults,
  useGetLookups,
  useListRecords,
  useUpdateRecord,
} from "@workspace/api-client-react";
import type {
  GetDailyReadyMixResultsParams,
  QcRecord,
  QcRecordUpdate,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CalendarDays, ClipboardList, Filter, Loader2, PlusCircle, Save, Search, SlidersHorizontal } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";

type ReferenceType = "site" | "plant";

const today = () => new Date().toISOString().slice(0, 10);

function formatStrength(value: number | null | undefined, unit = "N/mm²") {
  return value == null ? "Missing" : `${value.toFixed(1)} ${unit}`;
}

function detailValue(details: Record<string, unknown>, keys: string[]) {
  const normalized = new Map(
    Object.entries(details).map(([key, value]) => [key.toLowerCase(), value]),
  );
  for (const key of keys) {
    const value = normalized.get(key.toLowerCase());
    if (value !== undefined && value !== null && value !== "") return String(value).trim();
  }
  return "";
}

type CubeResultRow = {
  length: string;
  width: string;
  height: string;
  dryWeight: string;
  wetWeight: string;
  load: string;
};

type ReadyMixResultEntry = {
  record: QcRecord;
  rows: [CubeResultRow, CubeResultRow];
};

const createCubeResultRow = (): CubeResultRow => ({
  length: "100",
  width: "100",
  height: "100",
  dryWeight: "",
  wetWeight: "",
  load: "",
});

const stringValue = (value: unknown) => (value == null ? "" : String(value));

const numberValue = (value: unknown) => {
  const parsed = Number.parseFloat(stringValue(value).replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
};

const rowAge = (row: unknown) => {
  if (typeof row !== "object" || row === null) return null;
  const value = (row as Record<string, unknown>).testAge ??
    (row as Record<string, unknown>).cubeAge ??
    (row as Record<string, unknown>).age;
  const parsed = numberValue(value);
  return parsed !== null && parsed >= 0 ? parsed : null;
};

const referenceNumber = (record: QcRecord) => {
  const details = record.details as Record<string, unknown>;
  return detailValue(details, ["referenceNumber"]) || record.recordNo;
};

const cubeRowFromSaved = (row: unknown): CubeResultRow => {
  const values = typeof row === "object" && row !== null
    ? row as Record<string, unknown>
    : {};
  return {
    length: stringValue(values.length) || "100",
    width: stringValue(values.width) || "100",
    height: stringValue(values.height) || "100",
    dryWeight: stringValue(values.dryWeight),
    wetWeight: stringValue(values.wetWeight),
    load: stringValue(values.load),
  };
};

export default function Reports() {
  const queryClient = useQueryClient();
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [draftDate, setDraftDate] = useState(today);
  const [draftMixDesign, setDraftMixDesign] = useState("");
  const [draftReferenceType, setDraftReferenceType] = useState<ReferenceType>("site");
  const [filters, setFilters] = useState<GetDailyReadyMixResultsParams | null>(null);
  const [isAddResultsOpen, setIsAddResultsOpen] = useState(false);
  const [addResultsStep, setAddResultsStep] = useState<"setup" | "results">("setup");
  const [castingDate, setCastingDate] = useState(today);
  const [cubeAge, setCubeAge] = useState("28");
  const [resultEntries, setResultEntries] = useState<ReadyMixResultEntry[]>([]);
  const [isSavingResults, setIsSavingResults] = useState(false);
  const updateRecord = useUpdateRecord();
  const queryParams = filters ?? {
    sampleDate: today(),
    referenceType: DailyReadyMixReferenceType.site,
  };
  const selectedMixDesign = filters?.mixDesign?.trim() ?? "";
  const hasFilters = filters !== null;
  const showMixSummaries = hasFilters && !selectedMixDesign;

  const { data: lookups, isLoading: lookupsLoading } = useGetLookups();
  const { data: readyMixRecords, isLoading: readyMixRecordsLoading } = useListRecords({
    testType: TestType.Ready_Mix,
    limit: 100,
  });
  const { data: results, isLoading: resultsLoading, isError } = useGetDailyReadyMixResults(
    queryParams,
    {
      query: {
        enabled: filters !== null,
        queryKey: getGetDailyReadyMixResultsQueryKey(queryParams),
      },
    },
  );

  const mixDesigns = useMemo(() => {
    const values = new Set<string>();
    for (const value of lookups?.mixStrengths ?? []) values.add(value);
    for (const record of readyMixRecords ?? []) {
      const details = record.details as Record<string, unknown>;
      const design = detailValue(details, ["designStrength", "mixStrength", "mixType"]);
      if (design) values.add(design);
    }
    return [...values].sort((left, right) => left.localeCompare(right));
  }, [lookups?.mixStrengths, readyMixRecords]);

  const recordsForCastingDate = useMemo(
    () => (readyMixRecords ?? []).filter(
      (record) => record.sampleDate.slice(0, 10) === castingDate,
    ),
    [castingDate, readyMixRecords],
  );

  const resetAddResults = () => {
    setIsAddResultsOpen(false);
    setAddResultsStep("setup");
    setResultEntries([]);
    setIsSavingResults(false);
  };

  const openAddResults = () => {
    setCastingDate(filters?.sampleDate ?? today());
    setCubeAge("28");
    setAddResultsStep("setup");
    setResultEntries([]);
    setIsAddResultsOpen(true);
  };

  const showResultEntries = () => {
    const age = numberValue(cubeAge);
    if (!castingDate) {
      toast.error("Choose the casting date.");
      return;
    }
    if (age === null || !Number.isInteger(age) || age < 1 || age > 365) {
      toast.error("Cube age must be a whole number of days between 1 and 365.");
      return;
    }

    setResultEntries(
      recordsForCastingDate.map((record) => {
        const details = record.details as Record<string, unknown>;
        const savedRows = Array.isArray(details.testRows) ? details.testRows : [];
        const savedAgeRows = savedRows.filter((row) => rowAge(row) === age);
        return {
          record,
          rows: [
            cubeRowFromSaved(savedAgeRows[0]),
            cubeRowFromSaved(savedAgeRows[1]),
          ],
        };
      }),
    );
    setAddResultsStep("results");
  };

  const updateResultRow = (
    recordId: number,
    rowIndex: 0 | 1,
    key: keyof CubeResultRow,
    value: string,
  ) => {
    setResultEntries((previous) => previous.map((entry) => (
      entry.record.id === recordId
        ? {
            ...entry,
            rows: entry.rows.map((row, index) => (
              index === rowIndex ? { ...row, [key]: value } : row
            )) as [CubeResultRow, CubeResultRow],
          }
        : entry
    )));
  };

  const saveResults = async () => {
    const age = numberValue(cubeAge);
    if (age === null || !Number.isInteger(age) || age < 1 || age > 365) {
      toast.error("Cube age must be a whole number of days between 1 and 365.");
      return;
    }
    for (const entry of resultEntries) {
      for (const [rowIndex, row] of entry.rows.entries()) {
        const dimensions = [row.length, row.width, row.height].map(numberValue);
        const dryWeight = numberValue(row.dryWeight);
        const wetWeight = numberValue(row.wetWeight);
        const load = numberValue(row.load);
        if (
          dimensions.some((value) => value === null || value <= 0) ||
          dryWeight === null ||
          dryWeight < 0 ||
          wetWeight === null ||
          wetWeight < 0 ||
          load === null ||
          load < 0
        ) {
          toast.error(`Complete all measurements for ${referenceNumber(entry.record)}, row ${rowIndex + 1}.`);
          return;
        }
      }
    }

    setIsSavingResults(true);
    let savedCount = 0;
    try {
      for (const entry of resultEntries) {
        const details = entry.record.details as Record<string, unknown>;
        const existingRows = Array.isArray(details.testRows) ? details.testRows : [];
        const retainedRows = existingRows.filter((row) => rowAge(row) !== age);
        const newRows = entry.rows.map((row, index) => {
          const length = numberValue(row.length) ?? 100;
          const width = numberValue(row.width) ?? 100;
          return {
            rowNo: retainedRows.length + index + 1,
            testAge: age,
            length,
            width,
            height: numberValue(row.height) ?? 100,
            dryWeight: numberValue(row.dryWeight),
            wetWeight: numberValue(row.wetWeight),
            load: numberValue(row.load) ?? 0,
          };
        });
        const update: QcRecordUpdate = {
          details: {
            ...details,
            testRows: [...retainedRows, ...newRows],
          },
        };
        await updateRecord.mutateAsync({ id: entry.record.id, data: update });
        savedCount += 1;
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getListRecordsQueryKey() }),
        queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() }),
        queryClient.invalidateQueries({ queryKey: ["/api/daily-ready-mix-results"] }),
        ...resultEntries.flatMap(({ record }) => [
          queryClient.invalidateQueries({ queryKey: getGetRecordQueryKey(record.id) }),
          queryClient.invalidateQueries({ queryKey: getGetReportQueryKey(record.id) }),
        ]),
      ]);
      toast.success(`Cube results saved for ${savedCount} Ready Mix ${savedCount === 1 ? "record" : "records"}.`);
      resetAddResults();
    } catch {
      toast.error(
        savedCount
          ? `Saved ${savedCount} record${savedCount === 1 ? "" : "s"}, but the remaining results could not be saved.`
          : "Ready Mix cube results could not be saved. Please try again.",
      );
    } finally {
      setIsSavingResults(false);
    }
  };

  const openFilters = () => {
    setDraftDate(filters?.sampleDate ?? today());
    setDraftMixDesign(filters?.mixDesign ?? "");
    setDraftReferenceType(filters?.referenceType ?? DailyReadyMixReferenceType.site);
    setIsFilterOpen(true);
  };

  const applyFilters = () => {
    if (!draftDate) return;
    setFilters({
      sampleDate: draftDate,
      ...(draftMixDesign.trim() ? { mixDesign: draftMixDesign.trim() } : {}),
      referenceType: draftReferenceType,
    });
    setIsFilterOpen(false);
  };

  const referenceLabel = filters?.referenceType === DailyReadyMixReferenceType.plant ? "Plant" : "Site";
  const dailyResults = results ?? {
    mixes: [],
    records: [],
    averageStrength: null,
    minimumStrength: null,
    maximumStrength: null,
    strengthUnit: "N/mm²",
  };
  const hasResultRows = showMixSummaries
    ? Boolean(dailyResults.mixes.length)
    : Boolean(dailyResults.records.length);

  return (
    <div className="flex h-full flex-col gap-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2.5 text-primary">
              <ClipboardList className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">Daily Ready Mix Results</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Review Ready Mix strength results by date, mix design, and Site or Plant reference.
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={openAddResults} className="shrink-0">
            <PlusCircle className="mr-2 h-4 w-4" />
            Add Ready Mix cube results
          </Button>
          <Button onClick={openFilters} className="shrink-0">
            <SlidersHorizontal className="mr-2 h-4 w-4" />
            {hasFilters ? "Change filters" : "Choose results"}
          </Button>
        </div>
      </div>

      <Card className="border-t-4 border-t-primary">
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-lg">Selected daily results</CardTitle>
              <CardDescription>
                {hasFilters
                  ? `${formatDate(filters.sampleDate)} · ${selectedMixDesign || "All mix designs"} · ${referenceLabel} references`
                  : "Choose a date, an optional mix design, and a reference category to view the results."}
              </CardDescription>
              {hasFilters && (
                <p className="mt-1 text-xs text-muted-foreground">
                  S = Site · H = Plant
                </p>
              )}
            </div>
            {hasFilters && (
              <Button variant="outline" size="sm" onClick={openFilters}>
                <Filter className="mr-2 h-4 w-4" />
                Edit selection
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!hasFilters ? (
            <div className="flex min-h-[280px] flex-col items-center justify-center rounded-lg border border-dashed bg-muted/20 p-8 text-center">
              <CalendarDays className="mb-4 h-10 w-10 text-primary/60" />
              <h2 className="text-lg font-semibold">Start with a daily result search</h2>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">
                Use the filter popup to specify the sample date and whether the reference number belongs to a Site or Plant. Leave mix design blank to see all mixes for that day.
              </p>
              <Button className="mt-5" onClick={openFilters}>Choose date and mix</Button>
            </div>
          ) : resultsLoading ? (
            <div className="flex min-h-[280px] items-center justify-center text-muted-foreground">
              Loading daily Ready Mix results...
            </div>
          ) : isError ? (
            <div className="flex min-h-[280px] flex-col items-center justify-center text-center text-destructive">
              <p className="font-semibold">The daily results could not be loaded.</p>
              <p className="mt-1 text-sm">Please try the selection again.</p>
            </div>
          ) : !hasResultRows ? (
            <div className="flex min-h-[280px] flex-col items-center justify-center text-center">
              <Search className="mb-3 h-10 w-10 text-muted-foreground/40" />
              <p className="font-semibold">No matching Ready Mix results</p>
              <p className="mt-1 max-w-lg text-sm text-muted-foreground">
                {showMixSummaries
                  ? `No Ready Mix records matched this date and ${referenceLabel} reference prefix.`
                  : `No records matched this date, mix design, and ${referenceLabel} reference prefix.`}{" "}
                Check that the reference number starts with {referenceLabel === "Site" ? "S" : "H"} and that a strength was recorded.
              </p>
            </div>
          ) : showMixSummaries ? (
            <div className="overflow-x-auto rounded-md border">
              <Table className="min-w-[680px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Mix Design</TableHead>
                    <TableHead className="text-right">Records</TableHead>
                    <TableHead className="text-right">Average Strength</TableHead>
                    <TableHead className="text-right">Minimum Strength</TableHead>
                    <TableHead className="text-right">Maximum Strength</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dailyResults.mixes.map((mix) => (
                    <TableRow key={mix.mixDesign}>
                      <TableCell className="font-semibold text-primary">{mix.mixDesign}</TableCell>
                      <TableCell className="text-right">{mix.recordCount}</TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatStrength(mix.averageStrength, mix.strengthUnit)}
                      </TableCell>
                      <TableCell className="text-right">{formatStrength(mix.minimumStrength, mix.strengthUnit)}</TableCell>
                      <TableCell className="text-right">{formatStrength(mix.maximumStrength, mix.strengthUnit)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table className="min-w-[760px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Record No.</TableHead>
                    <TableHead>Reference No.</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Mix Design</TableHead>
                    <TableHead className="text-right">Strength</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dailyResults.records.map((record) => (
                    <TableRow key={record.recordId}>
                      <TableCell className="font-semibold text-primary">{record.recordNo}</TableCell>
                      <TableCell className="font-medium">{record.referenceNumber}</TableCell>
                      <TableCell>{record.location}</TableCell>
                      <TableCell>{record.mixDesign}</TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatStrength(record.averageStrength, record.strengthUnit)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={4}>Daily minimum</TableCell>
                    <TableCell className="text-right">{formatStrength(dailyResults.minimumStrength, dailyResults.strengthUnit)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell colSpan={4}>Daily average</TableCell>
                    <TableCell className="text-right">{formatStrength(dailyResults.averageStrength, dailyResults.strengthUnit)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell colSpan={4}>Daily maximum</TableCell>
                    <TableCell className="text-right">{formatStrength(dailyResults.maximumStrength, dailyResults.strengthUnit)}</TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isFilterOpen} onOpenChange={setIsFilterOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Choose daily Ready Mix results</DialogTitle>
            <DialogDescription>
              Choose a date and reference category. Leave mix design blank to show all mixes for that day.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-5 py-2">
            <div className="grid gap-2">
              <Label htmlFor="daily-result-date">Sample date</Label>
              <Input
                id="daily-result-date"
                type="date"
                value={draftDate}
                onChange={(event) => setDraftDate(event.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="daily-result-mix">Mix design</Label>
              <select
                id="daily-result-mix"
                value={draftMixDesign}
                onChange={(event) => setDraftMixDesign(event.target.value)}
                disabled={lookupsLoading}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm shadow-sm outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">All mix designs</option>
                {mixDesigns.map((mixDesign) => (
                  <option key={mixDesign} value={mixDesign}>{mixDesign}</option>
                ))}
              </select>
              {!lookupsLoading && mixDesigns.length === 0 && (
                <p className="text-xs text-muted-foreground">No saved mix designs are available; all mixes will still be searched.</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="daily-result-reference">Reference category</Label>
              <select
                id="daily-result-reference"
                value={draftReferenceType}
                onChange={(event) => setDraftReferenceType(event.target.value as ReferenceType)}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm shadow-sm outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="site">Site — reference starts with S</option>
                <option value="plant">Plant — reference starts with H</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsFilterOpen(false)}>Cancel</Button>
            <Button onClick={applyFilters} disabled={!draftDate}>
              Show results
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isAddResultsOpen}
        onOpenChange={(open) => {
          if (open) {
            setIsAddResultsOpen(true);
          } else if (!isSavingResults) {
            resetAddResults();
          }
        }}
      >
        <DialogContent className={addResultsStep === "results" ? "max-w-7xl" : undefined}>
          {addResultsStep === "setup" ? (
            <>
              <DialogHeader>
                <DialogTitle>Add Ready Mix cube results</DialogTitle>
                <DialogDescription>
                  Choose the casting date and cube age to load every Ready Mix reference cast on that date.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-5 py-2 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="cube-results-casting-date">Casting date</Label>
                  <Input
                    id="cube-results-casting-date"
                    type="date"
                    value={castingDate}
                    onChange={(event) => setCastingDate(event.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="cube-results-age">Cube age (days)</Label>
                  <Input
                    id="cube-results-age"
                    type="number"
                    min={1}
                    max={365}
                    step={1}
                    value={cubeAge}
                    onChange={(event) => setCubeAge(event.target.value)}
                    placeholder="28"
                  />
                </div>
              </div>
              <p className="rounded-md border border-primary/20 bg-primary/[0.04] p-3 text-sm text-muted-foreground">
                Two cube rows will be prepared for each matching reference. Length, width, and height start at 100 mm.
              </p>
              <DialogFooter>
                <Button variant="outline" onClick={resetAddResults}>Cancel</Button>
                <Button
                  onClick={showResultEntries}
                  disabled={!castingDate || readyMixRecordsLoading}
                >
                  {readyMixRecordsLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Loading records
                    </>
                  ) : (
                    "Show references"
                  )}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Enter Ready Mix cube results</DialogTitle>
                <DialogDescription>
                  {formatDate(castingDate)} · {cubeAge}-day cubes · {resultEntries.length}{" "}
                  {resultEntries.length === 1 ? "reference" : "references"}
                </DialogDescription>
              </DialogHeader>
              {resultEntries.length === 0 ? (
                <div className="flex min-h-[220px] flex-col items-center justify-center rounded-lg border border-dashed bg-muted/20 p-8 text-center">
                  <Search className="mb-3 h-10 w-10 text-muted-foreground/40" />
                  <p className="font-semibold">No Ready Mix records found</p>
                  <p className="mt-1 max-w-md text-sm text-muted-foreground">
                    No Ready Mix reference numbers have a casting/sample date of {formatDate(castingDate)}.
                    Choose another date to continue.
                  </p>
                </div>
              ) : (
                <div className="max-h-[58vh] space-y-4 overflow-y-auto pr-1">
                  {resultEntries.map((entry) => (
                    <Card key={entry.record.id} className="overflow-hidden border">
                      <CardHeader className="border-b bg-muted/20 px-4 py-3">
                        <CardTitle className="text-base">
                          {referenceNumber(entry.record)}
                        </CardTitle>
                        <CardDescription>
                          {entry.record.recordNo} · {entry.record.location} · {entry.record.material}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="overflow-x-auto p-0">
                        <table className="min-w-[980px] w-full text-sm">
                          <thead className="bg-muted/50">
                            <tr className="border-b">
                              <th className="w-20 px-3 py-3 text-left font-semibold">Cube</th>
                              <th className="w-24 px-3 py-3 text-left font-semibold">Age (days)</th>
                              <th className="px-2 py-3 text-left font-semibold">Length (mm)</th>
                              <th className="px-2 py-3 text-left font-semibold">Width (mm)</th>
                              <th className="px-2 py-3 text-left font-semibold">Height (mm)</th>
                              <th className="px-2 py-3 text-left font-semibold">Dry Weight</th>
                              <th className="px-2 py-3 text-left font-semibold">Wet Weight</th>
                              <th className="px-2 py-3 text-left font-semibold">Load (kN)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {entry.rows.map((row, rowIndex) => (
                              <tr key={`${entry.record.id}-${rowIndex}`} className="border-b last:border-b-0">
                                <td className="px-3 py-2 font-semibold text-muted-foreground">
                                  {rowIndex + 1}
                                </td>
                                <td className="px-3 py-2 font-medium">{cubeAge}</td>
                                {([
                                  ["length", "Length"],
                                  ["width", "Width"],
                                  ["height", "Height"],
                                  ["dryWeight", "Dry weight"],
                                  ["wetWeight", "Wet weight"],
                                  ["load", "Load"],
                                ] as const).map(([key, label]) => (
                                  <td key={key} className="px-2 py-2">
                                    <Input
                                      type="number"
                                      min={0}
                                      step="any"
                                      value={row[key]}
                                      onChange={(event) => updateResultRow(
                                        entry.record.id,
                                        rowIndex as 0 | 1,
                                        key,
                                        event.target.value,
                                      )}
                                      aria-label={`${label} for ${referenceNumber(entry.record)}, row ${rowIndex + 1}`}
                                      placeholder={key === "length" || key === "width" || key === "height" ? "100" : ""}
                                    />
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
              <DialogFooter className="border-t pt-4">
                <Button
                  variant="outline"
                  onClick={() => setAddResultsStep("setup")}
                  disabled={isSavingResults}
                >
                  Back
                </Button>
                <Button
                  onClick={saveResults}
                  disabled={!resultEntries.length || isSavingResults}
                >
                  {isSavingResults ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving results
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save cube results
                    </>
                  )}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}