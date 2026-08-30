import { Router, type IRouter } from "express";
import {
  and,
  count,
  desc,
  eq,
  asc,
  ilike,
  or,
  sql,
} from "drizzle-orm";
import {
  db,
  qcRecordsTable,
  qcReferenceCategoriesTable,
  qcReferenceItemsTable,
} from "@workspace/db";
import {
  CreateReferenceCategoryBody,
  CreateReferenceCategoryResponse,
  CreateReferenceItemBody,
  CreateReferenceItemParams,
  CreateReferenceItemResponse,
  CreateRecordBody,
  CreateRecordResponse,
  DeleteRecordParams,
  DeleteReferenceCategoryParams,
  DeleteReferenceItemParams,
  GetDashboardResponse,
  GetLookupsResponse,
  GetReferenceDataResponse,
  GetRecordParams,
  GetRecordResponse,
  GetReportParams,
  GetReportResponse,
  ListRecordsQueryParams,
  ListRecordsResponse,
  UpdateReferenceCategoryBody,
  UpdateReferenceCategoryParams,
  UpdateReferenceCategoryResponse,
  UpdateReferenceItemBody,
  UpdateReferenceItemParams,
  UpdateReferenceItemResponse,
  UpdateRecordBody,
  UpdateRecordParams,
  UpdateRecordResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

const REFERENCE_SEED = [
  { key: "factories", label: "Factories", values: ["HAFFERA", "HIDD", "AKER", "KHAMIS"] },
  { key: "plants", label: "Plants", values: ["COLUMBIA", "MASA", "HENKI I", "HENKI II", "LIEBHERR"] },
  {
    key: "employees",
    label: "Technicians",
    values: ["ADEL ABBAS EBRAHIM", "AHMED ABDULLA", "AHMED HUSHAM", "AMIT ANIL", "AMMAR JAFFER"],
  },
  {
    key: "suppliers",
    label: "Suppliers",
    values: ["Al Manaratain", "AL HASANAIN", "AL NAMAL", "AZELON", "HAFFERA CRUSHER"],
  },
  {
    key: "materials",
    label: "Materials",
    values: ["Ready Mix Concrete", "Concrete Block", "Paving Block", "Sand", "Dust", "10 mm Aggregate", "20 mm Aggregate", "Water"],
  },
  {
    key: "locations",
    label: "Plant Locations",
    values: ["HAFFERA", "HIDD", "AKER", "KHAMIS", "B.D.F", "Diplomatic Area"],
  },
  {
    key: "blockTypes",
    label: "Block Types",
    values: ["8'' Two Piston Block", "8'' Three Piston Block", "8'' Solid Block", "8'' Slotted Insulation Block"],
  },
  {
    key: "blockSizes",
    label: "Block Sizes",
    values: ["200*200*80", "400*100*200", "400*150*200", "400*200*200", "400*250*200"],
  },
  {
    key: "mixStrengths",
    label: "Mix Strengths",
    values: ["20 N OPC", "20 N SRC", "25 N OPC", "30 N SRC", "40 N OPC"],
  },
  { key: "customers", label: "Customers", values: [] },
  { key: "customerLocations", label: "Customer Locations", values: [] },
] as const;

let referenceSeedPromise: Promise<void> | null = null;

async function ensureReferenceData() {
  if (!referenceSeedPromise) {
    referenceSeedPromise = (async () => {
      const [total] = await db
        .select({ value: count() })
        .from(qcReferenceCategoriesTable);
      if (Number(total?.value ?? 0) > 0) return;

      for (const seed of REFERENCE_SEED) {
        const [category] = await db
          .insert(qcReferenceCategoriesTable)
          .values({ key: seed.key, label: seed.label })
          .onConflictDoNothing({ target: qcReferenceCategoriesTable.key })
          .returning();

        if (!category) {
          throw new Error(`Unable to initialize reference category: ${seed.key}`);
        }

        if (seed.values.length > 0) {
          await db
            .insert(qcReferenceItemsTable)
            .values(seed.values.map((value) => ({ categoryId: category.id, value })))
            .onConflictDoNothing();
        }
      }
    })().catch((error) => {
      referenceSeedPromise = null;
      throw error;
    });
  }
  await referenceSeedPromise;
}

async function listReferenceData() {
  await ensureReferenceData();
  const [categories, items] = await Promise.all([
    db.select().from(qcReferenceCategoriesTable).orderBy(asc(qcReferenceCategoriesTable.label)),
    db.select().from(qcReferenceItemsTable).orderBy(asc(qcReferenceItemsTable.value)),
  ]);
  return categories.map((category) => ({
    ...category,
    items: items.filter((item) => item.categoryId === category.id),
  }));
}

async function getReferenceCategory(id: number) {
  const [category] = await db
    .select()
    .from(qcReferenceCategoriesTable)
    .where(eq(qcReferenceCategoriesTable.id, id));
  if (!category) return undefined;
  const items = await db
    .select()
    .from(qcReferenceItemsTable)
    .where(eq(qcReferenceItemsTable.categoryId, id))
    .orderBy(asc(qcReferenceItemsTable.value));
  return { ...category, items };
}

function lookupValues(
  categories: Awaited<ReturnType<typeof listReferenceData>>,
  key: string,
) {
  return categories.find((category) => category.key === key)?.items.map((item) => item.value) ?? [];
}

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

router.get("/lookups", async (_req, res): Promise<void> => {
  const categories = await listReferenceData();
  res.json(
    GetLookupsResponse.parse({
      factories: lookupValues(categories, "factories"),
      plants: lookupValues(categories, "plants"),
      employees: lookupValues(categories, "employees"),
      suppliers: lookupValues(categories, "suppliers"),
      materials: lookupValues(categories, "materials"),
      locations: lookupValues(categories, "locations"),
      blockTypes: lookupValues(categories, "blockTypes"),
      blockSizes: lookupValues(categories, "blockSizes"),
      mixStrengths: lookupValues(categories, "mixStrengths"),
      customers: lookupValues(categories, "customers"),
      customerLocations: lookupValues(categories, "customerLocations"),
    }),
  );
});

router.get("/reference-data", async (_req, res): Promise<void> => {
  res.json(GetReferenceDataResponse.parse({ categories: await listReferenceData() }));
});

router.post("/reference-data/categories", async (req, res): Promise<void> => {
  const body = CreateReferenceCategoryBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const key = body.data.key.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const label = body.data.label.trim();
  if (!key || !label) {
    res.status(400).json({ error: "Category key and label are required" });
    return;
  }
  try {
    const [category] = await db
      .insert(qcReferenceCategoriesTable)
      .values({ key, label })
      .returning();
    if (!category) {
      res.status(500).json({ error: "Unable to create reference category" });
      return;
    }
    res.status(201).json(
      CreateReferenceCategoryResponse.parse(await getReferenceCategory(category.id)),
    );
  } catch {
    res.status(409).json({ error: "A category with this key already exists" });
  }
});

router.patch("/reference-data/categories/:id", async (req, res): Promise<void> => {
  const params = UpdateReferenceCategoryParams.safeParse(req.params);
  const body = UpdateReferenceCategoryBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const updates = {
    ...(body.data.key ? { key: body.data.key.trim().replace(/[^a-zA-Z0-9]+/g, "-") } : {}),
    ...(body.data.label ? { label: body.data.label.trim() } : {}),
  };
  try {
    const [category] = await db
      .update(qcReferenceCategoriesTable)
      .set(updates)
      .where(eq(qcReferenceCategoriesTable.id, params.data.id))
      .returning();
    if (!category) {
      res.status(404).json({ error: "Reference category not found" });
      return;
    }
    res.json(
      UpdateReferenceCategoryResponse.parse(await getReferenceCategory(category.id)),
    );
  } catch {
    res.status(409).json({ error: "A category with this key already exists" });
  }
});

router.delete("/reference-data/categories/:id", async (req, res): Promise<void> => {
  const params = DeleteReferenceCategoryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [category] = await db
    .delete(qcReferenceCategoriesTable)
    .where(eq(qcReferenceCategoriesTable.id, params.data.id))
    .returning();
  if (!category) {
    res.status(404).json({ error: "Reference category not found" });
    return;
  }
  res.sendStatus(204);
});

router.post("/reference-data/categories/:categoryId/items", async (req, res): Promise<void> => {
  const params = CreateReferenceItemParams.safeParse(req.params);
  const body = CreateReferenceItemBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const [category] = await db
    .select()
    .from(qcReferenceCategoriesTable)
    .where(eq(qcReferenceCategoriesTable.id, params.data.categoryId));
  if (!category) {
    res.status(404).json({ error: "Reference category not found" });
    return;
  }
  try {
    const [item] = await db
      .insert(qcReferenceItemsTable)
      .values({ categoryId: category.id, value: body.data.value.trim() })
      .returning();
    if (!item) {
      res.status(500).json({ error: "Unable to create reference value" });
      return;
    }
    res.status(201).json(CreateReferenceItemResponse.parse(item));
  } catch {
    res.status(409).json({ error: "This value already exists in the category" });
  }
});

router.patch("/reference-data/items/:id", async (req, res): Promise<void> => {
  const params = UpdateReferenceItemParams.safeParse(req.params);
  const body = UpdateReferenceItemBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  try {
    const [item] = await db
      .update(qcReferenceItemsTable)
      .set({ value: body.data.value.trim() })
      .where(eq(qcReferenceItemsTable.id, params.data.id))
      .returning();
    if (!item) {
      res.status(404).json({ error: "Reference value not found" });
      return;
    }
    res.json(UpdateReferenceItemResponse.parse(item));
  } catch {
    res.status(409).json({ error: "This value already exists in the category" });
  }
});

router.delete("/reference-data/items/:id", async (req, res): Promise<void> => {
  const params = DeleteReferenceItemParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [item] = await db
    .delete(qcReferenceItemsTable)
    .where(eq(qcReferenceItemsTable.id, params.data.id))
    .returning();
  if (!item) {
    res.status(404).json({ error: "Reference value not found" });
    return;
  }
  res.sendStatus(204);
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