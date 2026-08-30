import { Router, type IRouter } from "express";
import {
  and,
  count,
  desc,
  eq,
  ilike,
  or,
  sql,
} from "drizzle-orm";
import { db, qcRecordsTable } from "@workspace/db";
import {
  CreateRecordBody,
  CreateRecordResponse,
  DeleteRecordParams,
  GetDashboardResponse,
  GetLookupsResponse,
  GetRecordParams,
  GetRecordResponse,
  GetReportParams,
  GetReportResponse,
  ListRecordsQueryParams,
  ListRecordsResponse,
  UpdateRecordBody,
  UpdateRecordParams,
  UpdateRecordResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

const toRecord = (row: typeof qcRecordsTable.$inferSelect) => ({
  ...row,
  createdAt: row.createdAt.toISOString(),
});

router.get("/dashboard", async (_req, res): Promise<void> => {
  const [totals] = await db
    .select({
      totalRecords: count(),
      passedRecords: sql<number>`count(*) filter (where ${qcRecordsTable.status} = 'Passed')`,
      reviewRecords: sql<number>`count(*) filter (where ${qcRecordsTable.status} = 'Review')`,
      failedRecords: sql<number>`count(*) filter (where ${qcRecordsTable.status} = 'Failed')`,
      recordsThisMonth: sql<number>`count(*) filter (where ${qcRecordsTable.sampleDate} >= date_trunc('month', current_date))`,
    })
    .from(qcRecordsTable);

  const byTypeRows = await db
    .select({ testType: qcRecordsTable.testType, count: count() })
    .from(qcRecordsTable)
    .groupBy(qcRecordsTable.testType)
    .orderBy(desc(count()));

  const recentRows = await db
    .select()
    .from(qcRecordsTable)
    .orderBy(desc(qcRecordsTable.createdAt))
    .limit(6);

  res.json(
    GetDashboardResponse.parse({
      totalRecords: Number(totals?.totalRecords ?? 0),
      passedRecords: Number(totals?.passedRecords ?? 0),
      reviewRecords: Number(totals?.reviewRecords ?? 0),
      failedRecords: Number(totals?.failedRecords ?? 0),
      recordsThisMonth: Number(totals?.recordsThisMonth ?? 0),
      byType: byTypeRows.map((row) => ({
        testType: row.testType,
        count: Number(row.count),
      })),
      recentRecords: recentRows.map(toRecord),
    }),
  );
});

router.get("/lookups", (_req, res): void => {
  res.json(
    GetLookupsResponse.parse({
      factories: ["HAFFERA", "HIDD", "AKER", "KHAMIS"],
      plants: ["COLUMBIA", "MASA", "HENKI I", "HENKI II", "LIEBHERR"],
      employees: [
        "ADEL ABBAS EBRAHIM",
        "AHMED ABDULLA",
        "AHMED HUSHAM",
        "AMIT ANIL",
        "AMMAR JAFFER",
      ],
      suppliers: [
        "Al Manaratain",
        "AL HASANAIN",
        "AL NAMAL",
        "AZELON",
        "HAFFERA CRUSHER",
      ],
      materials: [
        "Ready Mix Concrete",
        "Concrete Block",
        "Paving Block",
        "Sand",
        "Dust",
        "10 mm Aggregate",
        "20 mm Aggregate",
        "Water",
      ],
      locations: ["HAFFERA", "HIDD", "AKER", "KHAMIS", "B.D.F", "Diplomatic Area"],
      blockTypes: [
        "8'' Two Piston Block",
        "8'' Three Piston Block",
        "8'' Solid Block",
        "8'' Slotted Insulation Block",
      ],
      blockSizes: [
        "200*200*80",
        "400*100*200",
        "400*150*200",
        "400*200*200",
        "400*250*200",
      ],
      mixStrengths: [
        "20 N OPC",
        "20 N SRC",
        "25 N OPC",
        "30 N SRC",
        "40 N OPC",
      ],
    }),
  );
});

router.get("/records", async (req, res): Promise<void> => {
  const parsed = ListRecordsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const filters = [];
  if (parsed.data.testType) {
    filters.push(eq(qcRecordsTable.testType, parsed.data.testType));
  }
  if (parsed.data.search) {
    const search = `%${parsed.data.search}%`;
    filters.push(
      or(
        ilike(qcRecordsTable.recordNo, search),
        ilike(qcRecordsTable.location, search),
        ilike(qcRecordsTable.material, search),
        ilike(qcRecordsTable.testedBy, search),
      ),
    );
  }

  const rows = await db
    .select()
    .from(qcRecordsTable)
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(qcRecordsTable.sampleDate), desc(qcRecordsTable.id))
    .limit(parsed.data.limit ?? 50);

  res.json(ListRecordsResponse.parse(rows.map(toRecord)));
});

router.post("/records", async (req, res): Promise<void> => {
  const parsed = CreateRecordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const prefix = parsed.data.testType
    .replace(/[^A-Z]/gi, "")
    .slice(0, 3)
    .toUpperCase();
  const recordNo = `${prefix}-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
  const [record] = await db
    .insert(qcRecordsTable)
    .values({
      ...parsed.data,
      sampleDate: parsed.data.sampleDate.toISOString().slice(0, 10),
      recordNo,
    })
    .returning();

  if (!record) {
    res.status(500).json({ error: "Unable to create record" });
    return;
  }
  res.status(201).json(CreateRecordResponse.parse(toRecord(record)));
});

router.get("/records/:id", async (req, res): Promise<void> => {
  const parsed = GetRecordParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [record] = await db
    .select()
    .from(qcRecordsTable)
    .where(eq(qcRecordsTable.id, parsed.data.id));
  if (!record) {
    res.status(404).json({ error: "Record not found" });
    return;
  }
  res.json(GetRecordResponse.parse(toRecord(record)));
});

router.patch("/records/:id", async (req, res): Promise<void> => {
  const params = UpdateRecordParams.safeParse(req.params);
  const body = UpdateRecordBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const { sampleDate, ...rest } = body.data;
  const updates = {
    ...rest,
    ...(sampleDate
      ? { sampleDate: sampleDate.toISOString().slice(0, 10) }
      : {}),
  };
  const [record] = await db
    .update(qcRecordsTable)
    .set(updates)
    .where(eq(qcRecordsTable.id, params.data.id))
    .returning();
  if (!record) {
    res.status(404).json({ error: "Record not found" });
    return;
  }
  res.json(UpdateRecordResponse.parse(toRecord(record)));
});

router.delete("/records/:id", async (req, res): Promise<void> => {
  const parsed = DeleteRecordParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [record] = await db
    .delete(qcRecordsTable)
    .where(eq(qcRecordsTable.id, parsed.data.id))
    .returning();
  if (!record) {
    res.status(404).json({ error: "Record not found" });
    return;
  }
  res.sendStatus(204);
});

router.get("/reports/:id", async (req, res): Promise<void> => {
  const parsed = GetReportParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [record] = await db
    .select()
    .from(qcRecordsTable)
    .where(eq(qcRecordsTable.id, parsed.data.id));
  if (!record) {
    res.status(404).json({ error: "Record not found" });
    return;
  }
  res.json(
    GetReportResponse.parse({
      record: toRecord(record),
      companyName: "AL MANARATAIN",
      companySubtitle: "Al Manaratain Company & Ali Shaab Group W.L.L",
    }),
  );
});

export default router;