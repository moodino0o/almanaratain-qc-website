import { and, asc, eq } from "drizzle-orm";
import { db, employeeAccessTable, employeeDirectoryTable } from "@workspace/db";

export function normalizeEmployeeId(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function getActiveEmployee(value: unknown) {
  const employeeId = normalizeEmployeeId(value);
  if (!employeeId) return null;

  const [employee] = await db
    .select()
    .from(employeeDirectoryTable)
    .where(and(
      eq(employeeDirectoryTable.employeeId, employeeId),
      eq(employeeDirectoryTable.active, true),
    ))
    .limit(1);
  return employee ?? null;
}

export async function isRegisteredEmployeeId(value: unknown): Promise<boolean> {
  return Boolean(await getActiveEmployee(value));
}

export function isEmployeeSessionId(value: unknown): boolean {
  return typeof value === "string" && value.startsWith("employee:") &&
    Boolean(normalizeEmployeeId(value.slice("employee:".length)));
}

export async function isActiveEmployeeSessionId(value: unknown): Promise<boolean> {
  return isEmployeeSessionId(value) &&
    await isRegisteredEmployeeId(String(value).slice("employee:".length));
}

export async function ensureEmployeeDirectorySeed(): Promise<void> {
  const [existing] = await db
    .select({ id: employeeDirectoryTable.id })
    .from(employeeDirectoryTable)
    .orderBy(asc(employeeDirectoryTable.id))
    .limit(1);
  if (!existing) {
    await db.insert(employeeDirectoryTable).values([
      { employeeId: "62925", name: "Employee 62925", active: true },
      { employeeId: "29102", name: "Employee 29102", active: true },
      { employeeId: "35716", name: "Employee 35716", active: true },
    ]);
  }

  const employees = await db
    .select({ employeeId: employeeDirectoryTable.employeeId })
    .from(employeeDirectoryTable)
    .where(eq(employeeDirectoryTable.active, true));

  for (const employee of employees) {
    await db
      .insert(employeeAccessTable)
      .values({ employeeId: employee.employeeId, active: true, administrator: false })
      .onConflictDoNothing({ target: employeeAccessTable.employeeId });
  }
}