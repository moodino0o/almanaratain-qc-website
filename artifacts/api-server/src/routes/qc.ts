import { Router, type IRouter } from "express";
import {
  and,
  count,
  desc,
  eq,
  asc,
  inArray,
  ilike,
  or,
  sql,
} from "drizzle-orm";
import {
  db,
  complaintsTable,
  qcRecordsTable,
  qcReferenceCategoriesTable,
  qcReferenceItemsTable,
  qcSieveStandardsTable,
  qcShapeFactorsTable,
  qcReportLayoutsTable,
  qcStrengthStandardsTable,
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
  GetDailyReadyMixResultsQueryParams,
  GetDailyReadyMixResultsResponse,
  GetReportParams,
  GetReportResponse,
  ListReportLayoutsResponse,
  UpdateReportLayoutBody,
  UpdateReportLayoutParams,
  UpdateReportLayoutResponse,
  CreateStrengthStandardBody,
  CreateStrengthStandardResponse,
  DeleteStrengthStandardParams,
  ListStrengthStandardsResponse,
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
  UpdateStrengthStandardBody,
  UpdateStrengthStandardParams,
  UpdateStrengthStandardResponse,
  CreateSieveStandardBody,
  CreateSieveStandardResponse,
  DeleteSieveStandardParams,
  ListSieveStandardsResponse,
  ListShapeFactorsResponse,
  UpdateSieveStandardBody,
  UpdateSieveStandardParams,
  UpdateSieveStandardResponse,
  CreateShapeFactorBody,
  CreateShapeFactorResponse,
  DeleteShapeFactorParams,
  UpdateShapeFactorBody,
  UpdateShapeFactorParams,
  UpdateShapeFactorResponse,
} from "@workspace/api-zod";
import {
  requireAdministrator,
  requireQcEditor,
} from "../middlewares/requireAuthenticated";
import { isConfiguredAdministrator } from "../lib/auth";
import {
  blockShapeFactorFromSize,
  pavingCorrectionFactorFromSize,
  evaluateSieveRecord,
  evaluateStrengthRecord,
  type SieveStandardForEvaluation,
} from "../lib/qc-strength";
import {
  readyMixStrengthsForAge,
  summarizeStrengths,
  summarizeStrengthSummaries,
} from "../lib/daily-ready-mix";

const router: IRouter = Router();

const addDaysToDate = (date: string, days: number) => {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
};

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
    values: [
      "Plain Block",
      "Lined Block",
      "Sandwich Insulation Block",
      "8'' Two Piston Block",
      "8'' Three Piston Block",
      "8'' Solid Block",
      "8'' Slotted Insulation Block",
    ],
  },
  {
    key: "blockSizes",
    label: "Block Sizes",
    values: [
      '4"',
      '6"',
      '8"',
      '12"',
      "200*200*80",
      "400*100*200",
      "400*150*200",
      "400*200*200",
      "400*250*200",
    ],
  },
  {
    key: "sampleTypes",
    label: "Block Sample Types",
    values: ["CUBER", "MANUAL"],
  },
  {
    key: "conditioningMethods",
    label: "Block Conditioning Methods",
    values: ["WATER at 20±5 C"],
  },
  {
    key: "preparationMethods",
    label: "Block Preparation Methods",
    values: ["GRINDING"],
  },
  {
    key: "mixStrengths",
    label: "Mix Strengths",
    values: [
      "20 N OPC",
      "20 N OPC Ice",
      "20 N SRC",
      "20 N SRC Ice",
      "25 N OPC",
      "25 N OPC Ice",
      "25 N SRC",
      "25 N SRC Ice",
      "30 N OPC",
      "30 N OPC Ice",
      "30 N SRC",
      "30 N SRC Ice",
      "35 N OPC",
      "35 N OPC Ice",
      "35 N SRC",
      "35 N SRC Ice",
      "45 N OPC",
      "45 N OPC Ice",
      "45 N OPC Fiber",
      "45 N OPC Fiber Ice",
      "45 N SRC",
      "45 N SRC Ice",
      "45 N SRC Fiber",
      "45 N SRC Fiber Ice",
      "50 N OPC",
      "50 N OPC Ice",
      "50 N SRC",
      "50 N SRC Ice",
    ],
  },
  {
    key: "sieveSizes",
    label: "Sieve / Pore Sizes",
    values: ["0.063 mm", "0.125 mm", "0.25 mm", "0.5 mm", "1 mm", "2 mm", "5 mm", "10 mm", "20 mm"],
  },
  { key: "customers", label: "Customers", values: [] },
  { key: "customerLocations", label: "Customer Locations", values: [] },
  {
    key: "complaintTypes",
    label: "Complaint Types",
    values: ["Damage", "Crack", "Missing item"],
  },
  {
    key: "complaintMaterials",
    label: "Complaint Materials",
    values: ["Block", "Paving", "Ready Mix"],
  },
] as const;

let referenceSeedPromise: Promise<void> | null = null;
let strengthSeedPromise: Promise<void> | null = null;

const READY_MIX_DEFAULT_DESIGNS = [
  "20 N OPC",
  "20 N OPC Ice",
  "20 N SRC",
  "20 N SRC Ice",
  "25 N OPC",
  "25 N OPC Ice",
  "25 N SRC",
  "25 N SRC Ice",
  "30 N OPC",
  "30 N OPC Ice",
  "30 N SRC",
  "30 N SRC Ice",
  "35 N OPC",
  "35 N OPC Ice",
  "35 N SRC",
  "35 N SRC Ice",
  "45 N OPC",
  "45 N OPC Ice",
  "45 N OPC Fiber",
  "45 N OPC Fiber Ice",
  "45 N SRC",
  "45 N SRC Ice",
  "45 N SRC Fiber",
  "45 N SRC Fiber Ice",
  "50 N OPC",
  "50 N OPC Ice",
  "50 N SRC",
  "50 N SRC Ice",
] as const;

const BLOCK_DEFAULT_STANDARDS = [
  { blockType: "Plain Block", blockSize: '4"', requiredStrength: "7.5" },
  { blockType: "Plain Block", blockSize: '6"', requiredStrength: "7.5" },
  { blockType: "Plain Block", blockSize: '8"', requiredStrength: "7.5" },
  { blockType: "Plain Block", blockSize: '12"', requiredStrength: "7.5" },
  { blockType: "Lined Block", blockSize: '8"', requiredStrength: "7.5" },
  { blockType: "Sandwich Insulation Block", blockSize: '8"', requiredStrength: "5" },
  { blockType: "Sandwich Insulation Block", blockSize: '12"', requiredStrength: "5" },
] as const;

