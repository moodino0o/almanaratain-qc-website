import { useParams, Link, useLocation } from "wouter";
import { useGetRecord, useUpdateRecord, useDeleteRecord, RecordStatus } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import { CheckCircle2, AlertTriangle, XCircle, ArrowLeft, Printer, Trash2, Edit2, Check, X } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { getListRecordsQueryKey, getGetDashboardQueryKey, getGetRecordQueryKey } from "@workspace/api-client-react";
import { useState } from "react";

function TestRowsTable({ rows }: { rows: unknown[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-xs">
        <thead className="bg-muted/30">
          <tr className="border-b">
            <th className="p-2 text-left">No.</th>
            <th className="p-2 text-left">Age</th>
            <th className="p-2 text-left">Length</th>
            <th className="p-2 text-left">Width</th>
            <th className="p-2 text-left">Height</th>
            <th className="p-2 text-left">Dry Weight</th>
            <th className="p-2 text-left">Wet Weight</th>
            <th className="p-2 text-left">Load (kN)</th>
            <th className="p-2 text-left">Loaded Face Area</th>
            <th className="p-2 text-left">Calculated Strength</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const values = typeof row === "object" && row !== null
              ? row as Record<string, unknown>
              : {};
            return (
              <tr key={index} className="border-b last:border-b-0">
                <td className="p-2 font-semibold">{String(values.rowNo ?? index + 1)}</td>
                <td className="p-2">{String(values.testAge ?? values.sampleAge ?? "-")}</td>
                <td className="p-2">{String(values.length ?? "-")}</td>
                <td className="p-2">{String(values.width ?? "-")}</td>
                <td className="p-2">{String(values.height ?? "-")}</td>
                <td className="p-2">{String(values.dryWeight ?? "-")}</td>
                <td className="p-2">{String(values.wetWeight ?? "-")}</td>
                <td className="p-2">{String(values.load ?? "-")}</td>
                <td className="p-2">{String(values.loadedFaceArea ?? "-")}</td>
                <td className="p-2 font-semibold">
                  {String(values.calculatedStrength ?? values.strength ?? values.compressiveStrength ?? "-")}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function StrengthEvaluation({ value }: { value: unknown }) {
  if (typeof value !== "object" || value === null) {
    return (
      <span className="text-muted-foreground">
        No automatic evaluation has been recorded for this historical record.
      </span>
    );
  }
  const evaluation = value as Record<string, unknown>;
  const status = String(evaluation.status ?? "Review");
  const statusClass =
    status === RecordStatus.Passed
      ? "text-success"
      : status === RecordStatus.Failed
        ? "text-destructive"
        : "text-warning";
  return (
    <div className="space-y-1">
      <p className={`font-bold ${statusClass}`}>{status}</p>
      <p>
        Minimum: {evaluation.requiredStrength == null
          ? "Not configured"
          : `${evaluation.requiredStrength} ${String(evaluation.strengthUnit ?? "N/mm²")}`}
      </p>
      <p>BS reference: {String(evaluation.bsStandard ?? "Not configured")}</p>
      {evaluation.reason != null && (
        <p className="text-muted-foreground">{String(evaluation.reason)}</p>
      )}
    </div>
  );
}

export default function RecordDetail() {
  const { id } = useParams();
  const recordId = Number(id);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [isDeleting, setIsDeleting] = useState(false);

  const { data: record, isLoading, error } = useGetRecord(recordId);
  const updateRecord = useUpdateRecord();
  const deleteRecord = useDeleteRecord();

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Loading record details...</div>;
  if (error || !record) return <div className="p-8 text-center text-destructive">Failed to load record.</div>;

  const handleStatusUpdate = (status: RecordStatus) => {
    updateRecord.mutate({ id: recordId, data: { status, reviewedBy: "Current Supervisor" } }, {
      onSuccess: () => {
        toast.success(`Record marked as ${status}.`);
        queryClient.invalidateQueries({ queryKey: getGetRecordQueryKey(recordId) });
        queryClient.invalidateQueries({ queryKey: getListRecordsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
      },
      onError: () => {
        toast.error("Failed to update status.");
      }
    });
  };

  const isStrengthEvaluated = record.testType === "Ready Mix" || record.testType === "Blocks";

  const handleDelete = () => {
    if (!confirm("Are you sure you want to delete this record? This action cannot be undone.")) return;
    setIsDeleting(true);
    deleteRecord.mutate({ id: recordId }, {
      onSuccess: () => {
        toast.success("Record Deleted");
        queryClient.invalidateQueries({ queryKey: getListRecordsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
        queryClient.removeQueries({ queryKey: getGetRecordQueryKey(recordId) });
        setLocation("/records");
      },
      onError: () => {
        toast.error("Failed to delete record.");
        setIsDeleting(false);
      }
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case RecordStatus.Passed: return <Badge variant="success" className="text-sm px-3 py-1"><CheckCircle2 className="w-4 h-4 mr-1.5" /> Passed</Badge>;
      case RecordStatus.Review: return <Badge variant="warning" className="text-sm px-3 py-1"><AlertTriangle className="w-4 h-4 mr-1.5" /> Review Required</Badge>;
      case RecordStatus.Failed: return <Badge variant="destructive" className="text-sm px-3 py-1"><XCircle className="w-4 h-4 mr-1.5" /> Failed</Badge>;
      default: return <Badge variant="secondary" className="text-sm px-3 py-1">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/records" className="p-2 rounded-md hover:bg-muted transition-colors">
            <ArrowLeft className="w-5 h-5 text-muted-foreground" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight text-foreground">{record.recordNo}</h1>
              {getStatusBadge(record.status)}
            </div>
            <p className="text-muted-foreground text-sm mt-1">{record.testType} Quality Control Record</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/records/${recordId}/edit`}
            className="inline-flex h-10 items-center justify-center whitespace-nowrap rounded-md border border-input bg-background px-4 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <Edit2 className="w-4 h-4 mr-2" />
            Edit
          </Link>
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="w-4 h-4 mr-2" />
            Print
          </Button>
          <Button variant="outline" onClick={handleDelete} disabled={isDeleting} className="text-destructive hover:bg-destructive hover:text-white border-destructive/20">
            <Trash2 className="w-4 h-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader className="bg-muted/30 border-b">
              <CardTitle>Measured Data</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <tbody>
                  {Object.entries(record.details).length === 0 ? (
                    <tr>
                      <td className="p-6 text-center text-muted-foreground">No detailed measurements recorded.</td>
                    </tr>
                  ) : (
                    Object.entries(record.details).map(([key, value], idx) => (
                      <tr key={key} className={idx !== 0 ? "border-t" : ""}>
                        <td className="p-4 font-medium text-muted-foreground capitalize bg-muted/10 w-1/3">
                          {key.replace(/([A-Z])/g, ' $1').trim()}
                        </td>
                        <td className="p-4 font-semibold text-foreground">
                          {key === "testRows" && Array.isArray(value) ? (
                            <TestRowsTable rows={value} />
                          ) : key === "strengthEvaluation" ? (
                            <StrengthEvaluation value={value} />
                          ) : (
                            typeof value === "object" && value !== null ? JSON.stringify(value) : String(value)
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Remarks & Observations</CardTitle>
            </CardHeader>
            <CardContent>
              {record.remarks ? (
                <p className="text-foreground whitespace-pre-wrap">{record.remarks}</p>
              ) : (
                <p className="text-muted-foreground italic">No remarks provided.</p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-t-4 border-t-primary">
            <CardHeader>
              <CardTitle>Context Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">Material</p>
                <p className="font-medium text-foreground">{record.material}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">Location</p>
                <p className="font-medium text-foreground">{record.location}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">Sample Date</p>
                <p className="font-medium text-foreground">{formatDate(record.sampleDate)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">Tested By</p>
                <p className="font-medium text-foreground">{record.testedBy}</p>
              </div>
              {record.testType === "Ready Mix" && (
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">Reference Number</p>
                  <p className="font-medium text-foreground">
                    {String(record.details.referenceNumber ?? "—")}
                  </p>
                </div>
              )}
              {record.reviewedBy && (
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">Reviewed By</p>
                  <p className="font-medium text-foreground">{record.reviewedBy}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{isStrengthEvaluated ? "Automatic Quality Evaluation" : "Quality Review"}</CardTitle>
              <CardDescription>
                {isStrengthEvaluated
                  ? "The status is enforced from the configured standard and measured specimens."
                  : "Update the final status of this sample."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {isStrengthEvaluated ? (
                <StrengthEvaluation value={record.details.strengthEvaluation} />
              ) : (
                <>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-success border-success/30 hover:bg-success hover:text-white"
                    onClick={() => handleStatusUpdate(RecordStatus.Passed)}
                    disabled={record.status === RecordStatus.Passed || updateRecord.isPending}
                  >
                    <Check className="w-4 h-4 mr-2" /> Mark as Passed
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-destructive border-destructive/30 hover:bg-destructive hover:text-white"
                    onClick={() => handleStatusUpdate(RecordStatus.Failed)}
                    disabled={record.status === RecordStatus.Failed || updateRecord.isPending}
                  >
                    <X className="w-4 h-4 mr-2" /> Mark as Failed
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-warning border-warning/30 hover:bg-warning hover:text-white"
                    onClick={() => handleStatusUpdate(RecordStatus.Review)}
                    disabled={record.status === RecordStatus.Review || updateRecord.isPending}
                  >
                    <AlertTriangle className="w-4 h-4 mr-2" /> Set to Review
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
