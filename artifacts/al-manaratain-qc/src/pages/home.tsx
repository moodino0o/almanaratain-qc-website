import { listArchive, useGetDashboard, useListRecords } from "@workspace/api-client-react";
import { useAuth } from "@workspace/replit-auth-web";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { CheckCircle2, AlertTriangle, XCircle, Plus, FileText, BarChart3, Clock, Search, FolderOpen } from "lucide-react";
import { Input } from "@/components/ui/input";
import { formatDateTime } from "@/lib/utils";

export default function Home() {
  const { data: dashboard, isLoading, error } = useGetDashboard();
  const { isAuthenticated } = useAuth();
  const [recordSearch, setRecordSearch] = useState("");
  const [documentSearch, setDocumentSearch] = useState("");
  const { data: matchingRecords } = useListRecords({ search: recordSearch || undefined });
  const { data: archive } = useQuery({ queryKey: ["archive"], queryFn: () => listArchive(), enabled: isAuthenticated });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
          <p className="text-muted-foreground font-medium">Loading Dashboard...</p>
        </div>
      </div>
    );
  }

  if (error || !dashboard) {
    return (
      <div className="bg-destructive/10 text-destructive p-6 rounded-lg flex items-center gap-3">
        <AlertTriangle className="w-6 h-6" />
        <div>
          <h3 className="font-semibold text-lg">Dashboard failed to load</h3>
          <p className="text-sm opacity-90">Please check your connection and try again.</p>
        </div>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Passed": return <Badge variant="success"><CheckCircle2 className="w-3 h-3 mr-1" /> Passed</Badge>;
      case "Review": return <Badge variant="warning"><AlertTriangle className="w-3 h-3 mr-1" /> Review</Badge>;
      case "Failed": return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" /> Failed</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Control Room Overview</h1>
          <p className="text-muted-foreground mt-1 text-sm">Real-time quality control metrics and recent laboratory activity.</p>
        </div>
        <Link href="/records/new" className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground shadow hover:bg-primary/90 h-10 px-6">
          <Plus className="w-4 h-4 mr-2" />
          New QC Record
        </Link>
      </div>

      <Card className="border-t-4 border-t-primary">
        <CardHeader className="pb-3"><CardTitle className="text-base">Search quality records and documents</CardTitle><CardDescription>Search Ready Mix by customer, location, mix design, or reference number.</CardDescription></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-9" value={recordSearch} onChange={(event) => setRecordSearch(event.target.value)} placeholder="Customer, location, mix design, reference number…" /></div>
          <div className="relative"><FolderOpen className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-9" value={documentSearch} onChange={(event) => setDocumentSearch(event.target.value)} placeholder={isAuthenticated ? "Search archive documents…" : "Sign in to search archive documents"} disabled={!isAuthenticated} /></div>
        </CardContent>
      </Card>

      {(recordSearch || documentSearch) && <div className="grid gap-6 lg:grid-cols-2">
        {recordSearch && <Card><CardHeader><CardTitle>Matching QC records</CardTitle></CardHeader><CardContent className="space-y-2">{(matchingRecords ?? []).slice(0, 8).map((record) => { const details = record.details as Record<string, unknown>; return <Link key={record.id} href={`/records/${record.id}`} className="flex items-center gap-3 rounded border p-3 hover:bg-muted"><span className="min-w-[120px] font-semibold text-primary">{String(details.referenceNumber || record.recordNo)}</span><span className="min-w-0 flex-1 truncate">{record.testType} · {record.material}</span><span className="text-xs text-muted-foreground">{record.location}</span></Link>; })}{matchingRecords?.length === 0 && <p className="text-sm text-muted-foreground">No matching records.</p>}</CardContent></Card>}
        {documentSearch && isAuthenticated && <Card><CardHeader><CardTitle>Matching archive documents</CardTitle></CardHeader><CardContent className="space-y-2">{(archive?.documents ?? []).filter((doc) => `${doc.originalName} ${doc.category} ${doc.subcategory} ${doc.description}`.toLowerCase().includes(documentSearch.toLowerCase())).slice(0, 8).map((doc) => <a key={doc.id} href={`/api/archive/documents/${doc.id}/download`} className="block rounded border p-3 hover:bg-muted"><span className="block font-medium">{doc.originalName}</span><span className="text-xs text-muted-foreground">{doc.category} / {doc.subcategory} · {doc.documentDate}</span></a>)}{archive?.documents.filter((doc) => `${doc.originalName} ${doc.category} ${doc.subcategory} ${doc.description}`.toLowerCase().includes(documentSearch.toLowerCase())).length === 0 && <p className="text-sm text-muted-foreground">No matching documents.</p>}</CardContent></Card>}
      </div>}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Records</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboard.totalRecords.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">
              +{dashboard.recordsThisMonth} this month
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-success">Passed Quality</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{dashboard.passedRecords.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {((dashboard.passedRecords / Math.max(dashboard.totalRecords, 1)) * 100).toFixed(1)}% pass rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-warning">Pending Review</CardTitle>
            <AlertTriangle className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">{dashboard.reviewRecords.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Require supervisor approval
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-destructive">Failed Tests</CardTitle>
            <XCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{dashboard.failedRecords.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Immediate action required
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              Recent QC Records
            </CardTitle>
            <CardDescription>
              Latest tests submitted to the quality control register.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference / Record No.</TableHead>
                  <TableHead>Test Type</TableHead>
                  <TableHead>Material</TableHead>
                  <TableHead>Sample Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dashboard.recentRecords.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">
                      No records found
                    </TableCell>
                  </TableRow>
                ) : (
                  dashboard.recentRecords.map((record) => (
                    <TableRow key={record.id}>
                        <TableCell className="font-medium">{String((record.details as Record<string, unknown>).referenceNumber || record.recordNo)}</TableCell>
                      <TableCell>{record.testType}</TableCell>
                      <TableCell>{record.material}</TableCell>
                      <TableCell>{formatDateTime(record.sampleDate)}</TableCell>
                      <TableCell>{getStatusBadge(record.status)}</TableCell>
                      <TableCell className="text-right">
                        <Link 
                          href={`/records/${record.id}`}
                          className="inline-flex h-8 items-center justify-center rounded-md border border-input bg-background px-3 text-xs font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                        >
                          View
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" />
              Tests by Type
            </CardTitle>
            <CardDescription>
              Distribution of all tests.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {dashboard.byType.map((typeData) => {
                const max = Math.max(...dashboard.byType.map(d => d.count), 1);
                const percent = (typeData.count / max) * 100;
                
                return (
                  <div key={typeData.testType} className="space-y-1.5">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium text-foreground">{typeData.testType}</span>
                      <span className="text-muted-foreground font-medium">{typeData.count.toLocaleString()}</span>
                    </div>
                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary rounded-full" 
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
