import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type RegisterColumn = {
  label: string;
};

function RegisterTable({
  title,
  columns,
}: {
  title: string;
  columns: RegisterColumn[];
}) {
  return (
    <div className="flex h-full flex-col space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          {title}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Separate register table. Record entry and data connection will be set
          up in the next step.
        </p>
      </div>

      <Card className="flex min-h-0 flex-1 flex-col border-t-4 border-t-primary">
        <CardHeader className="shrink-0 pb-4">
          <CardTitle>{title} Register</CardTitle>
          <CardDescription>
            The requested columns are ready for the register data.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-1 overflow-auto p-0">
          <div className="qc-register-table-container w-full min-w-0">
            <Table className="qc-register-table w-full table-fixed text-[10px]">
              <TableHeader className="sticky top-0 z-10 bg-card shadow-sm">
                <TableRow>
                  {columns.map((column) => (
                    <TableHead
                      key={column.label}
                      className="whitespace-normal break-words px-2 py-2 text-[10px] leading-tight"
                    >
                      {column.label}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-32 text-center text-sm text-muted-foreground"
                  >
                    No {title.toLocaleLowerCase()} records to display yet.
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function PrecastRegister() {
  return (
    <RegisterTable
      title="Precast"
      columns={[
        { label: "Record No." },
        { label: "Customer Name" },
        { label: "Material" },
        { label: "Casting Date" },
        { label: "Remarks" },
        { label: "Avg. Strength (1 day)" },
        { label: "Avg. Strength (7 days)" },
        { label: "Avg. Strength (28 days)" },
      ]}
    />
  );
}

export function KerbStoneRegister() {
  return (
    <RegisterTable
      title="Kerb Stone"
      columns={[
        { label: "Record No." },
        { label: "Casting Date" },
        { label: "Testing Date" },
        { label: "Age" },
        { label: "Kerb Type" },
        { label: "Factory" },
        { label: "Avg. Strength" },
        { label: "Min. Strength" },
        { label: "Max. Strength" },
      ]}
    />
  );
}