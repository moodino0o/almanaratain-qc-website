import { Link } from "wouter";
import { Printer } from "lucide-react";

const actionButtonClass =
  "inline-flex h-6 w-[52px] items-center justify-center gap-1 whitespace-nowrap rounded-md px-1.5 text-[10px] font-medium leading-none shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

export function RecordTableActions({
  recordId,
  showPrint = true,
}: {
  recordId: number | string;
  showPrint?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <Link
        href={`/records/${recordId}`}
        aria-label="View record"
        className={`${actionButtonClass} bg-secondary text-secondary-foreground hover:bg-secondary/80`}
      >
        View
      </Link>
      {showPrint && (
        <Link
          href={`/reports/${recordId}`}
          aria-label="Print record"
          className={`${actionButtonClass} border border-input bg-background hover:bg-accent hover:text-accent-foreground`}
        >
          <Printer className="h-3 w-3 shrink-0" />
          Print
        </Link>
      )}
    </div>
  );
}
