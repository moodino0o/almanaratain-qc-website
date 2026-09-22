import { randomUUID } from "node:crypto";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import {
  CreateComplaintBody,
  CreateComplaintResponse,
  DeleteComplaintParams,
  GetComplaintParams,
  GetComplaintResponse,
  ListComplaintsQueryParams,
  ListComplaintsResponse,
  UpdateComplaintBody,
  UpdateComplaintParams,
  UpdateComplaintResponse,
} from "@workspace/api-zod";
import { complaintsTable, db } from "@workspace/db";
import { Router, type IRouter } from "express";
import { getEmployeeIdFromUser } from "../lib/auth";
import { requireComplaintEditor } from "../middlewares/requireAuthenticated";

const router: IRouter = Router();

function toComplaint(row: typeof complaintsTable.$inferSelect) {
  return {
    id: row.id,
    complaintNo: row.complaintNo,
    customerName: row.customerName,
    deliveryDate: row.deliveryDate,
    complaintType: row.complaintType,
    materialType: row.materialType,
    details: row.details,
    solution: row.solution,
    recommendation: row.recommendation,
    status: row.status === "complete" ? "complete" : "open",
    picturePaths: row.picturePaths ?? [],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

router.get("/complaints", async (req, res): Promise<void> => {
  const parsed = ListComplaintsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const filters = [];
  if (parsed.data.complaintType) {
    filters.push(eq(complaintsTable.complaintType, parsed.data.complaintType));
  }
  if (parsed.data.materialType) {
    filters.push(eq(complaintsTable.materialType, parsed.data.materialType));
  }
  if (parsed.data.search) {
    const search = `%${parsed.data.search}%`;
    filters.push(
      or(
        ilike(complaintsTable.complaintNo, search),
        ilike(complaintsTable.customerName, search),
        ilike(complaintsTable.complaintType, search),
        ilike(complaintsTable.materialType, search),
        ilike(complaintsTable.details, search),
        ilike(complaintsTable.solution, search),
        ilike(complaintsTable.recommendation, search),
      ),
    );
  }

  const rows = await db
    .select()
    .from(complaintsTable)
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(complaintsTable.deliveryDate), desc(complaintsTable.id));

  res.json(ListComplaintsResponse.parse(rows.map(toComplaint)));
});

router.post("/complaints", requireComplaintEditor, async (req, res): Promise<void> => {
  const parsed = CreateComplaintBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [row] = await db
    .insert(complaintsTable)
    .values({
      complaintNo: `CMP-${new Date().getFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`,
      customerName: parsed.data.customerName.trim(),
      deliveryDate: parsed.data.deliveryDate.toISOString().slice(0, 10),
      complaintType: parsed.data.complaintType.trim(),
      materialType: parsed.data.materialType.trim(),
      details: parsed.data.details.trim(),
      solution: parsed.data.solution.trim(),
      recommendation: parsed.data.recommendation.trim(),
      status: "open",
      picturePaths: parsed.data.picturePaths,
      createdBy: getEmployeeIdFromUser(req.user),
    })
    .returning();

  if (!row) {
    res.status(500).json({ error: "Unable to create complaint." });
    return;
  }
  res.status(201).json(CreateComplaintResponse.parse(toComplaint(row)));
});

router.get("/complaints/:id", async (req, res): Promise<void> => {
  const parsed = GetComplaintParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [row] = await db
    .select()
    .from(complaintsTable)
    .where(eq(complaintsTable.id, parsed.data.id));
  if (!row) {
    res.status(404).json({ error: "Complaint not found." });
    return;
  }
  res.json(GetComplaintResponse.parse(toComplaint(row)));
});

router.patch("/complaints/:id", requireComplaintEditor, async (req, res): Promise<void> => {
  const params = UpdateComplaintParams.safeParse(req.params);
  const parsed = UpdateComplaintBody.safeParse(req.body);
  if (!params.success || !parsed.success) {
    res.status(400).json({ error: "Invalid complaint update." });
    return;
  }

  const [existing] = await db
    .select()
    .from(complaintsTable)
    .where(eq(complaintsTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Complaint not found." });
    return;
  }

  const [row] = await db
    .update(complaintsTable)
    .set({
      ...(parsed.data.customerName === undefined
        ? {}
        : { customerName: parsed.data.customerName.trim() }),
      ...(parsed.data.deliveryDate === undefined
        ? {}
        : { deliveryDate: parsed.data.deliveryDate.toISOString().slice(0, 10) }),
      ...(parsed.data.complaintType === undefined
        ? {}
        : { complaintType: parsed.data.complaintType.trim() }),
      ...(parsed.data.materialType === undefined
        ? {}
        : { materialType: parsed.data.materialType.trim() }),
      ...(parsed.data.details === undefined
        ? {}
        : { details: parsed.data.details.trim() }),
      ...(parsed.data.solution === undefined
        ? {}
        : { solution: parsed.data.solution.trim() }),
      ...(parsed.data.recommendation === undefined
        ? {}
        : { recommendation: parsed.data.recommendation.trim() }),
      ...(parsed.data.status === undefined ? {} : { status: parsed.data.status }),
      ...(parsed.data.picturePaths === undefined
        ? {}
        : { picturePaths: parsed.data.picturePaths }),
      updatedAt: new Date(),
    })
    .where(eq(complaintsTable.id, params.data.id))
    .returning();

  if (!row) {
    res.status(404).json({ error: "Complaint not found." });
    return;
  }
  res.json(UpdateComplaintResponse.parse(toComplaint(row)));
});

router.delete("/complaints/:id", requireComplaintEditor, async (req, res): Promise<void> => {
  const parsed = DeleteComplaintParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db
    .delete(complaintsTable)
    .where(eq(complaintsTable.id, parsed.data.id))
    .returning({ id: complaintsTable.id });
  if (!row) {
    res.status(404).json({ error: "Complaint not found." });
    return;
  }
  res.sendStatus(204);
});

export default router;