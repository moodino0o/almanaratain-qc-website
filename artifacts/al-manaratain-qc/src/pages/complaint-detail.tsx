import { useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { ArrowLeft, CalendarDays, CheckCircle2, Edit2, FileImage, Printer, Trash2 } from "lucide-react";
import { useDeleteComplaint, useGetComplaint, useUpdateComplaint, getGetComplaintQueryKey, getListComplaintsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { useAuth } from "@workspace/replit-auth-web";

function displayDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" }).format(date);
}

function DetailField({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return <div className={wide ? "md:col-span-2" : ""}><p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6">{value || "Not recorded"}</p></div>;
}

export default function ComplaintDetail() {
  const { role } = useAuth();
  const canEditComplaints = role === "managerial" || role === "administrator";
  const { id } = useParams();
  const complaintId = Number(id);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const complaintQuery = useGetComplaint(complaintId);
  const deleteComplaint = useDeleteComplaint();
  const updateComplaint = useUpdateComplaint();
  const [deleting, setDeleting] = useState(false);
  const complaint = complaintQuery.data;

  async function markComplete() {
    try {
      await updateComplaint.mutateAsync({ id: complaintId, data: { status: "complete" } });
      await queryClient.invalidateQueries({ queryKey: getGetComplaintQueryKey(complaintId) });
      await queryClient.invalidateQueries({ queryKey: getListComplaintsQueryKey() });
      toast.success("Complaint marked complete");
    } catch {
      toast.error("The complaint could not be marked complete.");
    }
  }

  function remove() {
    if (!complaint || !window.confirm(`Delete complaint ${complaint.complaintNo}? This action cannot be undone.`)) return;
    setDeleting(true);
    deleteComplaint.mutate({ id: complaintId }, {
      onSuccess: () => {
        toast.success("Complaint deleted");
        queryClient.removeQueries({ queryKey: getGetComplaintQueryKey(complaintId) });
        queryClient.invalidateQueries({ queryKey: getListComplaintsQueryKey() });
        setLocation("/complaints");
      },
      onError: () => {
        toast.error("Complaint could not be deleted.");
        setDeleting(false);
      },
    });
  }

  if (complaintQuery.isLoading) return <div className="space-y-5"><div className="h-8 w-64 animate-pulse rounded bg-muted" /><div className="h-36 animate-pulse rounded-xl bg-muted" /><div className="h-72 animate-pulse rounded-xl bg-muted" /></div>;
  if (complaintQuery.isError || !complaint) return <Card className="mx-auto mt-10 max-w-lg text-center"><CardContent className="space-y-4 p-10"><h1 className="text-lg font-semibold">Complaint not found</h1><p className="text-sm text-muted-foreground">The record may have been removed or you may not have access to it.</p><Button asChild variant="outline"><Link href="/complaints">Back to complaints</Link></Button></CardContent></Card>;

  return (
     <div className="complaint-page mx-auto max-w-5xl space-y-6 pb-12">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div className="flex items-start gap-3"><Link href="/complaints" className="mt-1 rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"><ArrowLeft className="h-5 w-5" /></Link><div><p className="complaint-kicker">Official customer complaint</p><div className="mt-1 flex flex-wrap items-center gap-3"><h1 className="text-3xl font-bold tracking-tight">{complaint.complaintNo}</h1><Badge variant={complaint.status === "complete" ? "success" : "secondary"}>{complaint.status === "complete" ? "Complete" : "Open"}</Badge><Badge variant="outline">Controlled record</Badge></div><p className="mt-2 text-sm text-muted-foreground">Last updated {displayDate(complaint.updatedAt)}</p></div></div><div className="flex flex-wrap gap-2 sm:justify-end">{canEditComplaints && complaint.status === "open" && <Button variant="outline" onClick={() => void markComplete()} disabled={updateComplaint.isPending}><CheckCircle2 className="mr-2 h-4 w-4" />{updateComplaint.isPending ? "Saving" : "Mark complete"}</Button>}{canEditComplaints && <Button variant="outline" asChild><Link href={`/complaints/${complaintId}/edit`}><Edit2 className="mr-2 h-4 w-4" />Edit</Link></Button>}<Button variant="outline" asChild><Link href={`/complaints/${complaintId}/print`}><Printer className="mr-2 h-4 w-4" />Print form</Link></Button>{canEditComplaints && <Button variant="outline" className="text-destructive hover:bg-destructive hover:text-destructive-foreground" onClick={remove} disabled={deleting}><Trash2 className="mr-2 h-4 w-4" />{deleting ? "Deleting" : "Delete"}</Button>}</div></div>

      <Card className="border-t-4 border-t-primary"><CardHeader className="border-b bg-muted/20"><div className="flex items-start justify-between gap-3"><div><CardTitle>Complaint information</CardTitle><p className="mt-1 text-sm text-muted-foreground">Customer and delivery context captured at intake.</p></div><CalendarDays className="h-6 w-6 text-primary" /></div></CardHeader><CardContent className="grid gap-6 p-5 sm:grid-cols-2 lg:grid-cols-4"><DetailField label="Customer" value={complaint.customerName} /><DetailField label="Delivery date" value={displayDate(complaint.deliveryDate)} /><DetailField label="Complaint type" value={complaint.complaintType} /><DetailField label="Material type" value={complaint.materialType} /></CardContent></Card>
      <Card><CardHeader className="border-b bg-muted/20"><CardTitle>Review notes</CardTitle></CardHeader><CardContent className="grid gap-8 p-5 md:grid-cols-2"><DetailField label="Complaint details" value={complaint.details} wide /><DetailField label="Solution / action taken" value={complaint.solution} /><DetailField label="Recommendation" value={complaint.recommendation} /></CardContent></Card>
      <Card><CardHeader className="border-b bg-muted/20"><div className="flex items-center justify-between gap-3"><div><CardTitle>Picture evidence</CardTitle><p className="mt-1 text-sm text-muted-foreground">{complaint.picturePaths.length} attached picture{complaint.picturePaths.length === 1 ? "" : "s"}</p></div><FileImage className="h-6 w-6 text-primary" /></div></CardHeader><CardContent className="p-5">{complaint.picturePaths.length ? <div className="complaint-photo-grid">{complaint.picturePaths.map((picture) => <a key={picture.objectPath} href={`/api/storage${picture.objectPath}`} target="_blank" rel="noreferrer" className="group block"><img src={`/api/storage${picture.objectPath}`} alt={picture.originalName} /><p className="mt-2 truncate text-xs text-muted-foreground group-hover:text-foreground">{picture.originalName}</p></a>)}</div> : <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">No pictures are attached to this complaint.</div>}</CardContent></Card>
      <p className="text-right text-xs text-muted-foreground">Created {displayDate(complaint.createdAt)}</p>
    </div>
  );
}