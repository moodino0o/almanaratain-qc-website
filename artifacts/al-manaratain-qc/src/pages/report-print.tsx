import { useParams, Link } from "wouter";
import { useGetReport } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import { ArrowLeft, Printer } from "lucide-react";

export default function ReportPrint() {
  const { id } = useParams();
  const reportId = Number(id);
  
  const { data: report, isLoading, error } = useGetReport(reportId);

  // Auto-print prompt when loaded? Maybe not auto, let user click it.
  
  if (isLoading) return <div className="p-8 text-center text-muted-foreground print-hide">Loading certificate...</div>;
  if (error || !report) return <div className="p-8 text-center text-destructive print-hide">Failed to load certificate.</div>;

  const { record, companySubtitle } = report;

  return (
    <div className="min-h-screen bg-muted/30 py-8 print:bg-white print:py-0 print:p-0">
      <div className="max-w-4xl mx-auto space-y-4 print-hide px-4 mb-4">
        <div className="flex items-center justify-between bg-card p-4 rounded-lg border shadow-sm">
          <Link href="/reports" className="flex items-center text-sm font-medium text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Reports
          </Link>
          <Button onClick={() => window.print()} className="gap-2">
            <Printer className="w-4 h-4" /> Print Certificate
          </Button>
        </div>
      </div>

      {/* A4 Print Container */}
      <div className="w-[210mm] min-h-[297mm] mx-auto bg-white shadow-lg print:shadow-none print:w-full print:min-h-0 box-border p-[20mm]">
        {/* Header */}
        <div className="grid grid-cols-[minmax(0,1fr)_170px] items-start gap-8 border-b-2 border-primary pb-6 mb-8">
          <div className="min-w-0">
            <img src="/al-manaratain-logo.webp" alt="Al Manaratain Logo" className="h-20 w-auto max-w-full object-contain object-left" />
            <p className="mt-2 text-[10px] leading-4 text-muted-foreground uppercase font-semibold tracking-wide">{companySubtitle}</p>
          </div>
          <div className="text-right min-w-0">
            <h2 className="text-xl font-bold text-foreground mb-1">Quality Certificate</h2>
            <p className="text-sm font-medium text-muted-foreground">Ref: {record.recordNo}</p>
            <p className="text-sm text-muted-foreground">Date: {formatDate(new Date().toISOString())}</p>
          </div>
        </div>

        {/* Certificate Info Grid */}
        <div className="grid grid-cols-2 gap-x-12 gap-y-4 mb-8 text-sm">
          <div className="flex border-b border-muted pb-2">
            <span className="w-1/3 font-bold text-muted-foreground uppercase text-xs">Test Type</span>
            <span className="w-2/3 font-semibold text-foreground">{record.testType}</span>
          </div>
          <div className="flex border-b border-muted pb-2">
            <span className="w-1/3 font-bold text-muted-foreground uppercase text-xs">Sample Date</span>
            <span className="w-2/3 font-semibold text-foreground">{formatDate(record.sampleDate)}</span>
          </div>
          <div className="flex border-b border-muted pb-2">
            <span className="w-1/3 font-bold text-muted-foreground uppercase text-xs">Material</span>
            <span className="w-2/3 font-semibold text-foreground">{record.material}</span>
          </div>
          <div className="flex border-b border-muted pb-2">
            <span className="w-1/3 font-bold text-muted-foreground uppercase text-xs">Location</span>
            <span className="w-2/3 font-semibold text-foreground">{record.location}</span>
          </div>
          <div className="flex border-b border-muted pb-2">
            <span className="w-1/3 font-bold text-muted-foreground uppercase text-xs">Tested By</span>
            <span className="w-2/3 font-semibold text-foreground">{record.testedBy}</span>
          </div>
          <div className="flex border-b border-muted pb-2">
            <span className="w-1/3 font-bold text-muted-foreground uppercase text-xs">Final Status</span>
            <span className="w-2/3 font-semibold text-success uppercase">{record.status}</span>
          </div>
        </div>

        {/* Test Results Table */}
        <div className="mb-10">
          <h3 className="text-lg font-bold text-primary mb-4 border-l-4 border-primary pl-3">Test Results</h3>
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-muted/50 border-y-2 border-border">
                <th className="py-3 px-4 text-left font-bold text-xs uppercase tracking-wider text-muted-foreground w-1/2">Parameter</th>
                <th className="py-3 px-4 text-left font-bold text-xs uppercase tracking-wider text-muted-foreground w-1/2">Measured Value</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(record.details).length > 0 ? (
                Object.entries(record.details).map(([key, value], idx) => (
                  <tr key={key} className="border-b border-border">
                    <td className="py-3 px-4 font-semibold text-sm capitalize text-foreground">
                      {key.replace(/([A-Z])/g, ' $1').trim()}
                    </td>
                    <td className="py-3 px-4 font-medium text-sm">
                      {String(value)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={2} className="py-6 px-4 text-center text-sm text-muted-foreground italic">
                    No specific measurements recorded.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Remarks */}
        {record.remarks && (
          <div className="mb-12">
            <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-2">Remarks / Observations</h3>
            <p className="text-sm p-4 bg-muted/20 border border-muted rounded-md min-h-[60px] whitespace-pre-wrap">
              {record.remarks}
            </p>
          </div>
        )}

        {/* Signatures */}
        <div className="mt-20 pt-8 border-t-2 border-primary grid grid-cols-2 gap-12 text-center">
          <div>
            <div className="h-16 border-b border-border mx-8 mb-2"></div>
            <p className="font-bold text-sm text-foreground">{record.testedBy}</p>
            <p className="text-xs text-muted-foreground uppercase font-semibold mt-1">Quality Technician</p>
          </div>
          <div>
            <div className="h-16 border-b border-border mx-8 mb-2"></div>
            <p className="font-bold text-sm text-foreground">{record.reviewedBy || "Authorized Signature"}</p>
            <p className="text-xs text-muted-foreground uppercase font-semibold mt-1">QC Supervisor</p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-16 text-center text-xs text-muted-foreground">
          <p>This certificate is electronically generated and represents the laboratory test results of the stated material.</p>
          <p className="mt-1">Al Manaratain Company and Ali Al Shaab Group W.L.L. - Kingdom of Bahrain</p>
        </div>
      </div>
    </div>
  );
}