const REPORT_LAYOUT_TEST_TYPES = [
  "Ready Mix",
  "Blocks",
  "Paving Blocks",
  "Sand Sieve",
  "Aggregate Sieve",
  "Water",
  "Flakiness & Elongation",
  "RMX Trial",
] as const;

const REPORT_LAYOUT_DEFAULTS: Record<string, Record<string, unknown>> = {
  "Ready Mix": {
    title: "Readymix Cube Test Report",
    fontFamily: "Arial",
    fontSize: 11,
    textColor: "#1f2937",
    accentColor: "#be0055",
    paperPadding: 14,
    sections: [
      { key: "header", label: "Header", visible: true, order: 0 },
      { key: "standard", label: "Standard", visible: true, order: 1 },
      { key: "results", label: "Results", visible: true, order: 2 },
      { key: "remarks", label: "Remarks", visible: true, order: 3 },
      { key: "signatures", label: "Signatures", visible: true, order: 4 },
    ],
    columns: {
      readyMixResults: [
        { key: "age", label: "Age", visible: true, order: 0, width: 12 },
        { key: "size", label: "Size", visible: true, order: 1, width: 16 },
        { key: "load", label: "Load", visible: true, order: 2, width: 18 },
        { key: "strength", label: "Strength", visible: true, order: 3, width: 20 },
      ],
    },
  },
  Blocks: {
    title: "Block Compression Test",
    fontFamily: "Arial",
    fontSize: 11,
    textColor: "#1f2937",
    accentColor: "#be0055",
    paperPadding: 14,
    sections: [
      { key: "header", label: "Header", visible: true, order: 0 },
      { key: "standard", label: "Standard", visible: true, order: 1 },
      { key: "context", label: "Block details", visible: true, order: 2 },
      { key: "results", label: "Results", visible: true, order: 3 },
      { key: "remarks", label: "Remarks", visible: true, order: 4 },
      { key: "signatures", label: "Signatures", visible: true, order: 5 },
    ],
    columns: {
      blockCompression: [
        { key: "no", label: "No.", visible: true, order: 0, width: 7 },
        { key: "length", label: "Length (mm)", visible: true, order: 1, width: 10 },
        { key: "width", label: "Width (mm)", visible: true, order: 2, width: 10 },
        { key: "height", label: "Height (mm)", visible: true, order: 3, width: 10 },
        { key: "load", label: "Load (kN)", visible: true, order: 4, width: 10 },
        { key: "water", label: "Water (N/mm2)", visible: true, order: 5, width: 12 },
        { key: "airDry", label: "Air Dry (N/mm2)", visible: true, order: 6, width: 12 },
        { key: "normalized", label: "Normalized (N/mm2)", visible: true, order: 7, width: 13 },
        { key: "density", label: "Density (kg/m3)", visible: true, order: 8, width: 13 },
        { key: "wetWeight", label: "Wet Weight (kg)", visible: true, order: 9, width: 13 },
      ],
    },
  },
  "Paving Blocks": {
    title: "Paving Block Test Report",
    fontFamily: "Arial",
    fontSize: 11,
    textColor: "#1f2937",
    accentColor: "#be0055",
    paperPadding: 14,
    sections: [
      { key: "header", label: "Header", visible: true, order: 0 },
      { key: "standard", label: "Standard", visible: true, order: 1 },
      { key: "results", label: "Results", visible: true, order: 2 },
      { key: "remarks", label: "Remarks", visible: true, order: 3 },
      { key: "signatures", label: "Signatures", visible: true, order: 4 },
    ],
    columns: {
      pavingResults: [
        { key: "no", label: "No.", visible: true, order: 0, width: 7 },
        { key: "age", label: "Test Age", visible: true, order: 1, width: 9 },
        { key: "length", label: "Length (mm)", visible: true, order: 2, width: 10 },
        { key: "width", label: "Width (mm)", visible: true, order: 3, width: 10 },
        { key: "height", label: "Height (mm)", visible: true, order: 4, width: 10 },
        { key: "dryWeight", label: "Dry Weight", visible: true, order: 5, width: 10 },
        { key: "wetWeight", label: "Wet Weight", visible: true, order: 6, width: 10 },
        { key: "load", label: "Load (kN)", visible: true, order: 7, width: 10 },
        { key: "strength", label: "Calculated Strength", visible: true, order: 8, width: 14 },
      ],
    },
  },
  "Sand Sieve": {
    title: "Sand Sieve Test Report",
    fontFamily: "Arial",
    fontSize: 11,
    textColor: "#1f2937",
    accentColor: "#be0055",
    paperPadding: 14,
    sections: [
      { key: "header", label: "Header", visible: true, order: 0 },
      { key: "standard", label: "Standard", visible: true, order: 1 },
      { key: "results", label: "Results", visible: true, order: 2 },
      { key: "remarks", label: "Remarks", visible: true, order: 3 },
      { key: "signatures", label: "Signatures", visible: true, order: 4 },
    ],
    columns: {
      sieveResults: [
        { key: "no", label: "No.", visible: true, order: 0, width: 7 },
        { key: "size", label: "Sieve / Pore Size", visible: true, order: 1, width: 26 },
        { key: "returned", label: "Amount Returned", visible: true, order: 2, width: 22 },
        { key: "passing", label: "Amount Passing", visible: true, order: 3, width: 22 },
        { key: "percentage", label: "% Passing", visible: true, order: 4, width: 23 },
      ],
    },
  },
  "Aggregate Sieve": {
    title: "Aggregate Sieve Test Report",
    fontFamily: "Arial",
    fontSize: 11,
    textColor: "#1f2937",
    accentColor: "#be0055",
    paperPadding: 14,
    sections: [
      { key: "header", label: "Header", visible: true, order: 0 },
      { key: "standard", label: "Standard", visible: true, order: 1 },
      { key: "results", label: "Results", visible: true, order: 2 },
      { key: "remarks", label: "Remarks", visible: true, order: 3 },
      { key: "signatures", label: "Signatures", visible: true, order: 4 },
    ],
    columns: {
      sieveResults: [
        { key: "no", label: "No.", visible: true, order: 0, width: 7 },
        { key: "size", label: "Sieve / Pore Size", visible: true, order: 1, width: 26 },
        { key: "returned", label: "Amount Returned", visible: true, order: 2, width: 22 },
        { key: "passing", label: "Amount Passing", visible: true, order: 3, width: 22 },
        { key: "percentage", label: "% Passing", visible: true, order: 4, width: 23 },
      ],
    },
  },
  Water: {
    title: "Water Test Report",
    fontFamily: "Arial",
    fontSize: 11,
    textColor: "#1f2937",
    accentColor: "#be0055",
    paperPadding: 14,
    sections: [
      { key: "header", label: "Header", visible: true, order: 0 },
      { key: "standard", label: "Standard", visible: true, order: 1 },
      { key: "results", label: "Results", visible: true, order: 2 },
      { key: "remarks", label: "Remarks", visible: true, order: 3 },
      { key: "signatures", label: "Signatures", visible: true, order: 4 },
    ],
    columns: {},
  },
  "Flakiness & Elongation": {
    title: "Flakiness & Elongation Test Report",
    fontFamily: "Arial",
    fontSize: 11,
    textColor: "#1f2937",
    accentColor: "#be0055",
    paperPadding: 14,
    sections: [
      { key: "header", label: "Header", visible: true, order: 0 },
      { key: "standard", label: "Standard", visible: true, order: 1 },
      { key: "results", label: "Results", visible: true, order: 2 },
      { key: "remarks", label: "Remarks", visible: true, order: 3 },
      { key: "signatures", label: "Signatures", visible: true, order: 4 },
    ],
    columns: {},
  },
  "RMX Trial": {
    title: "RMX Trial Report",
    fontFamily: "Arial",
    fontSize: 11,
    textColor: "#1f2937",
    accentColor: "#be0055",
    paperPadding: 14,
    sections: [
      { key: "header", label: "Header", visible: true, order: 0 },
      { key: "standard", label: "Standard", visible: true, order: 1 },
      { key: "results", label: "Results", visible: true, order: 2 },
      { key: "remarks", label: "Remarks", visible: true, order: 3 },
      { key: "signatures", label: "Signatures", visible: true, order: 4 },
    ],
    columns: {},
  },
};

