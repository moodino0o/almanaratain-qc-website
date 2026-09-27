import { useState } from "react";
import { useListRecords, TestType, RecordStatus } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { CheckCircle2, AlertTriangle, XCircle, Search, Plus, Filter, Printer, TableProperties } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { useAuth } from "@workspace/replit-auth-web";

export default function Records() {
  const { role } = useAuth();
  const canEditQc = role === "technician" || role === "managerial" || role === "administrator";
  const [search, setSearch] = useState("");
  const [testType, setTestType] = useState<TestType | "All">("All");

  const { data: records, isLoading } = useListRecords({ 
    search: search || undefined, 
    testType: testType === "All" ? undefined : testType 
  });

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
          <p className="text-muted-foreground mt-1 text-sm">Comprehensive searchable list of all quality control tests.</p>
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
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Search record no, location, material..." 
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Filter className="w-4 h-4 text-muted-foreground hidden sm:block" />
              <div className="w-full sm:w-[200px]">
                <Select value={testType} onValueChange={(val: any) => setTestType(val)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by Test Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All Test Types</SelectItem>
                    {Object.values(TestType).map(type => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-auto p-0">
          <Table className="w-full table-fixed text-[11px] leading-tight">
            <TableHeader className="sticky top-0 bg-card z-10 shadow-sm">
              <TableRow>
                <TableHead className="w-[8%] px-1.5 py-2 text-[10px] leading-tight">Record No.</TableHead>
                <TableHead className="w-[11%] px-1.5 py-2 text-[10px] leading-tight">Test Type</TableHead>
                <TableHead className="w-[9%] px-1.5 py-2 text-[10px] leading-tight">Location</TableHead>
                <TableHead className="w-[11%] px-1.5 py-2 text-[10px] leading-tight">Customer Name</TableHead>
                <TableHead className="w-[10%] px-1.5 py-2 text-[10px] leading-tight">Site Location</TableHead>
                <TableHead className="w-[12%] px-1.5 py-2 text-[10px] leading-tight">Material</TableHead>
                <TableHead className="w-[8%] px-1.5 py-2 text-[10px] leading-tight">Sample Date</TableHead>
                <TableHead className="w-[9%] px-1.5 py-2 text-[10px] leading-tight">Tested By</TableHead>
                <TableHead className="w-[8%] px-1.5 py-2 text-[10px] leading-tight">Status</TableHead>
                <TableHead className="w-[14%] px-1 py-2 text-right text-[10px] leading-tight">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center h-48 text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
                      Loading register...
                    </div>
                  </TableCell>
                </TableRow>
              ) : records?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center h-48 text-muted-foreground">
                    <div className="flex flex-col items-center justify-center">
                      <Search className="w-10 h-10 text-muted-foreground/30 mb-2" />
                      <p>No records found matching your filters.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                records?.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="break-words px-1.5 py-2 font-semibold text-primary">{record.recordNo}</TableCell>
                    <TableCell className="whitespace-normal break-words px-1.5 py-2">
                      <span className="inline-block max-w-full break-words rounded-sm bg-muted px-1 py-0.5 text-[10px] font-medium leading-tight">
                        {record.testType}
                      </span>
                    </TableCell>
                    <TableCell className="whitespace-normal break-words px-1.5 py-2">{record.location}</TableCell>
                    <TableCell className="whitespace-normal break-words px-1.5 py-2">
                      {getRecordDetail(record.details, ["customerName", "customer"])}
                    </TableCell>
                    <TableCell className="whitespace-normal break-words px-1.5 py-2">
                      {getRecordDetail(record.details, ["customerLocation", "siteLocation", "site"])}
                    </TableCell>
                    <TableCell className="whitespace-normal break-words px-1.5 py-2">{record.material}</TableCell>
                    <TableCell className="whitespace-normal break-words px-1.5 py-2">{formatDate(record.sampleDate)}</TableCell>
                    <TableCell className="whitespace-normal break-words px-1.5 py-2">{record.testedBy}</TableCell>
                    <TableCell className="px-1.5 py-2">{getStatusBadge(record.status)}</TableCell>
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
