import { and, asc, eq } from "drizzle-orm";
import { Router, type IRouter, type Request, type Response } from "express";
import { db, employeeAccessTable, employeeDirectoryTable } from "@workspace/db";
import { normalizeEmployeeId } from "../lib/employee-access";
import { requireAdministrator } from "../middlewares/requireAuthenticated";

const router: IRouter = Router();

function employeeResponse(employee: typeof employeeDirectoryTable.$inferSelect) {
  return {
    id: employee.id,
    employeeId: employee.employeeId,
    name: employee.name,
    active: employee.active,
    createdAt: employee.createdAt,
    updatedAt: employee.updatedAt,
  };
}

function validName(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.trim().length <= 255;
}

router.get("/employees", requireAdministrator, async (_req, res): Promise<void> => {
  const employees = await db
    .select()
    .from(employeeDirectoryTable)
    .orderBy(asc(employeeDirectoryTable.name), asc(employeeDirectoryTable.employeeId));
  res.json({ employees: employees.map(employeeResponse) });
});

router.post("/employees", requireAdministrator, async (req: Request, res: Response): Promise<void> => {
  const employeeId = normalizeEmployeeId(req.body?.employeeId);
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";

  if (!employeeId || employeeId.length > 64 || !validName(name)) {
    res.status(400).json({ error: "A valid employee name and ID are required." });
    return;
  }

  const [existing] = await db
    .select({ id: employeeDirectoryTable.id })
    .from(employeeDirectoryTable)
    .where(eq(employeeDirectoryTable.employeeId, employeeId))
    .limit(1);
  if (existing) {
    res.status(409).json({ error: "That employee ID is already registered." });
    return;
  }

  const [employee] = await db
    .insert(employeeDirectoryTable)
    .values({ employeeId, name, active: true })
    .returning();
  await db
    .insert(employeeAccessTable)
    .values({ employeeId, active: true })
    .onConflictDoUpdate({
      target: employeeAccessTable.employeeId,
      set: { active: true, updatedAt: new Date() },
    });
  res.status(201).json({ employee: employeeResponse(employee) });
});

router.patch("/employees/:id", requireAdministrator, async (req: Request, res: Response): Promise<void> => {
  const id = Number(req.params.id);
  const employeeId = req.body?.employeeId === undefined
    ? undefined
    : normalizeEmployeeId(req.body.employeeId);
  const name = req.body?.name === undefined
    ? undefined
    : typeof req.body.name === "string"
      ? req.body.name.trim()
      : "";
  const active = req.body?.active === undefined ? undefined : req.body.active;

  if (!Number.isInteger(id) || id <= 0 ||
      (employeeId !== undefined && (!employeeId || employeeId.length > 64)) ||
      (name !== undefined && !validName(name)) ||
      (active !== undefined && typeof active !== "boolean") ||
      (employeeId === undefined && name === undefined && active === undefined)) {
    res.status(400).json({ error: "A valid employee update is required." });
    return;
  }

  if (employeeId !== undefined) {
    const [duplicate] = await db
      .select({ id: employeeDirectoryTable.id })
      .from(employeeDirectoryTable)
      .where(and(
        eq(employeeDirectoryTable.employeeId, employeeId),
        // The current row is allowed to keep its own ID.
        eq(employeeDirectoryTable.id, id),
      ))
      .limit(1);
    if (!duplicate) {
      const [other] = await db
        .select({ id: employeeDirectoryTable.id })
        .from(employeeDirectoryTable)
        .where(eq(employeeDirectoryTable.employeeId, employeeId))
        .limit(1);
      if (other) {
        res.status(409).json({ error: "That employee ID is already registered." });
        return;
      }
    }
  }

  const [current] = await db
    .select()
    .from(employeeDirectoryTable)
    .where(eq(employeeDirectoryTable.id, id))
    .limit(1);
  if (!current) {
    res.status(404).json({ error: "Employee not found." });
    return;
  }

  const [employee] = await db
    .update(employeeDirectoryTable)
    .set({
      ...(employeeId !== undefined ? { employeeId } : {}),
      ...(name !== undefined ? { name } : {}),
      ...(active !== undefined ? { active } : {}),
      updatedAt: new Date(),
    })
    .where(eq(employeeDirectoryTable.id, id))
    .returning();
  if (employeeId !== undefined && employeeId !== current.employeeId) {
    await db
      .update(employeeAccessTable)
      .set({ employeeId, updatedAt: new Date() })
      .where(eq(employeeAccessTable.employeeId, current.employeeId));
  }
  if (active !== undefined) {
    const [access] = await db
      .update(employeeAccessTable)
      .set({ active, updatedAt: new Date() })
      .where(eq(employeeAccessTable.employeeId, employee.employeeId))
      .returning({ id: employeeAccessTable.id });
    if (!access && active) {
      await db
        .insert(employeeAccessTable)
        .values({ employeeId: employee.employeeId, active: true })
        .onConflictDoNothing({ target: employeeAccessTable.employeeId });
    }
  }
  res.json({ employee: employeeResponse(employee) });
});

router.delete("/employees/:id", requireAdministrator, async (req: Request, res: Response): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid employee ID." });
    return;
  }

  const [deleted] = await db
    .delete(employeeDirectoryTable)
    .where(eq(employeeDirectoryTable.id, id))
    .returning({ employeeId: employeeDirectoryTable.employeeId });
  if (!deleted) {
    res.status(404).json({ error: "Employee not found." });
    return;
  }
  await db
    .delete(employeeAccessTable)
    .where(eq(employeeAccessTable.employeeId, deleted.employeeId));
  res.status(204).send();
});

export default router;