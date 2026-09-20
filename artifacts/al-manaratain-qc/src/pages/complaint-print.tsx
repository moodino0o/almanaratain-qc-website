import { useEffect } from "react";
import { Link, useParams } from "wouter";
import { ArrowLeft, Printer } from "lucide-react";
import { useGetComplaint } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";

function displayDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" }).format(date);
}

function PrintRow({ label, children }: { label: string; children: React.ReactNode }) {
  return <tr><th>{label}</th><td>{children || "Not recorded"}</td></tr>;
}

export default function ComplaintPrint() {
  const { id } = useParams();
  const complaintId = Number(id);
  const complaintQuery = useGetComplaint(complaintId);
  useEffect(() => {
    if (complaintQuery.data) {
      document.title = `${complaintQuery.data.complaintNo} · Complaint form`;
    }
  }, [complaintQuery.data]);

  if (complaintQuery.isLoading) return <div className="p-10 text-center text-muted-foreground">Preparing complaint form...</div>;
  if (complaintQuery.isError || !complaintQuery.data) return <div className="p-10 text-center text-destructive">The complaint form could not be prepared.</div>;
  const complaint = complaintQuery.data;
  return (
    <main className="complaint-print-shell min-h-screen bg-muted/50 p-4 sm:p-8">
      <div className="print-hide mx-auto mb-4 flex max-w-[210mm] items-center justify-between gap-3">
        <Button variant="outline" asChild>
          <Link href={`/complaints/${complaintId}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />Back to complaint
          </Link>
        </Button>
        <Button onClick={() => window.print()}>
          <Printer className="mr-2 h-4 w-4" />Print form
        </Button>
      </div>
      <article className="complaint-print-paper shadow-xl">
        <header className="complaint-print-header">
          <div className="complaint-print-company">Al Manaratain Company &amp; Ali Shaab Group W.L.L</div>
          <img src="/al-manaratain-logo.webp" alt="Al Manaratain Logo" className="complaint-print-logo" />
          <div className="complaint-print-title">
            <strong>Customer complaint record</strong>
            <strong>{complaint.complaintNo}</strong>
          </div>
        </header>
        <section className="mt-7">
          <table className="complaint-print-table">
            <tbody>
              <PrintRow label="Status">{complaint.status === "complete" ? "Complete" : "Open"}</PrintRow>
              <PrintRow label="Customer name">{complaint.customerName}</PrintRow>
              <PrintRow label="Delivery date">{displayDate(complaint.deliveryDate)}</PrintRow>
              <PrintRow label="Complaint type">{complaint.complaintType}</PrintRow>
              <PrintRow label="Material type">{complaint.materialType}</PrintRow>
              <PrintRow label="Complaint details"><span className="whitespace-pre-wrap">{complaint.details}</span></PrintRow>
              <PrintRow label="Solution / action taken"><span className="whitespace-pre-wrap">{complaint.solution}</span></PrintRow>
              <PrintRow label="Recommendation"><span className="whitespace-pre-wrap">{complaint.recommendation}</span></PrintRow>
            </tbody>
          </table>
        </section>
        <section className="mt-8">
          <h2 className="mb-3 border-b border-foreground pb-2 text-sm font-bold uppercase tracking-[0.12em]">Attached pictures</h2>
          {complaint.picturePaths.length ? (
            <div className="complaint-photo-grid">
              {complaint.picturePaths.map((picture) => (
                <figure key={picture.objectPath} className="m-0">
                  <img src={`/api/storage${picture.objectPath}`} alt={picture.originalName} />
                  <figcaption className="mt-1 break-words text-xs">{picture.originalName}</figcaption>
                </figure>
              ))}
            </div>
          ) : <p className="text-sm text-muted-foreground">No pictures attached.</p>}
        </section>
        <footer className="mt-16 grid gap-12 border-t pt-5 text-sm sm:grid-cols-2">
          <div><p className="border-b border-foreground pb-8">QC reviewer</p><p className="mt-2 text-xs text-muted-foreground">Name / signature</p></div>
          <div><p className="border-b border-foreground pb-8">Review date</p><p className="mt-2 text-xs text-muted-foreground">Date</p></div>
        </footer>
      </article>
    </main>
  );
}