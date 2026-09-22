import { useMemo, useState, type KeyboardEvent } from "react";
import {
  TestType,
  getGetDashboardQueryKey,
  getGetRecordQueryKey,
  getGetReportQueryKey,
  getListRecordsQueryKey,
  useListRecords,
  useUpdateRecord,
} from "@workspace/api-client-react";
import type {
  QcRecord,
  QcRecordUpdate,
} from "@workspace/api-client-react";
import {
  buildDailyReportRows,
  dailyReportProductOptions,
  downloadDailyReportWorkbook,
  sortByReferenceNumber,
  type DailyReportProductOption,
} from "./reports-utils";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
import { CalendarDays, Check, ClipboardList, Download, Filter, FlaskConical, Loader2, PlusCircle, Save, Search, SlidersHorizontal } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

const handleCubeInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
  if (event.key !== "Enter") return;

  event.preventDefault();
  const currentRow = event.currentTarget.closest<HTMLElement>("[data-cube-result-row]");
  if (!currentRow) return;

  const rows = Array.from(
    document.querySelectorAll<HTMLElement>("[data-cube-result-row]"),
  );
  const currentRowIndex = rows.indexOf(currentRow);
  if (currentRowIndex < 0) return;

  const getNavigableInputs = (row: HTMLElement) =>
    Array.from(row.querySelectorAll<HTMLInputElement>("[data-cube-navigation-input]"));
  const currentRowInputs = getNavigableInputs(currentRow);
  const currentInputIndex = currentRowInputs.indexOf(event.currentTarget);
  const candidateInputs = [
    ...currentRowInputs.slice(currentInputIndex + 1),
    ...rows.slice(currentRowIndex + 1).flatMap(getNavigableInputs),
  ];
  candidateInputs.find((input) => input.value.trim() === "")?.focus();
};

