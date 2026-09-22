import { useState } from "react";
import { useListRecords, TestType, RecordStatus } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { CheckCircle2, AlertTriangle, XCircle, Search, Plus, Filter, Printer } from "lucide-react";
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
      case RecordStatus.Passed: return <Badge variant="success"><CheckCircle2 className="w-3 h-3 mr-1" /> Passed</Badge>;
      case RecordStatus.Review: return <Badge variant="warning"><AlertTriangle className="w-3 h-3 mr-1" /> Review</Badge>;
      case RecordStatus.Failed: return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" /> Failed</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6 flex flex-col h-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">QC Register</h1>
          <p className="text-muted-foreground mt-1 text-sm">Comprehensive searchable list of all quality control tests.</p>
        </div>
         {canEditQc && (
           <Link href="/records/new" className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring bg-primary text-primary-foreground shadow hover:bg-primary/90 h-10 px-6">
             <Plus className="w-4 h-4 mr-2" />
             New Record
           </Link>
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
          <Table className="min-w-[760px]">
            <TableHeader className="sticky top-0 bg-card z-10 shadow-sm">
              <TableRow>
                <TableHead className="w-[120px]">Record No.</TableHead>
                <TableHead className="w-[150px]">Test Type</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Material</TableHead>
                <TableHead>Sample Date</TableHead>
                <TableHead>Tested By</TableHead>
                <TableHead className="w-[100px]">Status</TableHead>
                <TableHead className="text-right w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center h-48 text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
                      Loading register...
                    </div>
                  </TableCell>
                </TableRow>
              ) : records?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center h-48 text-muted-foreground">
                    <div className="flex flex-col items-center justify-center">
                      <Search className="w-10 h-10 text-muted-foreground/30 mb-2" />
                      <p>No records found matching your filters.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                records?.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="font-semibold text-primary">{record.recordNo}</TableCell>
                    <TableCell>
                      <span className="font-medium bg-muted px-2 py-1 rounded-sm text-xs">
                        {record.testType}
                      </span>
                    </TableCell>
                    <TableCell className="truncate max-w-[150px]">{record.location}</TableCell>
                    <TableCell className="truncate max-w-[150px]">{record.material}</TableCell>
                    <TableCell>{formatDate(record.sampleDate)}</TableCell>
                    <TableCell>{record.testedBy}</TableCell>
                    <TableCell>{getStatusBadge(record.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Link
                          href={`/records/${record.id}`}
                          className="inline-flex h-8 items-center justify-center rounded-md bg-secondary text-secondary-foreground px-3 text-xs font-medium shadow-sm transition-colors hover:bg-secondary/80"
                        >
                          View
                        </Link>
                        <Link
                          href={`/reports/${record.id}`}
                          className="inline-flex h-8 items-center justify-center rounded-md border border-input bg-background px-3 text-xs font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                        >
                          <Printer className="mr-1.5 h-3.5 w-3.5" />
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
