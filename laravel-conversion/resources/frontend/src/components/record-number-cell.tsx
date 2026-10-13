import { useState } from "react";
import type { QcRecord } from "@workspace/api-client-react";
import { TableCell } from "@/components/ui/table";
import { formatDateTime } from "@/lib/utils";

function formatRecordAge(createdAt: string | null | undefined) {
  if (!createdAt) return "—";
  const timestamp = Date.parse(createdAt);
  if (!Number.isFinite(timestamp)) return "—";
  const elapsedHours = Math.max(0, Date.now() - timestamp) / 3_600_000;
  return `${elapsedHours.toFixed(1)}h`;
}

export function RecordNumberCell({
  record,
  recordNumber,
  isAdmin,
  className,
}: {
  record: Pick<QcRecord, "id" | "createdBy" | "createdAt">;
  recordNumber: string;
  isAdmin: boolean;
  className?: string;
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const detailsId = `record-creator-details-${record.id}`;

  return (
    <TableCell className={className}>
      {isAdmin ? (
        <button
          type="button"
          aria-expanded={detailsOpen}
          aria-controls={detailsId}
          aria-label={`${detailsOpen ? "Hide" : "Show"} creator details for record ${recordNumber}`}
          onClick={() => setDetailsOpen((open) => !open)}
          className="text-left font-semibold text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          {recordNumber}
        </button>
      ) : (
        <span className="font-semibold text-primary">{recordNumber}</span>
      )}
      {isAdmin && detailsOpen && (
        <div
          id={detailsId}
          className="mt-1 break-words text-[10px] font-normal leading-tight text-muted-foreground"
        >
          <div>Added by {record.createdBy?.trim() || "Not recorded"}</div>
          <div>
            Age: {formatRecordAge(record.createdAt)} ·{" "}
            {formatDateTime(record.createdAt)}
          </div>
        </div>
      )}
    </TableCell>
  );
}
