import { readFile } from "node:fs/promises";
import { db, complaintsTable } from "@workspace/db";

type SourceRow = {
  dateOfComplaint: string;
  dateOfIssue: string;
  customerName: string;
  issueType: string;
  affectedProduct: string;
  salesNotes: string;
  departmentNotes: string;
  qcNotes: string;
  stepsTaken: string;
};

function clean(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

async function main() {
  const rows = JSON.parse(
    await readFile(".agents/outputs/complaints_pdf/complaints_rows.json", "utf8"),
  ) as SourceRow[];

  const values = rows.map((row, index) => {
    const recommendation = [clean(row.departmentNotes), clean(row.stepsTaken)]
      .filter(Boolean)
      .join("\n\n");

    return {
      complaintNo: `CMP-IMPORTED-${String(index + 1).padStart(4, "0")}`,
      customerName: clean(row.customerName),
      deliveryDate: row.dateOfIssue || row.dateOfComplaint,
      complaintType: clean(row.issueType),
      materialType: clean(row.affectedProduct),
      details: clean(row.salesNotes),
      solution: clean(row.qcNotes),
      recommendation,
      status: "open",
      picturePaths: [],
      createdBy: null,
    };
  });

  const existing = await db
    .select({ complaintNo: complaintsTable.complaintNo })
    .from(complaintsTable);
  const existingNumbers = new Set(existing.map((row) => row.complaintNo));
  const pending = values.filter((value) => !existingNumbers.has(value.complaintNo));

  for (let index = 0; index < pending.length; index += 100) {
    await db.insert(complaintsTable).values(pending.slice(index, index + 100));
  }

  console.log(`sourceRows=${rows.length} existing=${existing.length} inserted=${pending.length}`);
  await db.$client.end();
}

void main();