export default function Reports() {
  const queryClient = useQueryClient();
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [draftStartDate, setDraftStartDate] = useState(today);
  const [draftEndDate, setDraftEndDate] = useState(today);
  const [draftProducts, setDraftProducts] = useState<string[]>([]);
  const [filters, setFilters] = useState<{
    startDate: string;
    endDate: string;
    products: string[];
  } | null>(null);
  const [isAddResultsOpen, setIsAddResultsOpen] = useState(false);
  const [addResultsStep, setAddResultsStep] = useState<"setup" | "results">("setup");
  const [castingDate, setCastingDate] = useState(today);
  const [cubeAge, setCubeAge] = useState("28");
  const [resultEntries, setResultEntries] = useState<ReadyMixResultEntry[]>([]);
  const [isSavingResults, setIsSavingResults] = useState(false);
  const updateRecord = useUpdateRecord();
  const hasFilters = filters !== null;

  const { data: readyMixRecords, isLoading: readyMixRecordsLoading } = useListRecords({
    testType: TestType.Ready_Mix,
    limit: 1000,
  });
  const { data: allRecords, isLoading: allRecordsLoading, isError: allRecordsError } = useListRecords({
    limit: 1000,
  });

  const productOptions = useMemo(
    () => dailyReportProductOptions(allRecords ?? []),
    [allRecords],
  );

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
    setCastingDate(today());
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

    const entries: ReadyMixResultEntry[] = recordsForCastingDate.map((record) => {
      const details = record.details as Record<string, unknown>;
      const savedRows = Array.isArray(details.testRows) ? details.testRows : [];
      const savedAgeRows = savedRows.filter((row) => rowAge(row) === age);
      return {
        record,
        rows: [
          cubeRowFromSaved(savedAgeRows[0]),
          cubeRowFromSaved(savedAgeRows[1]),
        ] as [CubeResultRow, CubeResultRow],
      };
    });

    setResultEntries(
      sortByReferenceNumber(entries, (entry) => referenceNumber(entry.record)),
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

  const validateResultEntry = (entry: ReadyMixResultEntry, age: number) => {
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
        return false;
      }
    }
    return true;
  };

  const saveResultEntry = async (entry: ReadyMixResultEntry, age: number) => {
    const details = entry.record.details as Record<string, unknown>;
    const existingRows = Array.isArray(details.testRows) ? details.testRows : [];
    const retainedRows = existingRows.filter((row) => rowAge(row) !== age);
    const newRows = entry.rows.map((row, index) => ({
      rowNo: retainedRows.length + index + 1,
      testAge: age,
      length: numberValue(row.length) ?? 100,
      width: numberValue(row.width) ?? 100,
      height: numberValue(row.height) ?? 100,
      dryWeight: numberValue(row.dryWeight),
      wetWeight: numberValue(row.wetWeight),
      load: numberValue(row.load) ?? 0,
    }));
    const update: QcRecordUpdate = {
      details: {
        ...details,
        testRows: [...retainedRows, ...newRows],
      },
    };
    return updateRecord.mutateAsync({ id: entry.record.id, data: update });
  };

  const saveResults = async () => {
    const age = numberValue(cubeAge);
    if (age === null || !Number.isInteger(age) || age < 1 || age > 365) {
      toast.error("Cube age must be a whole number of days between 1 and 365.");
      return;
    }
    for (const entry of resultEntries) {
      if (!validateResultEntry(entry, age)) return;
    }

    setIsSavingResults(true);
    let savedCount = 0;
    try {
      for (const entry of resultEntries) {
        await saveResultEntry(entry, age);
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
    setDraftStartDate(filters?.startDate ?? today());
    setDraftEndDate(filters?.endDate ?? filters?.startDate ?? today());
    setDraftProducts(filters?.products ?? []);
    setIsFilterOpen(true);
  };

  const applyFilters = () => {
    if (!draftStartDate || !draftEndDate || draftEndDate < draftStartDate) {
      toast.error("Choose a valid date range.");
      return;
    }
    setFilters({
      startDate: draftStartDate,
      endDate: draftEndDate,
      products: draftProducts,
    });
    setIsFilterOpen(false);
  };

  const toggleProduct = (option: DailyReportProductOption) => {
    setDraftProducts((previous) =>
      previous.includes(option.key)
        ? previous.filter((key) => key !== option.key)
        : [...previous, option.key],
    );
  };

  const dailyReportRows = useMemo(
    () => buildDailyReportRows(
      allRecords ?? [],
      filters?.startDate ?? today(),
      filters?.endDate ?? today(),
      filters?.products ?? [],
    ),
    [allRecords, filters],
  );
  const hasResultRows = dailyReportRows.length > 0;

  return (
    <div className="flex h-full flex-col gap-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2.5 text-primary">
              <ClipboardList className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">Reports</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Review daily strength results or enter Ready Mix cube results.
              </p>
            </div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="daily" className="w-full">
        <TabsList className="grid h-auto w-fit grid-cols-2">
          <TabsTrigger
            value="daily"
            className="h-11 w-14 px-0"
            title="Daily Results Report"
            aria-label="Daily Results Report"
          >
            <ClipboardList className="h-4 w-4" />
          </TabsTrigger>
          <TabsTrigger
            value="cube-results"
            className="h-11 w-14 px-0"
            title="Ready Mix Cube Results"
            aria-label="Ready Mix Cube Results"
          >
            <FlaskConical className="h-4 w-4" />
          </TabsTrigger>
        </TabsList>

        <TabsContent value="daily" className="mt-4">
          <Card className="border-t-4 border-t-primary">
            <CardHeader className="pb-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-lg">Daily results</CardTitle>
                  <CardDescription>
                    {hasFilters
                      ? `${formatDate(filters.startDate)}${filters.startDate !== filters.endDate ? ` – ${formatDate(filters.endDate)}` : ""} · ${filters.products.length ? `${filters.products.length} product groups` : "All product groups"}`
                      : "Choose a date range and one or more product groups to view daily summaries."}
                  </CardDescription>
                </div>
                 <div className="flex flex-wrap gap-2">
                   {hasResultRows && (
                     <Button variant="outline" size="sm" onClick={() => downloadDailyReportWorkbook(dailyReportRows)}>
                       <Download className="mr-2 h-4 w-4" />
                       Download Excel
                     </Button>
                   )}
                   <Button variant={hasFilters ? "outline" : "default"} size="sm" onClick={openFilters}>
                     {hasFilters ? <Filter className="mr-2 h-4 w-4" /> : <SlidersHorizontal className="mr-2 h-4 w-4" />}
                     {hasFilters ? "Edit selection" : "Choose results"}
                   </Button>
                 </div>
              </div>
            </CardHeader>
            <CardContent>
              {!hasFilters ? (
                <div className="flex min-h-[280px] flex-col items-center justify-center rounded-lg border border-dashed bg-muted/20 p-8 text-center">
                  <CalendarDays className="mb-4 h-10 w-10 text-primary/60" />
                  <h2 className="text-lg font-semibold">Start with a daily result search</h2>
                  <p className="mt-2 max-w-md text-sm text-muted-foreground">
                    Select an inclusive date range and optionally choose multiple products. Results are summarized by date, category, plant, and product group.
                  </p>
                  <Button className="mt-5" onClick={openFilters}>Choose dates and products</Button>
                </div>
              ) : allRecordsLoading ? (
                <div className="flex min-h-[280px] items-center justify-center text-muted-foreground">
                  Loading QC results...
                </div>
              ) : allRecordsError ? (
                <div className="flex min-h-[280px] flex-col items-center justify-center text-center text-destructive">
                  <p className="font-semibold">The daily results could not be loaded.</p>
                  <p className="mt-1 text-sm">Please try the selection again.</p>
                </div>
              ) : !hasResultRows ? (
                <div className="flex min-h-[280px] flex-col items-center justify-center text-center">
                  <Search className="mb-3 h-10 w-10 text-muted-foreground/40" />
                  <p className="font-semibold">No matching QC results</p>
                  <p className="mt-1 max-w-lg text-sm text-muted-foreground">
                    No strength results matched the selected dates and product groups.
                  </p>
                </div>
              ) : (
                <div>
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold text-foreground">
                      By category, plant, product, and date
                    </h3>
                    <span className="text-xs text-muted-foreground">
                      One summary per day and group
                    </span>
                  </div>
                  <div className="overflow-x-auto rounded-md border">
                     <Table className="min-w-[1180px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Category</TableHead>
                           <TableHead className="text-center">Age (days)</TableHead>
                           <TableHead>Date</TableHead>
                          <TableHead>Plant</TableHead>
                          <TableHead>Type / Mix Design</TableHead>
                          <TableHead className="border-l bg-emerald-50 text-right text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">Average</TableHead>
                          <TableHead className="bg-amber-50 text-right text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">Minimum</TableHead>
                          <TableHead className="bg-sky-50 text-right text-sky-900 dark:bg-sky-950/30 dark:text-sky-200">Maximum</TableHead>
                           <TableHead className="bg-violet-50 text-right text-violet-900 dark:bg-violet-950/30 dark:text-violet-200">Std. Dev.</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dailyReportRows.map((row) => (
                           <TableRow key={`${row.date}-${row.category}-${row.plant}-${row.product}-${row.cubeAge ?? "none"}`}>
                            <TableCell className="font-medium">{row.category}</TableCell>
                             <TableCell className="text-center">{row.cubeAge === null ? "—" : row.cubeAge}</TableCell>
                             <TableCell className="whitespace-nowrap">{formatDate(row.date)}</TableCell>
                            <TableCell>{row.plant}</TableCell>
                            <TableCell>{row.product}</TableCell>
                            <TableCell className="border-l bg-emerald-50/50 text-right font-semibold text-emerald-900 dark:bg-emerald-950/10 dark:text-emerald-200">{formatStrength(row.averageStrength, row.strengthUnit)}</TableCell>
                            <TableCell className="bg-amber-50/50 text-right text-amber-900 dark:bg-amber-950/10 dark:text-amber-200">{formatStrength(row.minimumStrength, row.strengthUnit)}</TableCell>
                            <TableCell className="bg-sky-50/50 text-right text-sky-900 dark:bg-sky-950/10 dark:text-sky-200">{formatStrength(row.maximumStrength, row.strengthUnit)}</TableCell>
                             <TableCell className="bg-violet-50/50 text-right text-violet-900 dark:bg-violet-950/10 dark:text-violet-200">{formatStrength(row.standardDeviation, row.strengthUnit)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cube-results" className="mt-4">
          <Card className="border-t-4 border-t-primary">
            <CardHeader>
              <CardTitle className="text-lg">Ready Mix cube results</CardTitle>
              <CardDescription>
                Enter 7-day or 28-day cube measurements for every Ready Mix reference cast on a selected date.
                 Save cube measurements to the original Ready Mix report.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex min-h-[280px] flex-col items-center justify-center rounded-lg border border-dashed bg-muted/20 p-8 text-center">
                <FlaskConical className="mb-4 h-10 w-10 text-primary/60" />
                <h2 className="text-lg font-semibold">Add Ready Mix cube results</h2>
                <p className="mt-2 max-w-lg text-sm text-muted-foreground">
                  Choose a casting date and cube age, then enter the dimensions, weights, and load for each report.
                </p>
                <Button className="mt-5" onClick={openAddResults}>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Add Ready Mix cube results
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={isFilterOpen} onOpenChange={setIsFilterOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Choose daily results</DialogTitle>
              <DialogDescription>
                Choose an inclusive date range and optionally select multiple product groups. Ready Mix results are grouped by the first three words of the mix design.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-5 py-2">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="daily-result-start-date">Start date</Label>
                <Input
                  id="daily-result-start-date"
                  type="date"
                  value={draftStartDate}
                  onChange={(event) => setDraftStartDate(event.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="daily-result-end-date">End date</Label>
                <Input
                  id="daily-result-end-date"
                  type="date"
                  min={draftStartDate}
                  value={draftEndDate}
                  onChange={(event) => setDraftEndDate(event.target.value)}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <div className="flex items-center justify-between gap-3">
                <Label>Product groups</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setDraftProducts([])}
                  disabled={!draftProducts.length}
                >
                  All products
                </Button>
              </div>
              <div className="max-h-64 overflow-y-auto rounded-md border p-2">
                {productOptions.length === 0 ? (
                  <p className="p-2 text-sm text-muted-foreground">No product groups are available.</p>
                ) : (
                  <div className="grid gap-1 sm:grid-cols-2">
                    {productOptions.map((option) => {
                      const selected = draftProducts.includes(option.key);
                      return (
                        <button
                          type="button"
                          key={option.key}
                          onClick={() => toggleProduct(option)}
                          className={`flex items-start gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors ${
                            selected ? "bg-primary/10 text-primary" : "hover:bg-muted"
                          }`}
                        >
                          <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border ${
                            selected ? "border-primary bg-primary text-primary-foreground" : "border-input"
                          }`}>
                            {selected && <Check className="h-3 w-3" />}
                          </span>
                          <span>
                            <span className="block font-medium">{option.product}</span>
                            <span className="block text-xs text-muted-foreground">{option.category}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Leave the selection empty to include every category and product group.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsFilterOpen(false)}>Cancel</Button>
            <Button onClick={applyFilters} disabled={!draftStartDate || !draftEndDate}>
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
                <div className="max-h-[58vh] overflow-y-auto pr-1">
                  <Card className="overflow-hidden border">
                    <CardContent className="overflow-x-auto p-0">
                      <table className="min-w-[1160px] w-full text-sm">
                        <thead className="bg-muted/50">
                          <tr className="border-b">
                            <th className="w-48 px-3 py-3 text-left font-semibold">Reference Number</th>
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
                          {resultEntries.flatMap((entry) => entry.rows.map((row, rowIndex) => (
                            <tr
                              key={`${entry.record.id}-${rowIndex}`}
                              data-cube-result-row
                              className={`border-b ${rowIndex === 0 ? "border-t-2 border-t-primary/20" : ""}`}
                            >
                              {rowIndex === 0 && (
                                <td rowSpan={entry.rows.length} className="align-top px-3 py-3 font-semibold">
                                  <div>{referenceNumber(entry.record)}</div>
                                  <div className="mt-1 text-xs font-normal text-muted-foreground">
                                    {entry.record.recordNo} · {entry.record.location} · {entry.record.material}
                                  </div>
                                </td>
                              )}
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
                                    onKeyDown={handleCubeInputKeyDown}
                                    data-cube-navigation-input={key === "dryWeight" || key === "wetWeight" || key === "load" ? "true" : undefined}
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
                          )))}
                        </tbody>
                      </table>
                    </CardContent>
                  </Card>
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