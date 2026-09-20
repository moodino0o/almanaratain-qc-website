import { useState } from "react";
import { Link } from "wouter";
import { useGetDashboard, useListRecords } from "@workspace/api-client-react";
import {
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  FileText,
  Inbox,
  MessageSquareWarning,
  Plus,
  RefreshCw,
  Search,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/utils";

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  detail: string;
  icon: typeof FileText;
  tone: "neutral" | "success" | "warning" | "danger";
}) {
  const toneClasses = {
    neutral: "border-border bg-card",
    success: "border-border bg-card",
    warning: "border-border bg-card",
    danger: "border-border bg-card",
  };
  const iconClasses = {
    neutral: "bg-muted text-muted-foreground",
    success: "bg-success/10 text-success",
    warning: "bg-warning/10 text-warning",
    danger: "bg-destructive/10 text-destructive",
  };
  const labelClasses = {
    neutral: "text-muted-foreground",
    success: "text-success",
    warning: "text-warning",
    danger: "text-destructive",
  };
  const valueClasses = {
    neutral: "text-foreground",
    success: "text-success",
    warning: "text-warning",
    danger: "text-destructive",
  };

  return (
    <Card className={`overflow-hidden border shadow-none ${toneClasses[tone]}`}>
      <CardContent className="flex items-start justify-between gap-3 p-5">
        <div className="min-w-0">
          <p className={`text-[11px] font-bold uppercase tracking-[0.14em] ${labelClasses[tone]}`}>{label}</p>
          <p className={`mt-2 text-3xl font-bold tracking-tight ${valueClasses[tone]}`}>{value.toLocaleString()}</p>
          <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
        </div>
        <span className={`rounded-lg p-2.5 ${iconClasses[tone]}`}>
          <Icon className="h-5 w-5" />
        </span>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "Passed":
      return (
        <Badge variant="success">
          <CheckCircle2 className="mr-1 h-3 w-3" /> Passed
        </Badge>
      );
    case "Review":
      return (
        <Badge variant="warning">
          <AlertTriangle className="mr-1 h-3 w-3" /> Review
        </Badge>
      );
    case "Failed":
      return (
        <Badge variant="destructive">
          <XCircle className="mr-1 h-3 w-3" /> Failed
        </Badge>
      );
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

export default function Home() {
  const dashboardQuery = useGetDashboard();
  const [recordSearch, setRecordSearch] = useState("");
  const recordsQuery = useListRecords({ search: recordSearch || undefined });
  const dashboard = dashboardQuery.data;

  if (dashboardQuery.isLoading) {
    return (
      <div className="space-y-7" aria-label="Loading dashboard">
        <div className="space-y-3">
          <div className="h-3 w-28 animate-pulse rounded bg-muted" />
          <div className="h-10 w-72 max-w-full animate-pulse rounded bg-muted" />
          <div className="h-4 w-[30rem] max-w-full animate-pulse rounded bg-muted" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((item) => <div key={item} className="h-32 animate-pulse rounded-lg bg-muted" />)}
        </div>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)]">
          <div className="h-80 animate-pulse rounded-lg bg-muted" />
          <div className="h-80 animate-pulse rounded-lg bg-muted" />
        </div>
      </div>
    );
  }

  if (dashboardQuery.isError || !dashboard) {
    return (
      <Card className="mx-auto mt-10 max-w-lg border-destructive/30 text-center">
        <CardContent className="space-y-4 p-10">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">Dashboard failed to load</h1>
            <p className="mt-1 text-sm text-muted-foreground">Check the connection and try again.</p>
          </div>
          <Button variant="outline" onClick={() => void dashboardQuery.refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" /> Try again
          </Button>
        </CardContent>
      </Card>
    );
  }

  const passRate = (dashboard.passedRecords / Math.max(dashboard.totalRecords, 1)) * 100;
  const maxTypeCount = Math.max(...dashboard.byType.map((item) => item.count), 1);
  const records = recordsQuery.data ?? [];

  return (
    <div className="space-y-7 pb-10">
      <header className="flex flex-col gap-5 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">Quality control / daily view</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">Good morning, keep quality moving.</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            See the tests and customer concerns that need attention, then move straight to the right register.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/complaints/new"><MessageSquareWarning className="mr-2 h-4 w-4" /> New complaint</Link>
          </Button>
          <Button asChild>
            <Link href="/records/new"><Plus className="mr-2 h-4 w-4" /> New QC record</Link>
          </Button>
        </div>
      </header>

      <section aria-labelledby="complaints-heading" className="rounded-xl border border-primary/20 bg-primary/[0.045] p-4 sm:p-5">
        <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary">Customer care</p>
            <h2 id="complaints-heading" className="mt-1 text-xl font-bold tracking-tight">Complaints at a glance</h2>
          </div>
          <Link href="/complaints" className="inline-flex items-center text-sm font-semibold text-primary hover:underline">
            Open complaint register <ArrowUpRight className="ml-1.5 h-4 w-4" />
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Link href="/complaints" className="group rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-primary/[0.03]">
            <div className="flex items-center justify-between">
              <span className="rounded-md bg-primary/10 p-2 text-primary"><Inbox className="h-4 w-4" /></span>
              <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </div>
            <p className="mt-4 text-2xl font-bold">{dashboard.totalComplaints.toLocaleString()}</p>
            <p className="mt-1 text-xs font-medium text-muted-foreground">Total complaints</p>
          </Link>
          <Link href="/complaints" className="group rounded-lg border border-border bg-card p-4 transition-colors hover:border-warning/40 hover:bg-warning/5">
            <div className="flex items-center justify-between">
              <span className="rounded-md bg-warning/10 p-2 text-warning"><Clock3 className="h-4 w-4" /></span>
              <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </div>
            <p className="mt-4 text-2xl font-bold">{dashboard.openComplaints.toLocaleString()}</p>
            <p className="mt-1 text-xs font-medium text-muted-foreground">Open complaints</p>
          </Link>
          <Link href="/complaints" className="group rounded-lg border border-border bg-card p-4 transition-colors hover:border-success/40 hover:bg-success/5">
            <div className="flex items-center justify-between">
              <span className="rounded-md bg-success/10 p-2 text-success"><CheckCircle2 className="h-4 w-4" /></span>
              <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </div>
            <p className="mt-4 text-2xl font-bold">{dashboard.solvedComplaints.toLocaleString()}</p>
            <p className="mt-1 text-xs font-medium text-muted-foreground">Solved complaints</p>
          </Link>
        </div>
      </section>

      <section aria-labelledby="qc-heading">
        <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Laboratory register</p>
            <h2 id="qc-heading" className="mt-1 text-xl font-bold tracking-tight">QC test status</h2>
          </div>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><CalendarDays className="h-3.5 w-3.5" /> {dashboard.recordsThisMonth.toLocaleString()} records this month</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="All records" value={dashboard.totalRecords} detail="In the QC register" icon={FileText} tone="neutral" />
          <MetricCard label="Passed" value={dashboard.passedRecords} detail={`${passRate.toFixed(1)}% pass rate`} icon={CheckCircle2} tone="success" />
          <MetricCard label="Needs review" value={dashboard.reviewRecords} detail="Supervisor approval needed" icon={AlertTriangle} tone="warning" />
          <MetricCard label="Failed" value={dashboard.failedRecords} detail="Immediate action required" icon={XCircle} tone="danger" />
        </div>
      </section>

      <Card className="border-t-4 border-t-primary shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><Search className="h-4 w-4 text-primary" /> Find a QC record</CardTitle>
          <CardDescription>Search by customer, location, mix design, or reference number.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="h-11 pl-9" value={recordSearch} onChange={(event) => setRecordSearch(event.target.value)} placeholder="Start typing to search the QC register…" />
          </div>
        </CardContent>
      </Card>

      {recordSearch && (
        <Card className="shadow-none">
          <CardHeader className="border-b bg-muted/20 py-4">
            <CardTitle className="text-base">Matching QC records</CardTitle>
            <CardDescription>{recordsQuery.isLoading ? "Searching the register…" : `${records.length} result${records.length === 1 ? "" : "s"}`}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 p-3">
            {!recordsQuery.isLoading && records.slice(0, 8).map((record) => {
              const details = record.details as Record<string, unknown>;
              return (
                <Link key={record.id} href={`/records/${record.id}`} className="flex items-center gap-3 rounded-md border border-transparent p-3 transition-colors hover:border-border hover:bg-muted/40">
                  <span className="min-w-0 flex-1 truncate font-semibold text-primary">{String(details.referenceNumber || record.recordNo)}</span>
                  <span className="hidden truncate text-sm text-muted-foreground sm:block">{record.testType} · {record.material}</span>
                  <span className="hidden text-xs text-muted-foreground md:block">{record.location}</span>
                  <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </Link>
              );
            })}
            {!recordsQuery.isLoading && records.length === 0 && (
              <div className="flex flex-col items-center gap-2 p-7 text-center">
                <ClipboardCheck className="h-7 w-7 text-muted-foreground" />
                <p className="text-sm font-medium">No matching records</p>
                <p className="text-xs text-muted-foreground">Try a reference number, customer, or location.</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)]">
        <Card className="overflow-hidden shadow-none">
          <CardHeader className="border-b bg-card pb-4">
            <CardTitle className="flex items-center gap-2 text-base"><Clock3 className="h-4 w-4 text-primary" /> Recent QC records</CardTitle>
            <CardDescription>Latest tests submitted to the quality register.</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <Table className="min-w-[640px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-5">Reference</TableHead>
                  <TableHead>Test type</TableHead>
                  <TableHead>Material</TableHead>
                  <TableHead>Sample date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="pr-5 text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dashboard.recentRecords.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="h-28 text-center text-sm text-muted-foreground">No QC records have been submitted yet.</TableCell></TableRow>
                ) : dashboard.recentRecords.map((record) => {
                  const details = record.details as Record<string, unknown>;
                  return (
                    <TableRow key={record.id}>
                      <TableCell className="pl-5 font-semibold text-primary">{String(details.referenceNumber || record.recordNo)}</TableCell>
                      <TableCell>{record.testType}</TableCell>
                      <TableCell>{record.material}</TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">{formatDate(record.sampleDate)}</TableCell>
                      <TableCell><StatusBadge status={record.status} /></TableCell>
                      <TableCell className="pr-5 text-right"><Button asChild variant="ghost" size="sm"><Link href={`/records/${record.id}`}>View <ArrowUpRight className="ml-1.5 h-3.5 w-3.5" /></Link></Button></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardHeader className="border-b bg-card pb-4">
            <CardTitle className="flex items-center gap-2 text-base"><BarChart3 className="h-4 w-4 text-primary" /> Tests by type</CardTitle>
            <CardDescription>Distribution across the full register.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 pt-5">
            {dashboard.byType.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-9 text-center">
                <BarChart3 className="h-7 w-7 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No test type data yet.</p>
              </div>
            ) : dashboard.byType.map((typeData) => (
              <div key={typeData.testType} className="space-y-2">
                <div className="flex justify-between gap-3 text-sm">
                  <span className="truncate font-medium">{typeData.testType}</span>
                  <span className="shrink-0 font-semibold text-muted-foreground">{typeData.count.toLocaleString()}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${(typeData.count / maxTypeCount) * 100}%` }} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}