import { useMemo, useState } from "react";
import { Link } from "wouter";
import { AlertCircle, ArrowUpRight, CheckCircle2, Clock3, Download, FileWarning, Filter, Plus, Search, ShieldCheck } from "lucide-react";
import { getListComplaintsQueryKey, useListComplaints, useUpdateComplaint, type Complaint } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@workspace/replit-auth-web";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { complaintCategory, type ComplaintCategory } from "./complaints-utils";

function displayDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(date);
}

function escapeCsv(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function exportComplaints(rows: Complaint[]) {
  const header = ["Complaint No.", "Customer", "Delivery date", "Complaint type", "Material type", "Category", "Details", "Solution", "Recommendation", "Picture count", "Picture names", "Created", "Updated"];
  const lines = rows.map((complaint) => [
    complaint.complaintNo,
    complaint.customerName,
    complaint.deliveryDate,
    complaint.complaintType,
    complaint.materialType,
    complaintCategory(complaint.materialType),
    complaint.details,
    complaint.solution,
    complaint.recommendation,
    complaint.picturePaths.length,
    complaint.picturePaths.map((picture) => picture.originalName).join("; "),
    complaint.createdAt,
    complaint.updatedAt,
  ].map(escapeCsv).join(","));
  const blob = new Blob(["\ufeff", [header.map(escapeCsv).join(","), ...lines].join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `al-manaratain-complaints-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function availability(value: string) {
  return value.trim() ? "Recorded" : "Pending";
}

export default function Complaints() {
  const { role } = useAuth();
  const canEditComplaints = role === "managerial" || role === "administrator";
  const complaintsQuery = useListComplaints();
  const updateComplaint = useUpdateComplaint();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [materialFilter, setMaterialFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState<ComplaintCategory | "all">("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const complaints = complaintsQuery.data ?? [];
  const typeOptions = useMemo(() => [...new Set(complaints.map((item) => item.complaintType))].sort(), [complaints]);
  const materialOptions = useMemo(() => [...new Set(complaints.map((item) => item.materialType))].sort(), [complaints]);
  const activeFilterCount = [typeFilter, materialFilter, statusFilter, categoryFilter, fromDate, toDate]
    .filter((value) => value && value !== "all").length;
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return complaints.filter((complaint) => {
      const category = complaintCategory(complaint.materialType);
      const searchable = `${complaint.complaintNo} ${complaint.customerName} ${complaint.complaintType} ${complaint.materialType} ${category} ${complaint.details} ${complaint.deliveryDate} ${displayDate(complaint.deliveryDate)}`.toLowerCase();
      return (!term || searchable.includes(term)) &&
        (typeFilter === "all" || complaint.complaintType === typeFilter) &&
        (materialFilter === "all" || complaint.materialType === materialFilter) &&
        (categoryFilter === "all" || complaintCategory(complaint.materialType) === categoryFilter) &&
        (statusFilter === "all" || complaint.status === statusFilter) &&
        (!fromDate || complaint.deliveryDate >= fromDate) &&
        (!toDate || complaint.deliveryDate <= toDate);
    });
  }, [categoryFilter, complaints, fromDate, materialFilter, search, statusFilter, toDate, typeFilter]);

  async function markComplete(id: number) {
    try {
      await updateComplaint.mutateAsync({ id, data: { status: "complete" } });
      await queryClient.invalidateQueries({ queryKey: getListComplaintsQueryKey() });
      toast.success("Complaint marked complete");
    } catch {
      toast.error("The complaint could not be marked complete.");
    }
  }

  if (complaintsQuery.isLoading) {
    return <div className="space-y-5 complaint-page"><div className="h-8 w-56 animate-pulse rounded bg-muted" /><div className="h-24 animate-pulse rounded-xl bg-muted" /><div className="h-80 animate-pulse rounded-xl bg-muted" /></div>;
  }

  if (complaintsQuery.isError) {
    return <Card className="mx-auto mt-12 max-w-lg text-center"><CardContent className="space-y-4 p-10"><AlertCircle className="mx-auto h-10 w-10 text-destructive" /><div><h1 className="text-lg font-semibold">Complaints could not be loaded</h1><p className="mt-1 text-sm text-muted-foreground">Check the connection and try again.</p></div><Button variant="outline" onClick={() => void complaintsQuery.refetch()}>Try again</Button></CardContent></Card>;
  }

  return (
    <div className="complaint-page space-y-6 pb-10">
      <header className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="complaint-kicker">Customer care / evidence register</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Complaints</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Record concerns precisely, preserve the evidence, and keep every resolution visible to the QC team.</p>
        </div>
        <div className="flex flex-wrap gap-2">
           <Button variant="outline" onClick={() => exportComplaints(complaints)} disabled={!complaints.length}><Download className="mr-2 h-4 w-4" />Export loaded rows</Button>
           {canEditComplaints && <Button asChild><Link href="/complaints/new"><Plus className="mr-2 h-4 w-4" />New complaint</Link></Button>}
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-primary"><CardContent className="flex items-center justify-between p-4"><div><p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Total records</p><p className="mt-1 text-2xl font-bold">{complaints.length}</p></div><FileWarning className="h-6 w-6 text-primary" /></CardContent></Card>
        <Card className="border-l-4 border-l-amber-500"><CardContent className="flex items-center justify-between p-4"><div><p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">With evidence</p><p className="mt-1 text-2xl font-bold">{complaints.filter((item) => item.picturePaths.length > 0).length}</p></div><ShieldCheck className="h-6 w-6 text-amber-600" /></CardContent></Card>
        <Card className="border-l-4 border-l-sky-600"><CardContent className="flex items-center justify-between p-4"><div><p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Open</p><p className="mt-1 text-2xl font-bold">{complaints.filter((item) => item.status === "open").length}</p></div><Clock3 className="h-6 w-6 text-sky-600" /></CardContent></Card>
        <Card className="border-l-4 border-l-emerald-600"><CardContent className="flex items-center justify-between p-4"><div><p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Complete</p><p className="mt-1 text-2xl font-bold">{complaints.filter((item) => item.status === "complete").length}</p></div><CheckCircle2 className="h-6 w-6 text-emerald-600" /></CardContent></Card>
      </section>

       <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 border-b bg-muted/25 pb-4"><CardTitle className="text-base">Find a complaint</CardTitle><Button type="button" variant="outline" size="sm" onClick={() => setFiltersOpen((open) => !open)}><Filter className="mr-2 h-4 w-4" />{filtersOpen ? "Hide filters" : "Show filters"}{activeFilterCount > 0 && <Badge className="ml-2" variant="secondary">{activeFilterCount}</Badge>}</Button></CardHeader>
         <CardContent className="p-4">
           <label className="relative block"><span className="sr-only">Search complaints, including dates</span><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search number, customer, material, details, or date" /></label>
           {filtersOpen && <div className="mt-4 grid gap-3 border-t pt-4 md:grid-cols-2 xl:grid-cols-3">
             <label><span className="sr-only">Filter complaint type</span><select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}><option value="all">All complaint types</option>{typeOptions.map((item) => <option key={item}>{item}</option>)}</select></label>
             <label><span className="sr-only">Filter material type</span><select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={materialFilter} onChange={(event) => setMaterialFilter(event.target.value)}><option value="all">All materials</option>{materialOptions.map((item) => <option key={item}>{item}</option>)}</select></label>
             <label><span className="sr-only">Filter product category</span><select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value as ComplaintCategory | "all")}><option value="all">All categories</option><option value="Ready Mix">Ready Mix</option><option value="Block">Block</option><option value="Paving">Paving</option><option value="Sand">Sand</option><option value="Other">Other</option></select></label>
             <label><span className="sr-only">Filter complaint status</span><select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">All statuses</option><option value="open">Open / uncompleted</option><option value="complete">Complete / closed</option></select></label>
             <label className="space-y-1"><span className="text-xs font-medium text-muted-foreground">From date</span><Input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} aria-label="Filter complaints from date" /></label>
             <label className="space-y-1"><span className="text-xs font-medium text-muted-foreground">To date</span><Input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} aria-label="Filter complaints to date" /></label>
           </div>}
         </CardContent>
       </Card>

      <Card className="overflow-hidden">
         <CardHeader className="flex flex-row items-center justify-between border-b bg-card pb-4"><div><CardTitle className="text-base">Complaint register</CardTitle><p className="mt-1 text-sm text-muted-foreground">{filtered.length} loaded record{filtered.length === 1 ? "" : "s"}</p></div><Badge variant="outline">QC controlled</Badge></CardHeader>
            {filtered.length === 0 ? <CardContent className="flex flex-col items-center justify-center gap-3 p-14 text-center"><div className="rounded-full bg-muted p-4"><FileWarning className="h-7 w-7 text-muted-foreground" /></div><h2 className="text-lg font-semibold">{complaints.length ? "No complaints match those filters" : "No complaints recorded yet"}</h2><p className="max-w-md text-sm text-muted-foreground">{complaints.length ? "Try a broader search or clear one of the filters." : "No complaints have been recorded yet."}</p>{!complaints.length && canEditComplaints && <Button asChild><Link href="/complaints/new">Create first complaint</Link></Button>}</CardContent> : <div className="complaint-register-scroll"><table className="complaint-register-table w-full table-fixed text-xs"><colgroup><col className="w-[12%]" /><col className="w-[11%]" /><col className="w-[12%]" /><col className="w-[9%]" /><col className="w-[15%]" /><col className="w-[16%]" /><col className="w-[16%]" /><col className="w-[9%]" /></colgroup><thead className="sticky top-0 z-10 bg-muted/95 text-left text-[10px] uppercase tracking-wide text-muted-foreground"><tr><th>Complaint</th><th>Status</th><th>Customer</th><th>Delivery</th><th>Classification</th><th>Details</th><th>Follow-through</th><th className="text-right">Action</th></tr></thead><tbody className="divide-y">{filtered.map((complaint) => <tr key={complaint.id} className="align-top transition-colors hover:bg-muted/20"><td><Link href={`/complaints/${complaint.id}`} className="font-semibold text-primary hover:underline">{complaint.complaintNo}</Link><p className="mt-1 text-[10px] text-muted-foreground">Updated {displayDate(complaint.updatedAt)}</p></td><td><Badge variant={complaint.status === "complete" ? "success" : "secondary"}>{complaint.status === "complete" ? "Complete" : "Open"}</Badge>{canEditComplaints && complaint.status === "open" && <Button type="button" variant="outline" size="sm" className="mt-2 h-7 whitespace-normal px-1.5 text-[10px]" disabled={updateComplaint.isPending} onClick={() => void markComplete(complaint.id)}><CheckCircle2 className="mr-1 h-3 w-3 shrink-0" />Mark complete</Button>}</td><td className="font-medium">{complaint.customerName}</td><td className="text-muted-foreground">{displayDate(complaint.deliveryDate)}</td><td><p className="font-medium">{complaint.materialType}</p><div className="mt-1 flex flex-wrap items-center gap-1"><Badge variant="outline" className="text-[10px]">{complaintCategory(complaint.materialType)}</Badge></div></td><td className="text-muted-foreground"><p className="line-clamp-2">{complaint.details}</p></td><td><div className="flex flex-wrap gap-1"><Badge variant={complaint.solution.trim() ? "success" : "secondary"} className="text-[10px]">Solution: {availability(complaint.solution)}</Badge><Badge variant={complaint.recommendation.trim() ? "success" : "secondary"} className="text-[10px]">Recommendation: {availability(complaint.recommendation)}</Badge><span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground"><ShieldCheck className="h-3 w-3 shrink-0" />{complaint.picturePaths.length} picture{complaint.picturePaths.length === 1 ? "" : "s"}</span></div></td><td className="text-right"><Button asChild variant="ghost" size="sm" className="h-7 px-1 text-[10px]"><Link href={`/complaints/${complaint.id}`}>Review <ArrowUpRight className="ml-1 h-3 w-3" /></Link></Button></td></tr>)}</tbody></table><div className="sticky bottom-0 z-10 border-t bg-card/95 px-3 py-2 text-[11px] text-muted-foreground backdrop-blur">Showing {filtered.length} of {complaints.length} loaded record{complaints.length === 1 ? "" : "s"}</div></div>}
      </Card>
    </div>
  );
}