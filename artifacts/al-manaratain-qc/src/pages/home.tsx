import { useState } from "react";
import { Link } from "wouter";
import {
  getListComplaintsQueryKey,
  getListRecordsQueryKey,
  useGetDashboard,
  useListComplaints,
  useListRecords,
} from "@workspace/api-client-react";
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
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
import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/utils";
import { useAuth } from "@workspace/replit-auth-web";

function StatusSummary({
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
  const iconClasses = {
    neutral: "bg-muted text-muted-foreground",
    success: "bg-success/10 text-success",
    warning: "bg-warning/10 text-warning",
    danger: "bg-destructive/10 text-destructive",
  };
  const valueClasses = {
    neutral: "text-foreground",
    success: "text-success",
    warning: "text-warning",
    danger: "text-destructive",
  };

  return (
    <div className="flex items-center gap-3 rounded-md border border-border/70 bg-muted/20 p-3">
      <span className={`rounded-md p-2 ${iconClasses[tone]}`}>
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className={`text-xl font-bold tracking-tight ${valueClasses[tone]}`}>
          {value.toLocaleString()}
        </p>
        <p className="truncate text-[11px] text-muted-foreground">{detail}</p>
      </div>
    </div>
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
  const { role } = useAuth();
  const canViewComplaints = role !== "technician";
  const dashboardQuery = useGetDashboard();
  const [recordSearch, setRecordSearch] = useState("");
  const searchTerm = recordSearch.trim();
  const recordsSearchParams = { search: searchTerm || undefined, limit: 100 };
  const complaintsSearchParams = { search: searchTerm || undefined };
  const recordsQuery = useListRecords(
    recordsSearchParams,
    { query: { enabled: Boolean(searchTerm), queryKey: getListRecordsQueryKey(recordsSearchParams) } },
  );
  const complaintsQuery = useListComplaints(
    complaintsSearchParams,
    { query: { enabled: Boolean(searchTerm) && canViewComplaints, queryKey: getListComplaintsQueryKey(complaintsSearchParams) } },
  );
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
          {[1, 2, 3, 4].map((item) => (
            <div
              key={item}
              className="h-32 animate-pulse rounded-lg bg-muted"
            />
          ))}
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
            <p className="mt-1 text-sm text-muted-foreground">
              Check the connection and try again.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => void dashboardQuery.refetch()}
          >
            <RefreshCw className="mr-2 h-4 w-4" /> Try again
          </Button>
        </CardContent>
      </Card>
    );
  }

  const passRate =
    (dashboard.passedRecords / Math.max(dashboard.totalRecords, 1)) * 100;
  const records = recordsQuery.data ?? [];
  const complaints = canViewComplaints ? complaintsQuery.data ?? [] : [];
  const searchLoading = recordsQuery.isLoading || (canViewComplaints && complaintsQuery.isLoading);
  const complaintChartData = [
    {
      name: "Open",
      value: dashboard.openComplaints,
      color: "hsl(var(--warning) / 0.82)",
    },
    {
      name: "Solved",
      value: dashboard.solvedComplaints,
      color: "hsl(var(--success) / 0.78)",
    },
  ];
  const hasComplaintData = complaintChartData.some((item) => item.value > 0);

  return (
    <div className="space-y-7 pb-10">
      <header className="flex flex-col gap-5 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">
            Quality control / daily view
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Good morning, keep quality moving.
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            See the tests and customer concerns that need attention, then move
            straight to the right register.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canViewComplaints && <Button asChild variant="outline">
            <Link href="/complaints/new">
              <MessageSquareWarning className="mr-2 h-4 w-4" /> New complaint
            </Link>
          </Button>}
          <Button asChild>
            <Link href="/records/new">
              <Plus className="mr-2 h-4 w-4" /> New QC record
            </Link>
          </Button>
        </div>
      </header>

      <div className={canViewComplaints ? "grid items-start gap-6 md:grid-cols-[minmax(220px,0.72fr)_minmax(0,1.28fr)]" : "grid items-start gap-6"}>
        {canViewComplaints && <Card className="shadow-none">
          <CardHeader className="border-b bg-card px-4 pb-4">
            <div>
              <CardTitle id="complaints-heading" className="text-base">
                Complaints at a glance
              </CardTitle>
            </div>
            <Link
              href="/complaints"
              className="inline-flex items-center text-sm font-semibold text-primary hover:underline"
            >
              Open complaint register <ArrowUpRight className="ml-1.5 h-4 w-4" />
            </Link>
          </CardHeader>
          <CardContent className="p-3 sm:p-4">
            {hasComplaintData ? (
              <div className="relative h-[190px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
                    <Pie
                      data={complaintChartData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="42%"
                      innerRadius={48}
                      outerRadius={70}
                      paddingAngle={3}
                      stroke="hsl(var(--card))"
                      strokeWidth={3}
                    >
                      {complaintChartData.map((item) => (
                        <Cell key={item.name} fill={item.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number, name: string) => [
                        value.toLocaleString(),
                        name,
                      ]}
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "0.5rem",
                        color: "hsl(var(--foreground))",
                      }}
                    />
                    <Legend
                      verticalAlign="bottom"
                      iconType="circle"
                      wrapperStyle={{
                        color: "hsl(var(--muted-foreground))",
                        fontSize: "11px",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-x-0 top-[51px] flex flex-col items-center">
                  <span className="text-2xl font-bold tracking-tight">
                    {dashboard.totalComplaints.toLocaleString()}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    Total
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex h-[190px] flex-col items-center justify-center gap-2 text-center">
                <Inbox className="h-7 w-7 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No complaints yet.</p>
              </div>
            )}
          </CardContent>
        </Card>}

        <Card className="shadow-none">
          <CardHeader className="border-b bg-card pb-4">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <CardTitle id="qc-heading" className="text-base">QC test status</CardTitle>
              </div>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <CalendarDays className="h-3.5 w-3.5" /> {dashboard.recordsThisMonth.toLocaleString()} records this month
              </p>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <StatusSummary
                label="All records"
                value={dashboard.totalRecords}
                detail="In the QC register"
                icon={FileText}
                tone="neutral"
              />
              <StatusSummary
                label="Passed"
                value={dashboard.passedRecords}
                detail={`${passRate.toFixed(1)}% pass rate`}
                icon={CheckCircle2}
                tone="success"
              />
              <StatusSummary
                label="Needs review"
                value={dashboard.reviewRecords}
                detail="Supervisor approval needed"
                icon={AlertTriangle}
                tone="warning"
              />
              <StatusSummary
                label="Failed"
                value={dashboard.failedRecords}
                detail="Immediate action required"
                icon={XCircle}
                tone="danger"
              />
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
                <span>Overall pass rate</span>
                <span className="font-semibold text-foreground">{passRate.toFixed(1)}%</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-muted">
                <div
                  className="flex h-full items-center justify-end rounded-full bg-primary px-2 text-[10px] font-semibold text-primary-foreground"
                  style={{ width: `${Math.max(passRate, passRate > 0 ? 4 : 0)}%` }}
                >
                  {passRate >= 12 ? `${passRate.toFixed(0)}%` : ""}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-t-4 border-t-primary shadow-none">
        <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Search className="h-4 w-4 text-primary" /> Search {canViewComplaints ? "reports and complaints" : "QC reports"}
          </CardTitle>
          <CardDescription>
              {canViewComplaints
                ? "Search by customer, location, material, reference number, complaint number, or complaint details."
                : "Search by customer, location, material, or reference number."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-11 pl-9"
              value={recordSearch}
              onChange={(event) => setRecordSearch(event.target.value)}
              placeholder={canViewComplaints ? "Search all reports and complaints…" : "Search QC reports…"}
            />
          </div>
        </CardContent>
      </Card>

      {searchTerm && (
        <Card className="shadow-none">
          <CardHeader className="border-b bg-muted/20 py-4">
            <CardTitle className="text-base">Search results</CardTitle>
            <CardDescription>
              {searchLoading
                ? "Searching reports and complaints…"
                : canViewComplaints
                  ? `${records.length} report${records.length === 1 ? "" : "s"} · ${complaints.length} complaint${complaints.length === 1 ? "" : "s"}`
                  : `${records.length} report${records.length === 1 ? "" : "s"}`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 p-3">
            {!searchLoading && (recordsQuery.isError || (canViewComplaints && complaintsQuery.isError)) && (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                Some search results could not be loaded. Try the search again.
              </div>
            )}
            {!searchLoading && (
              <>
                {canViewComplaints && <section className="space-y-2">
                  <div className="flex items-center gap-2 border-b pb-2 text-sm font-semibold">
                    <ClipboardCheck className="h-4 w-4 text-primary" /> QC reports ({records.length})
                  </div>
                  {records.map((record) => {
                    const details = record.details as Record<string, unknown>;
                    return (
                      <Link
                        key={`record-${record.id}`}
                        href={`/reports/${record.id}`}
                        className="flex items-center gap-3 rounded-md border border-transparent p-3 transition-colors hover:border-border hover:bg-muted/40"
                      >
                        <span className="min-w-0 flex-1 truncate font-semibold text-primary">
                          {String(details.referenceNumber || record.recordNo)}
                        </span>
                        <span className="hidden truncate text-sm text-muted-foreground sm:block">
                          {record.testType} · {record.material}
                        </span>
                        <span className="hidden text-xs text-muted-foreground md:block">
                          {record.location}
                        </span>
                        <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                      </Link>
                    );
                  })}
                  {records.length === 0 && (
                    <p className="px-3 py-4 text-sm text-muted-foreground">No matching QC reports.</p>
                  )}
                </section>}
                <section className="space-y-2">
                  <div className="flex items-center gap-2 border-b pb-2 text-sm font-semibold">
                    <MessageSquareWarning className="h-4 w-4 text-primary" /> Complaints ({complaints.length})
                  </div>
                  {complaints.map((complaint) => (
                    <Link
                      key={`complaint-${complaint.id}`}
                      href={`/complaints/${complaint.id}`}
                      className="flex items-center gap-3 rounded-md border border-transparent p-3 transition-colors hover:border-border hover:bg-muted/40"
                    >
                      <span className="min-w-0 flex-1 truncate font-semibold text-primary">
                        {complaint.complaintNo}
                      </span>
                      <span className="hidden truncate text-sm text-muted-foreground sm:block">
                        {complaint.customerName} · {complaint.materialType}
                      </span>
                      <span className="hidden text-xs text-muted-foreground md:block">
                        {complaint.complaintType}
                      </span>
                      <Badge variant={complaint.status === "complete" ? "success" : "warning"}>
                        {complaint.status === "complete" ? "Complete" : "Open"}
                      </Badge>
                      <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </Link>
                  ))}
                  {complaints.length === 0 && (
                    <p className="px-3 py-4 text-sm text-muted-foreground">No matching complaints.</p>
                  )}
                </section>
              </>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="overflow-hidden shadow-none">
          <CardHeader className="border-b bg-card pb-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock3 className="h-4 w-4 text-primary" /> Recent QC records
            </CardTitle>
            <CardDescription>
              Latest tests submitted to the quality register.
            </CardDescription>
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
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="h-28 text-center text-sm text-muted-foreground"
                    >
                      No QC records have been submitted yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  dashboard.recentRecords.map((record) => {
                    const details = record.details as Record<string, unknown>;
                    return (
                      <TableRow key={record.id}>
                        <TableCell className="pl-5 font-semibold text-primary">
                          {String(details.referenceNumber || record.recordNo)}
                        </TableCell>
                        <TableCell>{record.testType}</TableCell>
                        <TableCell>{record.material}</TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {formatDate(record.sampleDate)}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={record.status} />
                        </TableCell>
                        <TableCell className="pr-5 text-right">
                          <Button asChild variant="ghost" size="sm">
                            <Link href={`/records/${record.id}`}>
                              View{" "}
                              <ArrowUpRight className="ml-1.5 h-3.5 w-3.5" />
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
      </Card>
    </div>
  );
}
