import { useState } from "react";
import { useListRecords, TestType, RecordStatus } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { CheckCircle2, Search, Filter, Printer, FileText, Download } from "lucide-react";
import { formatDate } from "@/lib/utils";

export default function Reports() {
  const [search, setSearch] = useState("");
  const [testType, setTestType] = useState<TestType | "All">("All");

  const { data: records, isLoading } = useListRecords({ 
    search: search || undefined, 
    testType: testType === "All" ? undefined : testType 
  });

  // Only show passed records or all? Reports usually for passed, but we'll show all and highlight.
  const displayRecords = records?.filter(r => r.status === RecordStatus.Passed) || [];

  return (
    <div className="space-y-6 flex flex-col h-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">QC Certificates</h1>
          <p className="text-muted-foreground mt-1 text-sm">Generate and print official quality control certificates.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 shrink-0">
        <Card className="bg-primary text-primary-foreground border-primary">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5" /> Ready for Certificate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{displayRecords.length}</div>
            <p className="text-sm opacity-80 mt-1">Records with 'Passed' status</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="w-5 h-5 text-muted-foreground" /> Export Data
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">Download the current view as a spreadsheet for external analysis.</p>
            <Button variant="outline" className="w-full" disabled={displayRecords.length === 0}>
              <Download className="w-4 h-4 mr-2" /> Export to CSV
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="flex-1 flex flex-col min-h-0">
        <CardHeader className="pb-4 shrink-0">
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Search passed records..." 
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
          <Table className="min-w-[700px]">
            <TableHeader className="sticky top-0 bg-card z-10 shadow-sm">
              <TableRow>
                <TableHead className="w-[120px]">Record No.</TableHead>
                <TableHead>Test Type</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Material</TableHead>
                <TableHead>Sample Date</TableHead>
                <TableHead className="text-right w-[150px]">Certificate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center h-48 text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
                      Loading records...
                    </div>
                  </TableCell>
                </TableRow>
              ) : displayRecords.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center h-48 text-muted-foreground">
                    <div className="flex flex-col items-center justify-center">
                      <FileText className="w-10 h-10 text-muted-foreground/30 mb-2" />
                      <p>No passed records available for certificates.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                displayRecords.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="font-semibold text-primary">{record.recordNo}</TableCell>
                    <TableCell>{record.testType}</TableCell>
                    <TableCell>{record.location}</TableCell>
                    <TableCell>{record.material}</TableCell>
                    <TableCell>{formatDate(record.sampleDate)}</TableCell>
                    <TableCell className="text-right">
                      <Link 
                        href={`/reports/${record.id}`}
                        className="inline-flex h-8 items-center justify-center rounded-md bg-secondary text-secondary-foreground px-3 text-xs font-medium shadow-sm transition-colors hover:bg-secondary/80"
                      >
                        <Printer className="w-3 h-3 mr-2" />
                        Print
                      </Link>
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
