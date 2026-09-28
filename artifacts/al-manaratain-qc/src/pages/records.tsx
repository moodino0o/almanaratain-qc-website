import { useMemo, useState } from "react";
import { useListRecords, TestType, RecordStatus } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { CheckCircle2, AlertTriangle, XCircle, Search, Plus, Printer, TableProperties } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { useAuth } from "@workspace/replit-auth-web";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  calculateReadyMixAgeBandAverages,
  type ReadyMixAgeBandAverages,
} from "./records-utils";
import {
  summarizeRecordStrengths,
  type RecordStrengthSummary,
} from "./reports-utils";

type RegisterSection = "all" | "readymix" | "masonry" | "aggregate";

export default function Records() {
  const { role } = useAuth();
  const canEditQc = role === "technician" || role === "managerial" || role === "administrator";
  const [search, setSearch] = useState("");
  const [section, setSection] = useState<RegisterSection>("all");

  const { data: records, isLoading } = useListRecords({
    search: search || undefined,
    limit: 1000,
  });
  const sectionRecords = useMemo(() => {
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
      default:
        return allRecords;
    }
  }, [records, section]);
  const isReadyMixSection = section === "readymix";
  const isMasonrySection = section === "masonry";
  const isAggregateSection = section === "aggregate";
  const hideLocationAndCustomer =
    isMasonrySection || isAggregateSection;
  const tableColumnCount =
    10 -
    (hideLocationAndCustomer ? 2 : 0) +
    (isReadyMixSection ? 1 : 0) +
    (isMasonrySection ? 3 : 0);
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
        ? "w-[8%]"
        : isAggregateSection
          ? "w-[10%]"
          : "w-[8%]",
    testType: isReadyMixSection
      ? "w-[9%]"
      : isMasonrySection
        ? "w-[10%]"
        : isAggregateSection
          ? "w-[14%]"
          : "w-[11%]",
    location: isReadyMixSection ? "w-[7%]" : "w-[9%]",
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
      : isMasonrySection
        ? "w-[11%]"
        : isAggregateSection
          ? "w-[14%]"
          : "w-[12%]",
    sampleDate: isReadyMixSection
      ? "w-[7%]"
      : isMasonrySection
        ? "w-[8%]"
        : isAggregateSection
          ? "w-[10%]"
          : "w-[8%]",
    testedBy: isReadyMixSection
      ? "w-[8%]"
      : isMasonrySection
        ? "w-[8%]"
        : isAggregateSection
          ? "w-[10%]"
          : "w-[9%]",
    status: isReadyMixSection
      ? "w-[7%]"
      : isMasonrySection
        ? "w-[7%]"
        : isAggregateSection
          ? "w-[9%]"
          : "w-[8%]",
    actions: isReadyMixSection
      ? "w-[11%]"
      : isMasonrySection
        ? "w-[15%]"
        : isAggregateSection
          ? "w-[21%]"
          : "w-[14%]",
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case RecordStatus.Passed: return <Badge variant="success" className="whitespace-normal px-1.5 py-0.5 text-[10px] leading-tight"><CheckCircle2 className="mr-1 h-3 w-3 shrink-0" /> Passed</Badge>;
      case RecordStatus.Review: return <Badge variant="warning" className="whitespace-normal px-1.5 py-0.5 text-[10px] leading-tight"><AlertTriangle className="mr-1 h-3 w-3 shrink-0" /> Review</Badge>;
      case RecordStatus.Failed: return <Badge variant="destructive" className="whitespace-normal px-1.5 py-0.5 text-[10px] leading-tight"><XCircle className="mr-1 h-3 w-3 shrink-0" /> Failed</Badge>;
      default: return <Badge variant="secondary" className="whitespace-normal px-1.5 py-0.5 text-[10px] leading-tight">{status}</Badge>;
    }
  };

  const getRecordDetail = (details: Record<string, unknown>, keys: string[]) => {
    const normalized = new Map(
      Object.entries(details).map(([key, value]) => [
        key.toLowerCase().replace(/[^a-z0-9]/g, ""),
        value,
      ]),
    );
    const value = keys
      .map((key) => normalized.get(key.toLowerCase().replace(/[^a-z0-9]/g, "")))
      .find((candidate) => candidate !== undefined && candidate !== null);
    return typeof value === "string" && value.trim() ? value : "—";
  };

  return (
    <div className="space-y-6 flex flex-col h-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">QC Register</h1>
          <p className="text-muted-foreground mt-1 text-sm">Browse QC records by test section. Section membership follows each record’s test type.</p>
        </div>
         {canEditQc && (
           <div className="flex flex-wrap gap-2">
             <Link href="/records/edit-all" className="inline-flex h-10 items-center justify-center whitespace-nowrap rounded-md border border-input bg-background px-5 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground">
               <TableProperties className="mr-2 h-4 w-4" />
               Edit All Records
             </Link>
             <Link href="/records/new" className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring bg-primary text-primary-foreground shadow hover:bg-primary/90 h-10 px-6">
               <Plus className="w-4 h-4 mr-2" />
               New Record
             </Link>
           </div>
         )}
      </div>

      <Card className="flex-1 flex flex-col min-h-0 border-t-4 border-t-primary">
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
            <Tabs
              value={section}
              onValueChange={(value) => setSection(value as RegisterSection)}
              className="w-full"
            >
              <TabsList className="grid h-auto w-full grid-cols-2 sm:grid-cols-4">
                <TabsTrigger value="all">All Results</TabsTrigger>
                <TabsTrigger value="readymix">ReadyMix</TabsTrigger>
                <TabsTrigger value="masonry">Masonry</TabsTrigger>
                <TabsTrigger value="aggregate">Aggregate</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-auto p-0">
          <Table className="w-full table-fixed text-[11px] leading-tight">
            <TableHeader className="sticky top-0 bg-card z-10 shadow-sm">
              <TableRow>
                <TableHead className={`${columnWidths.record} px-1.5 py-2 text-[10px] leading-tight`}>
                  {section === "readymix" ? "Reference No." : "Record No."}
                </TableHead>
                <TableHead className={`${columnWidths.testType} px-1.5 py-2 text-[10px] leading-tight`}>Test Type</TableHead>
                {!hideLocationAndCustomer && (
                  <TableHead className={`${columnWidths.location} px-1.5 py-2 text-[10px] leading-tight`}>Location</TableHead>
                )}
                {!hideLocationAndCustomer && (
                  <TableHead className={`${columnWidths.customer} px-1.5 py-2 text-[10px] leading-tight`}>Customer Name</TableHead>
                )}
                <TableHead className={`${columnWidths.siteLocation} px-1.5 py-2 text-[10px] leading-tight`}>Site Location</TableHead>
                <TableHead className={`${columnWidths.material} px-1.5 py-2 text-[10px] leading-tight`}>Material</TableHead>
                <TableHead className={`${columnWidths.sampleDate} px-1.5 py-2 text-[10px] leading-tight`}>Sample Date</TableHead>
                <TableHead className={`${columnWidths.testedBy} px-1.5 py-2 text-[10px] leading-tight`}>Tested By</TableHead>
                <TableHead className={`${columnWidths.status} px-1.5 py-2 text-[10px] leading-tight`}>Status</TableHead>
                {isMasonrySection && (
                  <>
                    <TableHead className="w-[8%] px-1 py-2 text-right text-[10px] leading-tight">Avg. (N/mm²)</TableHead>
                    <TableHead className="w-[8%] px-1 py-2 text-right text-[10px] leading-tight">Min. (N/mm²)</TableHead>
                    <TableHead className="w-[8%] px-1 py-2 text-right text-[10px] leading-tight">Max. (N/mm²)</TableHead>
                  </>
                )}
                {isReadyMixSection && (
                  <TableHead className="w-[15%] px-1 py-2 text-[10px] leading-tight">
                    Avg. strength by age (N/mm²)
                  </TableHead>
                )}
                <TableHead className={`${columnWidths.actions} px-1 py-2 text-right text-[10px] leading-tight`}>Actions</TableHead>
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
                    <TableCell className="break-words px-1.5 py-2 font-semibold text-primary">
                      {isReadyMixSection
                        ? getRecordDetail(record.details, ["referenceNumber", "referenceNo", "reference"])
                        : record.recordNo}
                    </TableCell>
                    <TableCell className="whitespace-normal break-words px-1.5 py-2">
                      <span className="inline-block max-w-full break-words rounded-sm bg-muted px-1 py-0.5 text-[10px] font-medium leading-tight">
                        {record.testType}
                      </span>
                    </TableCell>
                    {!hideLocationAndCustomer && (
                      <TableCell className="whitespace-normal break-words px-1.5 py-2">{record.location}</TableCell>
                    )}
                    {!hideLocationAndCustomer && (
                      <TableCell className="whitespace-normal break-words px-1.5 py-2">
                        {getRecordDetail(record.details, ["customerName", "customer"])}
                      </TableCell>
                    )}
                    <TableCell className="whitespace-normal break-words px-1.5 py-2">
                      {getRecordDetail(record.details, ["customerLocation", "siteLocation", "site"])}
                    </TableCell>
                    <TableCell className="whitespace-normal break-words px-1.5 py-2">{record.material}</TableCell>
                    <TableCell className="whitespace-normal break-words px-1.5 py-2">{formatDate(record.sampleDate)}</TableCell>
                    <TableCell className="whitespace-normal break-words px-1.5 py-2">{record.testedBy}</TableCell>
                    <TableCell className="px-1.5 py-2">{getStatusBadge(record.status)}</TableCell>
                    {isReadyMixSection && (
                      <TableCell className="px-1 py-2">
                        <div className="space-y-1 text-[9px] leading-tight tabular-nums">
                          <div className="flex justify-between gap-1">
                            <span className="text-muted-foreground">2–5 days</span>
                            <span className="font-medium">
                              {readyMixAgeAverages.get(record.id)?.twoToFiveDays?.toFixed(2) ?? "—"}
                            </span>
                          </div>
                          <div className="flex justify-between gap-1">
                            <span className="text-muted-foreground">6–8 days</span>
                            <span className="font-medium">
                              {readyMixAgeAverages.get(record.id)?.sixToEightDays?.toFixed(2) ?? "—"}
                            </span>
                          </div>
                          <div className="flex justify-between gap-1">
                            <span className="text-muted-foreground">28–29 days</span>
                            <span className="font-medium">
                              {readyMixAgeAverages.get(record.id)?.twentyEightToTwentyNineDays?.toFixed(2) ?? "—"}
                            </span>
                          </div>
                        </div>
                      </TableCell>
                    )}
                    {isMasonrySection && (
                      <>
                        <TableCell className="px-1 py-2 text-right tabular-nums">
                          {masonryStrengthSummaries.get(record.id)?.averageStrength.toFixed(2) ?? "—"}
                        </TableCell>
                        <TableCell className="px-1 py-2 text-right tabular-nums">
                          {masonryStrengthSummaries.get(record.id)?.minimumStrength.toFixed(2) ?? "—"}
                        </TableCell>
                        <TableCell className="px-1 py-2 text-right tabular-nums">
                          {masonryStrengthSummaries.get(record.id)?.maximumStrength.toFixed(2) ?? "—"}
                        </TableCell>
                      </>
                    )}
                    <TableCell className="px-1 py-2 text-right">
                      <div className="flex flex-wrap justify-end gap-1">
                        <Link
                          href={`/records/${record.id}`}
                          className="inline-flex h-7 items-center justify-center whitespace-nowrap rounded-md bg-secondary px-1.5 text-[10px] font-medium text-secondary-foreground shadow-sm transition-colors hover:bg-secondary/80"
                        >
                          View
                        </Link>
                        <Link
                          href={`/reports/${record.id}`}
                          className="inline-flex h-7 items-center justify-center whitespace-nowrap rounded-md border border-input bg-background px-1.5 text-[10px] font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                        >
                          <Printer className="mr-1 h-3 w-3 shrink-0" />
                          Print
                        </Link>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
