import { useMemo, useState } from "react";
import {
  DailyReadyMixReferenceType,
  TestType,
  getGetDailyReadyMixResultsQueryKey,
  useGetDailyReadyMixResults,
  useGetLookups,
  useListRecords,
} from "@workspace/api-client-react";
import type { GetDailyReadyMixResultsParams } from "@workspace/api-client-react";
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
import { CalendarDays, ClipboardList, Filter, Search, SlidersHorizontal } from "lucide-react";
import { formatDate } from "@/lib/utils";

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

export default function Reports() {
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [draftDate, setDraftDate] = useState(today);
  const [draftMixDesign, setDraftMixDesign] = useState("");
  const [draftReferenceType, setDraftReferenceType] = useState<ReferenceType>("site");
  const [filters, setFilters] = useState<GetDailyReadyMixResultsParams | null>(null);
  const queryParams = filters ?? {
    sampleDate: today(),
    referenceType: DailyReadyMixReferenceType.site,
  };
  const selectedMixDesign = filters?.mixDesign?.trim() ?? "";
  const hasFilters = filters !== null;
  const showMixSummaries = hasFilters && !selectedMixDesign;

  const { data: lookups, isLoading: lookupsLoading } = useGetLookups();
  const { data: readyMixRecords } = useListRecords({
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
        <Button onClick={openFilters} className="shrink-0">
          <SlidersHorizontal className="mr-2 h-4 w-4" />
          {hasFilters ? "Change filters" : "Choose results"}
        </Button>
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
    </div>
  );
}