const strengthStandardKey = (value: {
  testType: string;
  material: string;
  blockType: string | null;
  blockSize: string | null;
}) =>
  [
    value.testType,
    value.material,
    value.blockType ?? "",
    value.blockSize ?? "",
  ]
    .map((part) => part.trim().toLocaleLowerCase())
    .join("|");

async function ensureDefaultStrengthStandards() {
  if (!strengthSeedPromise) {
    strengthSeedPromise = (async () => {
      const existing = await db
        .select()
        .from(qcStrengthStandardsTable)
        .where(inArray(qcStrengthStandardsTable.testType, ["Ready Mix", "Blocks"]));
      const existingMaterials = new Set(existing.map((row) => row.material.trim().toLocaleLowerCase()));
      let insertedDefault = false;
      const existingKeys = new Set(existing.map((row) => strengthStandardKey(row)));
      for (const material of READY_MIX_DEFAULT_DESIGNS) {
        if (existingMaterials.has(material.toLocaleLowerCase())) continue;
        const grade = Number.parseInt(material, 10);
        await db.insert(qcStrengthStandardsTable).values({
          testType: "Ready Mix",
          material,
          blockType: null,
          blockSize: null,
          bsStandard: "BS EN 12390-3:2009",
          requiredStrength: String(grade),
          strengthUnit: "N/mm²",
        });
        existingMaterials.add(material.toLocaleLowerCase());
        insertedDefault = true;
      }
      for (const standard of BLOCK_DEFAULT_STANDARDS) {
        const key = strengthStandardKey({
          testType: "Blocks",
          material: "Concrete Block",
          blockType: standard.blockType,
          blockSize: standard.blockSize,
        });
        if (existingKeys.has(key)) continue;
        await db.insert(qcStrengthStandardsTable).values({
          testType: "Blocks",
          material: "Concrete Block",
          blockType: standard.blockType,
          blockSize: standard.blockSize,
          bsStandard: "BS EN 771-3",
          requiredStrength: standard.requiredStrength,
          strengthUnit: "N/mm²",
        });
        existingKeys.add(key);
        insertedDefault = true;
      }
      if (insertedDefault || existing.length > 0) {
        await refreshRecordEvaluations(["Ready Mix", "Blocks"]);
      }
    })().catch((error) => {
      strengthSeedPromise = null;
      throw error;
    });
  }
  await strengthSeedPromise;
}

async function ensureDefaultShapeFactors() {
  const [category] = await db
    .select()
    .from(qcReferenceCategoriesTable)
    .where(eq(qcReferenceCategoriesTable.key, "blockSizes"));
  if (!category) return;
  const blockSizes = await db
    .select()
    .from(qcReferenceItemsTable)
    .where(eq(qcReferenceItemsTable.categoryId, category.id));
  let changed = false;
  for (const blockSize of blockSizes) {
    const defaultShapeFactor = blockShapeFactorFromSize(blockSize.value);
    const defaultCorrectionFactor = pavingCorrectionFactorFromSize(blockSize.value);
    const [inserted] = await db
      .insert(qcShapeFactorsTable)
      .values({
        blockType: null,
        blockSize: blockSize.value,
        shapeFactor: defaultShapeFactor === null ? null : String(defaultShapeFactor),
        correctionFactor:
          defaultCorrectionFactor === null ? null : String(defaultCorrectionFactor),
      })
      .onConflictDoNothing({ target: qcShapeFactorsTable.blockSize })
      .returning({ id: qcShapeFactorsTable.id });
    if (inserted) {
      changed = true;
      continue;
    }
    if (defaultShapeFactor !== null) {
      const [updated] = await db
        .update(qcShapeFactorsTable)
        .set({ shapeFactor: String(defaultShapeFactor) })
        .where(and(
          eq(qcShapeFactorsTable.blockSize, blockSize.value),
          sql`${qcShapeFactorsTable.shapeFactor} IS NULL`,
        ))
        .returning({ id: qcShapeFactorsTable.id });
      if (updated) changed = true;
    }
    if (defaultCorrectionFactor === null) continue;
    const [updated] = await db
      .update(qcShapeFactorsTable)
      .set({ correctionFactor: String(defaultCorrectionFactor) })
      .where(and(
        eq(qcShapeFactorsTable.blockSize, blockSize.value),
        sql`${qcShapeFactorsTable.correctionFactor} IS NULL`,
      ))
      .returning({ id: qcShapeFactorsTable.id });
    if (updated) changed = true;
  }
  if (changed) {
    await refreshRecordEvaluations(["Blocks", "Paving Blocks"]);
  }
}

async function ensureReportLayouts() {
  for (const testType of REPORT_LAYOUT_TEST_TYPES) {
    const defaults = REPORT_LAYOUT_DEFAULTS[testType];
    await db
      .insert(qcReportLayoutsTable)
      .values({
        testType,
        name: `${testType} report`,
        config: defaults,
      })
      .onConflictDoNothing({ target: qcReportLayoutsTable.testType });
    const [existing] = await db
      .select()
      .from(qcReportLayoutsTable)
      .where(eq(qcReportLayoutsTable.testType, testType));
    const defaultColumns = typeof defaults.columns === "object" && defaults.columns !== null
      ? defaults.columns as Record<string, unknown>
      : {};
    const existingColumns = typeof existing?.config.columns === "object" && existing.config.columns !== null
      ? existing.config.columns as Record<string, unknown>
      : {};
    const missingColumns = Object.fromEntries(
      Object.entries(defaultColumns).filter(([key]) => existingColumns[key] === undefined),
    );
    if (existing && Object.keys(missingColumns).length > 0) {
      await db
        .update(qcReportLayoutsTable)
        .set({
          config: {
            ...existing.config,
            columns: { ...existingColumns, ...missingColumns },
          },
        })
        .where(eq(qcReportLayoutsTable.id, existing.id));
    }
  }
}

export async function ensureReferenceData() {
  if (!referenceSeedPromise) {
    referenceSeedPromise = (async () => {
      for (const seed of REFERENCE_SEED) {
        const [category] = await db
          .insert(qcReferenceCategoriesTable)
          .values({ key: seed.key, label: seed.label })
          .onConflictDoNothing({ target: qcReferenceCategoriesTable.key })
          .returning();

        const targetCategory =
          category ??
          (
            await db
              .select()
              .from(qcReferenceCategoriesTable)
              .where(eq(qcReferenceCategoriesTable.key, seed.key))
          )[0];
        if (!targetCategory) {
          throw new Error(`Unable to initialize reference category: ${seed.key}`);
        }

        if (seed.values.length > 0) {
          await db
            .insert(qcReferenceItemsTable)
            .values(seed.values.map((value) => ({ categoryId: targetCategory.id, value })))
            .onConflictDoNothing();
        }
      }
    })().catch((error) => {
      referenceSeedPromise = null;
      throw error;
    });
  }
  await referenceSeedPromise;
  await ensureDefaultShapeFactors();
  await ensureReportLayouts();
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

async function refreshRecordEvaluations(testTypes: string[]) {
  const uniqueTestTypes = [...new Set(testTypes)];
  if (!uniqueTestTypes.length) return;
  const [strengthStandards, sieveStandards, shapeFactors, records] = await Promise.all([
    db.select().from(qcStrengthStandardsTable),
    loadSieveStandards(),
    db.select().from(qcShapeFactorsTable),
    db
      .select()
      .from(qcRecordsTable)
      .where(inArray(qcRecordsTable.testType, uniqueTestTypes)),
  ]);

  for (const record of records) {
    const candidate = {
      testType: record.testType,
      material: record.material,
      location: record.location,
      details: record.details as Record<string, unknown>,
    };
    const evaluated =
      record.testType === "Sand Sieve" || record.testType === "Aggregate Sieve"
        ? evaluateSieveRecord(candidate, sieveStandards)
        : evaluateStrengthRecord(candidate, strengthStandards, shapeFactors);
    if (evaluated.status === undefined) continue;
    await db
      .update(qcRecordsTable)
      .set({
        status: evaluated.status,
        details: evaluated.details,
      })
      .where(eq(qcRecordsTable.id, record.id));
  }
}

function detailsValue(details: unknown, keys: string[]) {
  if (typeof details !== "object" || details === null) return undefined;
  const values = details as Record<string, unknown>;
  const normalized = new Map(
    Object.entries(values).map(([key, value]) => [key.toLowerCase(), value]),
  );
  for (const key of keys) {
    const value = normalized.get(key.toLowerCase());
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
}

function numericValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const parsed = Number.parseFloat(value.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function readyMixStrengths(details: unknown) {
  const directStrength = detailsValue(details, [
    "avg28To29Days",
    "average28To29Days",
    "twentyEightDayStrength",
    "strength28Days",
    "averageStrength",
    "compressiveStrength",
    "strength",
  ]);
  const directNumber = numericValue(directStrength);
  if (directNumber !== null) return [directNumber];

  if (typeof details !== "object" || details === null) return [];
  const rows = (details as Record<string, unknown>).testRows;
  if (!Array.isArray(rows)) return [];
  const rowStrengths = rows
    .map((row) => detailsValue(row, ["calculatedStrength", "strength", "compressiveStrength"]))
    .map(numericValue)
    .filter((value): value is number => value !== null);
  if (!rowStrengths.length) return [];
  const average = rowStrengths.reduce((sum, value) => sum + value, 0) / rowStrengths.length;
  return [average];
}

function readyMixDesign(details: unknown, material: string) {
  const value = detailsValue(details, ["designStrength", "mixStrength", "mixType"]);
  return value === undefined ? material : String(value).trim();
}

function referenceNumber(details: unknown) {
  const value = detailsValue(details, ["referenceNumber"]);
  return value === undefined ? "" : String(value).trim();
}

const toStrengthStandard = (row: typeof qcStrengthStandardsTable.$inferSelect) => ({
  id: row.id,
  testType: row.testType,
  material: row.material,
  blockType: row.blockType,
  blockSize: row.blockSize,
  bsStandard: row.bsStandard,
  requiredStrength: Number(row.requiredStrength),
  strengthUnit: row.strengthUnit,
});

const toShapeFactor = (row: typeof qcShapeFactorsTable.$inferSelect) => ({
  id: row.id,
  blockSize: row.blockSize ?? "",
  shapeFactor: row.shapeFactor === null ? null : Number(row.shapeFactor),
  correctionFactor:
    row.correctionFactor === null ? null : Number(row.correctionFactor),
});

const withSieveReferenceValues = (
  standard: typeof qcSieveStandardsTable.$inferSelect,
  referenceItems: typeof qcReferenceItemsTable.$inferSelect[],
): SieveStandardForEvaluation => {
  const material = referenceItems.find(
    (item) => item.id === standard.materialReferenceItemId,
  );
  const sieveSize = referenceItems.find(
    (item) => item.id === standard.sieveSizeReferenceItemId,
  );
  return {
    ...standard,
    material: material?.value ?? "",
    sieveSize: sieveSize?.value ?? "",
  };
};

const toSieveStandard = (standard: SieveStandardForEvaluation) => ({
  id: standard.id,
  testType: standard.testType,
  materialReferenceItemId: standard.materialReferenceItemId,
  material: standard.material,
  sieveSizeReferenceItemId: standard.sieveSizeReferenceItemId,
  sieveSize: standard.sieveSize,
  standardReference: standard.standardReference,
  measurementType: standard.measurementType,
  minimum: standard.minimum === null ? null : Number(standard.minimum),
  maximum: standard.maximum === null ? null : Number(standard.maximum),
  unit: standard.unit,
});

async function loadSieveStandards(): Promise<SieveStandardForEvaluation[]> {
  const [standards, referenceItems] = await Promise.all([
    db
      .select()
      .from(qcSieveStandardsTable)
      .orderBy(
        asc(qcSieveStandardsTable.testType),
        asc(qcSieveStandardsTable.materialReferenceItemId),
        asc(qcSieveStandardsTable.sieveSizeReferenceItemId),
        asc(qcSieveStandardsTable.id),
      ),
    db.select().from(qcReferenceItemsTable),
  ]);
  return standards.map((standard) =>
    withSieveReferenceValues(standard, referenceItems),
  );
}

async function listSieveStandards() {
  return (await loadSieveStandards()).map(toSieveStandard);
}

router.get("/dashboard", async (_req, res): Promise<void> => {
  const [totals] = await db
    .select({
      totalRecords: count(),
      passedRecords: sql<number>`count(*) filter (where ${qcRecordsTable.status} = 'Passed')`,
      reviewRecords: sql<number>`count(*) filter (where ${qcRecordsTable.status} = 'Review')`,
      failedRecords: sql<number>`count(*) filter (where ${qcRecordsTable.status} = 'Failed')`,
      recordsThisMonth: sql<number>`count(*) filter (where ${qcRecordsTable.sampleDate} >= date_trunc('month', current_date))`,
      totalComplaints: sql<number>`(select count(*) from ${complaintsTable})`,
      solvedComplaints: sql<number>`(select count(*) from ${complaintsTable} where ${complaintsTable.status} = 'complete')`,
      openComplaints: sql<number>`(select count(*) from ${complaintsTable} where ${complaintsTable.status} = 'open')`,
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
      totalComplaints: Number(totals?.totalComplaints ?? 0),
      solvedComplaints: Number(totals?.solvedComplaints ?? 0),
      openComplaints: Number(totals?.openComplaints ?? 0),
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
      sieveSizes: lookupValues(categories, "sieveSizes"),
    }),
  );
});

router.get("/reference-data", async (_req, res): Promise<void> => {
  res.json(GetReferenceDataResponse.parse({ categories: await listReferenceData() }));
});

router.post("/reference-data/categories", requireAdministrator, async (req, res): Promise<void> => {
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

router.patch("/reference-data/categories/:id", requireAdministrator, async (req, res): Promise<void> => {
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

router.delete("/reference-data/categories/:id", requireAdministrator, async (req, res): Promise<void> => {
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

router.post("/reference-data/categories/:categoryId/items", requireAdministrator, async (req, res): Promise<void> => {
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

router.patch("/reference-data/items/:id", requireAdministrator, async (req, res): Promise<void> => {
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

router.delete("/reference-data/items/:id", requireAdministrator, async (req, res): Promise<void> => {
  const params = DeleteReferenceItemParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  try {
    const [item] = await db
      .delete(qcReferenceItemsTable)
      .where(eq(qcReferenceItemsTable.id, params.data.id))
      .returning();
    if (!item) {
      res.status(404).json({ error: "Reference value not found" });
      return;
    }
    res.sendStatus(204);
  } catch {
    res.status(409).json({
      error: "This reference value is used by a configured sieve standard and cannot be deleted.",
    });
  }
});

router.get("/strength-standards", async (_req, res): Promise<void> => {
  await ensureDefaultStrengthStandards();
  const standards = await db
    .select()
    .from(qcStrengthStandardsTable)
    .orderBy(asc(qcStrengthStandardsTable.testType), asc(qcStrengthStandardsTable.material), asc(qcStrengthStandardsTable.id));
  res.json(ListStrengthStandardsResponse.parse(standards.map(toStrengthStandard)));
});

router.post("/strength-standards", requireAdministrator, async (req, res): Promise<void> => {
  const body = CreateStrengthStandardBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [standard] = await db
    .insert(qcStrengthStandardsTable)
    .values({
      testType: body.data.testType,
      material: body.data.material.trim(),
      blockType: body.data.blockType?.trim() || null,
      blockSize: body.data.blockSize?.trim() || null,
      bsStandard: body.data.bsStandard.trim(),
      requiredStrength: String(body.data.requiredStrength),
      strengthUnit: body.data.strengthUnit?.trim() || "N/mm²",
    })
    .returning();

  if (!standard) {
    res.status(500).json({ error: "Unable to create strength standard" });
    return;
  }
  await refreshRecordEvaluations([standard.testType]);
  res.status(201).json(CreateStrengthStandardResponse.parse(toStrengthStandard(standard)));
});

router.patch("/strength-standards/:id", requireAdministrator, async (req, res): Promise<void> => {
  const params = UpdateStrengthStandardParams.safeParse(req.params);
  const body = UpdateStrengthStandardBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [existing] = await db
    .select()
    .from(qcStrengthStandardsTable)
    .where(eq(qcStrengthStandardsTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Strength standard not found" });
    return;
  }

  const updates = {
    ...(body.data.testType !== undefined ? { testType: body.data.testType } : {}),
    ...(body.data.material !== undefined ? { material: body.data.material.trim() } : {}),
    ...(body.data.blockType !== undefined
      ? { blockType: body.data.blockType?.trim() || null }
      : {}),
    ...(body.data.blockSize !== undefined
      ? { blockSize: body.data.blockSize?.trim() || null }
      : {}),
    ...(body.data.bsStandard !== undefined ? { bsStandard: body.data.bsStandard.trim() } : {}),
    ...(body.data.requiredStrength !== undefined
      ? { requiredStrength: String(body.data.requiredStrength) }
      : {}),
    ...(body.data.strengthUnit !== undefined
      ? { strengthUnit: body.data.strengthUnit.trim() || "N/mm²" }
      : {}),
  };

  const [standard] = await db
    .update(qcStrengthStandardsTable)
    .set(updates)
    .where(eq(qcStrengthStandardsTable.id, params.data.id))
    .returning();
  if (!standard) return;
  await refreshRecordEvaluations([existing.testType, standard.testType]);
  res.json(UpdateStrengthStandardResponse.parse(toStrengthStandard(standard)));
});

router.delete("/strength-standards/:id", requireAdministrator, async (req, res): Promise<void> => {
  const params = DeleteStrengthStandardParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [existing] = await db
    .select()
    .from(qcStrengthStandardsTable)
    .where(eq(qcStrengthStandardsTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Strength standard not found" });
    return;
  }
  const [standard] = await db
    .delete(qcStrengthStandardsTable)
    .where(eq(qcStrengthStandardsTable.id, params.data.id))
    .returning();
  if (!standard) return;
  await refreshRecordEvaluations([existing.testType]);
  res.sendStatus(204);
});

router.get("/shape-factors", async (_req, res): Promise<void> => {
  await ensureDefaultShapeFactors();
  const shapeFactors = await db
    .select()
    .from(qcShapeFactorsTable)
    .where(sql`${qcShapeFactorsTable.blockSize} IS NOT NULL`)
    .orderBy(asc(qcShapeFactorsTable.blockSize), asc(qcShapeFactorsTable.id));
  res.json(ListShapeFactorsResponse.parse(shapeFactors.map(toShapeFactor)));
});

router.post("/shape-factors", requireAdministrator, async (req, res): Promise<void> => {
  const body = CreateShapeFactorBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const [shapeFactor] = await db
    .insert(qcShapeFactorsTable)
    .values({
      blockType: null,
      blockSize: body.data.blockSize.trim(),
      shapeFactor:
        body.data.shapeFactor == null ? null : String(body.data.shapeFactor),
      correctionFactor:
        body.data.correctionFactor === undefined
          ? (() => {
              const value = pavingCorrectionFactorFromSize(body.data.blockSize);
              return value === null ? null : String(value);
            })()
          : body.data.correctionFactor == null
            ? null
            : String(body.data.correctionFactor),
    })
    .returning();
  if (!shapeFactor) {
    res.status(500).json({ error: "Unable to create shape factor" });
    return;
  }
   await refreshRecordEvaluations(["Blocks", "Paving Blocks"]);
  res.status(201).json(CreateShapeFactorResponse.parse(toShapeFactor(shapeFactor)));
});

router.patch("/shape-factors/:id", requireAdministrator, async (req, res): Promise<void> => {
  const params = UpdateShapeFactorParams.safeParse(req.params);
  const body = UpdateShapeFactorBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const [existing] = await db
    .select()
    .from(qcShapeFactorsTable)
    .where(eq(qcShapeFactorsTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Shape factor not found" });
    return;
  }
  const [shapeFactor] = await db
    .update(qcShapeFactorsTable)
    .set({
      ...(body.data.blockSize !== undefined
        ? { blockSize: body.data.blockSize.trim() }
        : {}),
      ...(body.data.shapeFactor !== undefined
        ? {
            shapeFactor:
              body.data.shapeFactor == null ? null : String(body.data.shapeFactor),
          }
        : {}),
      ...(body.data.correctionFactor !== undefined
        ? {
            correctionFactor:
              body.data.correctionFactor == null
                ? null
                : String(body.data.correctionFactor),
          }
        : {}),
    })
    .where(eq(qcShapeFactorsTable.id, params.data.id))
    .returning();
  if (!shapeFactor) {
    res.status(404).json({ error: "Shape factor not found" });
    return;
  }
  await refreshRecordEvaluations(["Blocks", "Paving Blocks"]);
  res.json(UpdateShapeFactorResponse.parse(toShapeFactor(shapeFactor)));
});

router.delete("/shape-factors/:id", requireAdministrator, async (req, res): Promise<void> => {
  const params = DeleteShapeFactorParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [shapeFactor] = await db
    .delete(qcShapeFactorsTable)
    .where(eq(qcShapeFactorsTable.id, params.data.id))
    .returning();
  if (!shapeFactor) {
    res.status(404).json({ error: "Shape factor not found" });
    return;
  }
  await refreshRecordEvaluations(["Blocks", "Paving Blocks"]);
  res.sendStatus(204);
});

const toReportLayout = (row: typeof qcReportLayoutsTable.$inferSelect) => ({
  id: row.id,
  testType: row.testType,
  name: row.name,
  config: row.config,
});

router.get("/report-layouts", async (_req, res): Promise<void> => {
  await ensureReferenceData();
  const layouts = await db
    .select()
    .from(qcReportLayoutsTable)
    .orderBy(asc(qcReportLayoutsTable.testType));
  res.json(ListReportLayoutsResponse.parse(layouts.map(toReportLayout)));
});

router.patch("/report-layouts/:id", requireAdministrator, async (req, res): Promise<void> => {
  const params = UpdateReportLayoutParams.safeParse(req.params);
  const body = UpdateReportLayoutBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const [existing] = await db
    .select()
    .from(qcReportLayoutsTable)
    .where(eq(qcReportLayoutsTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Report layout not found" });
    return;
  }
  const [layout] = await db
    .update(qcReportLayoutsTable)
    .set({
      ...(body.data.name !== undefined ? { name: body.data.name.trim() } : {}),
      ...(body.data.config !== undefined ? { config: body.data.config } : {}),
    })
    .where(eq(qcReportLayoutsTable.id, params.data.id))
    .returning();
  if (!layout) {
    res.status(404).json({ error: "Report layout not found" });
    return;
  }
  res.json(UpdateReportLayoutResponse.parse(toReportLayout(layout)));
});

async function getReferenceItemForCategory(id: number, key: string) {
  const [row] = await db
    .select({ item: qcReferenceItemsTable })
    .from(qcReferenceItemsTable)
    .innerJoin(
      qcReferenceCategoriesTable,
      eq(qcReferenceCategoriesTable.id, qcReferenceItemsTable.categoryId),
    )
    .where(
      and(
        eq(qcReferenceItemsTable.id, id),
        eq(qcReferenceCategoriesTable.key, key),
      ),
    );
  return row?.item;
}

function validateSieveLimits(
  minimum: number | null | undefined,
  maximum: number | null | undefined,
) {
  if (minimum == null && maximum == null) return "At least one acceptance limit is required";
  if (minimum != null && maximum != null && minimum > maximum) {
    return "The minimum limit cannot exceed the maximum limit";
  }
  return null;
}

router.get("/sieve-standards", async (_req, res): Promise<void> => {
  res.json(ListSieveStandardsResponse.parse(await listSieveStandards()));
});

router.post("/sieve-standards", requireAdministrator, async (req, res): Promise<void> => {
  const body = CreateSieveStandardBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const limitError = validateSieveLimits(body.data.minimum, body.data.maximum);
  if (limitError) {
    res.status(400).json({ error: limitError });
    return;
  }
  const [material, sieveSize] = await Promise.all([
    getReferenceItemForCategory(body.data.materialReferenceItemId, "materials"),
    getReferenceItemForCategory(body.data.sieveSizeReferenceItemId, "sieveSizes"),
  ]);
  if (!material || !sieveSize) {
    res.status(400).json({
      error: "Choose a material and sieve size from Reference Data.",
    });
    return;
  }
  try {
    const [standard] = await db
      .insert(qcSieveStandardsTable)
      .values({
        testType: body.data.testType,
        materialReferenceItemId: material.id,
        sieveSizeReferenceItemId: sieveSize.id,
        standardReference: body.data.standardReference.trim(),
        measurementType: body.data.measurementType,
        minimum: body.data.minimum == null ? null : String(body.data.minimum),
        maximum: body.data.maximum == null ? null : String(body.data.maximum),
        unit: body.data.unit?.trim() || (body.data.measurementType === "percentage" ? "%" : "g"),
      })
      .returning();
    if (!standard) {
      res.status(500).json({ error: "Unable to create sieve standard" });
      return;
    }
    const standards = await listSieveStandards();
    const created = standards.find((item) => item.id === standard.id);
    res.status(201).json(
      CreateSieveStandardResponse.parse(created ?? toSieveStandard(withSieveReferenceValues(standard, [material, sieveSize]))),
    );
  } catch {
    res.status(409).json({ error: "A sieve standard already exists for this material and sieve size." });
  }
});

router.patch("/sieve-standards/:id", requireAdministrator, async (req, res): Promise<void> => {
  const params = UpdateSieveStandardParams.safeParse(req.params);
  const body = UpdateSieveStandardBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const current = await db
    .select()
    .from(qcSieveStandardsTable)
    .where(eq(qcSieveStandardsTable.id, params.data.id));
  if (!current[0]) {
    res.status(404).json({ error: "Sieve standard not found" });
    return;
  }
  const minimum =
    body.data.minimum !== undefined
      ? body.data.minimum
      : current[0].minimum === null
        ? null
        : Number(current[0].minimum);
  const maximum =
    body.data.maximum !== undefined
      ? body.data.maximum
      : current[0].maximum === null
        ? null
        : Number(current[0].maximum);
  const limitError = validateSieveLimits(
    minimum === null || Number.isFinite(minimum) ? minimum : null,
    maximum === null || Number.isFinite(maximum) ? maximum : null,
  );
  if (limitError) {
    res.status(400).json({ error: limitError });
    return;
  }
  const materialId = body.data.materialReferenceItemId ?? current[0].materialReferenceItemId;
  const sieveSizeId = body.data.sieveSizeReferenceItemId ?? current[0].sieveSizeReferenceItemId;
  const [material, sieveSize] = await Promise.all([
    getReferenceItemForCategory(materialId, "materials"),
    getReferenceItemForCategory(sieveSizeId, "sieveSizes"),
  ]);
  if (!material || !sieveSize) {
    res.status(400).json({
      error: "Choose a material and sieve size from Reference Data.",
    });
    return;
  }
  try {
    await db
      .update(qcSieveStandardsTable)
      .set({
        ...(body.data.testType !== undefined ? { testType: body.data.testType } : {}),
        materialReferenceItemId: material.id,
        sieveSizeReferenceItemId: sieveSize.id,
        ...(body.data.standardReference !== undefined
          ? { standardReference: body.data.standardReference.trim() }
          : {}),
        ...(body.data.measurementType !== undefined
          ? { measurementType: body.data.measurementType }
          : {}),
        ...(body.data.minimum !== undefined
          ? { minimum: body.data.minimum == null ? null : String(body.data.minimum) }
          : {}),
        ...(body.data.maximum !== undefined
          ? { maximum: body.data.maximum == null ? null : String(body.data.maximum) }
          : {}),
        ...(body.data.unit !== undefined ? { unit: body.data.unit.trim() } : {}),
      })
      .where(eq(qcSieveStandardsTable.id, params.data.id));
    const standards = await listSieveStandards();
    const updated = standards.find((item) => item.id === params.data.id);
    res.json(UpdateSieveStandardResponse.parse(updated));
  } catch {
    res.status(409).json({ error: "A sieve standard already exists for this material and sieve size." });
  }
});

router.delete("/sieve-standards/:id", requireAdministrator, async (req, res): Promise<void> => {
  const params = DeleteSieveStandardParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [standard] = await db
    .delete(qcSieveStandardsTable)
    .where(eq(qcSieveStandardsTable.id, params.data.id))
    .returning();
  if (!standard) {
    res.status(404).json({ error: "Sieve standard not found" });
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
  await refreshRecordEvaluations(["Ready Mix", "Blocks"]);

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
        ilike(sql`${qcRecordsTable.details}::text`, search),
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

router.get("/daily-ready-mix-results", async (req, res): Promise<void> => {
  const parsed = GetDailyReadyMixResultsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { testingDate, mixDesign, referenceType } = parsed.data;
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(testingDate) ||
    Number.isNaN(Date.parse(`${testingDate}T00:00:00.000Z`))
  ) {
    res.status(400).json({ error: "testingDate must be a valid YYYY-MM-DD date" });
    return;
  }
  const rows = await db
    .select()
    .from(qcRecordsTable)
    .where(
      eq(qcRecordsTable.testType, "Ready Mix"),
    )
    .orderBy(asc(qcRecordsTable.sampleDate), asc(qcRecordsTable.location), asc(qcRecordsTable.id));

  const prefix = referenceType === "site" ? "S" : "H";
  const normalizedMixDesign = mixDesign?.trim().toLocaleLowerCase();
  const matchingRecords = rows.flatMap((row) => {
    const reference = referenceNumber(row.details);
    const design = readyMixDesign(row.details, row.material);
    if (
      !reference.toLocaleUpperCase().startsWith(prefix) ||
      (normalizedMixDesign && design.toLocaleLowerCase() !== normalizedMixDesign)
    ) {
      return [];
    }
    const sevenDay = summarizeStrengths(readyMixStrengthsForAge(row.details, 7));
    const twentyEightDay = summarizeStrengths(readyMixStrengthsForAge(row.details, 28));
    const cubeAge = ([7, 28] as const).find((age) =>
      addDaysToDate(row.sampleDate, age) === testingDate &&
      (age === 7 ? sevenDay.averageStrength !== null : twentyEightDay.averageStrength !== null),
    );
    if (cubeAge === undefined) return [];

    const strengths = cubeAge === 7
      ? readyMixStrengthsForAge(row.details, 7)
      : readyMixStrengthsForAge(row.details, 28);
    const recordStrength = strengths.length
      ? strengths.reduce((sum, value) => sum + value, 0) / strengths.length
      : null;
    return [{
      recordId: row.id,
      recordNo: row.recordNo,
      sampleDate: row.sampleDate,
      location: row.location,
      mixDesign: design,
      referenceNumber: reference,
      referenceType,
      cubeAge,
      strengths,
      averageStrength: recordStrength,
      minimumStrength: recordStrength,
      maximumStrength: recordStrength,
      sevenDay,
      twentyEightDay,
      strengthUnit: "N/mm²",
    }];
  });
  const mixSummaryMap = new Map<string, {
    recordCount: number;
    strengths: number[];
    sevenDay: ReturnType<typeof summarizeStrengths>[];
    twentyEightDay: ReturnType<typeof summarizeStrengths>[];
  }>();
  const locationSummaryMap = new Map<string, {
    recordCount: number;
    sevenDay: ReturnType<typeof summarizeStrengths>[];
    twentyEightDay: ReturnType<typeof summarizeStrengths>[];
  }>();
  for (const record of matchingRecords) {
    const current = mixSummaryMap.get(record.mixDesign) ?? {
      recordCount: 0,
      strengths: [],
      sevenDay: [],
      twentyEightDay: [],
    };
    current.recordCount += 1;
    if (record.averageStrength !== null) current.strengths.push(record.averageStrength);
    if (record.sevenDay.averageStrength !== null) current.sevenDay.push(record.sevenDay);
    if (record.twentyEightDay.averageStrength !== null) current.twentyEightDay.push(record.twentyEightDay);
    mixSummaryMap.set(record.mixDesign, current);

    const location = locationSummaryMap.get(record.location) ?? {
      recordCount: 0,
      sevenDay: [],
      twentyEightDay: [],
    };
    location.recordCount += 1;
    if (record.sevenDay.averageStrength !== null) location.sevenDay.push(record.sevenDay);
    if (record.twentyEightDay.averageStrength !== null) location.twentyEightDay.push(record.twentyEightDay);
    locationSummaryMap.set(record.location, location);
  }
  const mixes = [...mixSummaryMap.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([design, summary]) => {
      const strengths = summary.strengths;
      return {
        mixDesign: design,
        recordCount: summary.recordCount,
        averageStrength: strengths.length
          ? strengths.reduce((sum, value) => sum + value, 0) / strengths.length
          : null,
        minimumStrength: strengths.length ? Math.min(...strengths) : null,
        maximumStrength: strengths.length ? Math.max(...strengths) : null,
         sevenDay: summarizeStrengthSummaries(summary.sevenDay),
         twentyEightDay: summarizeStrengthSummaries(summary.twentyEightDay),
        strengthUnit: "N/mm²",
      };
    });
  const locations = [...locationSummaryMap.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([location, summary]) => ({
      location,
      recordCount: summary.recordCount,
       sevenDay: summarizeStrengthSummaries(summary.sevenDay),
       twentyEightDay: summarizeStrengthSummaries(summary.twentyEightDay),
      strengthUnit: "N/mm²",
    }));
  const numericStrengths = matchingRecords
    .map((record) => record.averageStrength)
    .filter((value): value is number => value !== null);
  const summaryAverage = numericStrengths.length
    ? numericStrengths.reduce((sum, value) => sum + value, 0) / numericStrengths.length
    : null;
  const summaryMinimum = numericStrengths.length ? Math.min(...numericStrengths) : null;
  const summaryMaximum = numericStrengths.length ? Math.max(...numericStrengths) : null;

  res.json(
    GetDailyReadyMixResultsResponse.parse({
       testingDate,
      mixDesign: mixDesign?.trim() || null,
      referenceType,
      mixes,
      locations,
      records: matchingRecords,
      averageStrength: summaryAverage,
      minimumStrength: summaryMinimum,
      maximumStrength: summaryMaximum,
      strengthUnit: "N/mm²",
    }),
  );
});

router.post("/records", requireQcEditor, async (req, res): Promise<void> => {
  const parsed = CreateRecordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (
    parsed.data.reviewedBy !== undefined &&
    !(await isConfiguredAdministrator(req.user))
  ) {
    res.status(403).json({ error: "Only administrators can set Approved By." });
    return;
  }

  const [strengthStandards, sieveStandards, shapeFactors] = await Promise.all([
    db.select().from(qcStrengthStandardsTable),
    loadSieveStandards(),
    db.select().from(qcShapeFactorsTable),
  ]);
  const evaluated =
    parsed.data.testType === "Sand Sieve" || parsed.data.testType === "Aggregate Sieve"
      ? evaluateSieveRecord(
          {
            testType: parsed.data.testType,
            material: parsed.data.material,
            details: parsed.data.details,
          },
          sieveStandards,
        )
      : evaluateStrengthRecord(
    {
      testType: parsed.data.testType,
      material: parsed.data.material,
      location: parsed.data.location,
      details: parsed.data.details,
    },
          strengthStandards,
          shapeFactors,
        );
  const prefix = parsed.data.testType
    .replace(/[^A-Z]/gi, "")
    .slice(0, 3)
    .toUpperCase();
  const recordNo = `${prefix}-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
  const [record] = await db
    .insert(qcRecordsTable)
    .values({
      ...parsed.data,
      status: evaluated.status ?? parsed.data.status,
      details: evaluated.details,
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
  await refreshRecordEvaluations([record.testType]);
  const [currentRecord] = await db
    .select()
    .from(qcRecordsTable)
    .where(eq(qcRecordsTable.id, parsed.data.id));
  res.json(GetRecordResponse.parse(toRecord(currentRecord ?? record)));
});

router.patch("/records/:id", requireQcEditor, async (req, res): Promise<void> => {
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
  if (
    body.data.reviewedBy !== undefined &&
    !(await isConfiguredAdministrator(req.user))
  ) {
    res.status(403).json({ error: "Only administrators can set Approved By." });
    return;
  }
  const [existing] = await db
    .select()
    .from(qcRecordsTable)
    .where(eq(qcRecordsTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Record not found" });
    return;
  }

  const candidate = {
    testType: body.data.testType ?? existing.testType,
    material: body.data.material ?? existing.material,
    location: body.data.location ?? existing.location,
    details: body.data.details ?? existing.details,
  };
  const [strengthStandards, sieveStandards, shapeFactors] = await Promise.all([
    db.select().from(qcStrengthStandardsTable),
    loadSieveStandards(),
    db.select().from(qcShapeFactorsTable),
  ]);
  const evaluated =
    candidate.testType === "Sand Sieve" || candidate.testType === "Aggregate Sieve"
      ? evaluateSieveRecord(candidate, sieveStandards)
      : evaluateStrengthRecord(candidate, strengthStandards, shapeFactors);
  const { sampleDate, ...rest } = body.data;
  const updates = {
    ...rest,
    status: evaluated.status ?? body.data.status ?? existing.status,
    ...(evaluated.status !== undefined ? { details: evaluated.details } : {}),
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

router.delete("/records/:id", requireQcEditor, async (req, res): Promise<void> => {
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
  await ensureReferenceData();
  await refreshRecordEvaluations([record.testType]);
  const [currentRecord] = await db
    .select()
    .from(qcRecordsTable)
    .where(eq(qcRecordsTable.id, parsed.data.id));
  const [layout] = await db
    .select()
    .from(qcReportLayoutsTable)
    .where(eq(qcReportLayoutsTable.testType, record.testType));
  res.json(
    GetReportResponse.parse({
      record: toRecord(currentRecord ?? record),
      companyName: "AL MANARATAIN",
      companySubtitle: "Al Manaratain Company & Ali Shaab Group W.L.L",
      layout: toReportLayout(layout ?? {
        id: 0,
        testType: record.testType,
        name: `${record.testType} report`,
        config: REPORT_LAYOUT_DEFAULTS[record.testType] ?? REPORT_LAYOUT_DEFAULTS.Water,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    }),
  );
});

export default router;