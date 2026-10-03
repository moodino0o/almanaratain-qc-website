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
  employeeActivityEventsTable,
  qcRecordsTable,
  qcReferenceCategoriesTable,
  qcReferenceItemsTable,
  qcSieveStandardsTable,
  qcShapeFactorsTable,
  qcReportLayoutsTable,
  qcReportTemplatesTable,
  qcStrengthStandardsTable,
} from "@workspace/db";
import {
  ApplyRecordAgeBackfillBody,
  ApplyRecordAgeBackfillResponse,
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
  ListReportTemplatesQueryParams,
  ListReportTemplatesResponse,
  CreateReportTemplateBody,
  CreateReportTemplateResponse,
  UpdateReportTemplateParams,
  UpdateReportTemplateBody,
  UpdateReportTemplateResponse,
  DeleteReportTemplateParams,
  DuplicateReportTemplateParams,
  DuplicateReportTemplateBody,
  DuplicateReportTemplateResponse,
  SetReportTemplateDefaultParams,
  SetReportTemplateDefaultResponse,
  ListReportTemplateVersionsParams,
  ListReportTemplateVersionsResponse,
  RestoreReportTemplateVersionParams,
  RestoreReportTemplateVersionResponse,
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
  PreviewRecordAgeBackfillBody,
  PreviewRecordAgeBackfillResponse,
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
  requireAuthenticated,
  requireAdministrator,
  requireQcEditor,
} from "../middlewares/requireAuthenticated";
import { isConfiguredAdministrator } from "../lib/auth";
import {
  getEmployeeActivityRequestSessionId,
  getActivityEmployeeName,
  recordEmployeeActivityChange,
} from "../lib/employee-activity";
import { canEmployeeAddReferenceCategory } from "../lib/employee-reference-permissions";
import {
  blockShapeFactorFromSize,
  pavingCorrectionFactorFromSize,
  evaluateSieveRecord,
  evaluateStrengthRecord,
  type SieveStandardForEvaluation,
} from "../lib/qc-strength";
import { normalizeMasonryMachineDetails } from "../lib/qc-machine-names";
import {
  ageDetailKeyForTestType,
  calculateRecordTestingDate,
  inspectHistoricalAgeBackfill,
  previewHistoricalAgeBackfill,
} from "../lib/qc-record-dates";
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
  { key: "machines", label: "Masonry Machines", values: ["HENKI I", "HENKI II", "MASA"] },
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
    values: [
      "Ready Mix Concrete",
      "Concrete Block",
      "Paving Block",
      "Sand",
      "Dust",
      "2-5 mm Aggregate",
      "10 mm Aggregate",
      "20 mm Aggregate",
      "Water",
    ],
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
    values: [
      "0 mm",
      "0.063 mm",
      "0.075 mm",
      "0.125 mm",
      "0.15 mm",
      "0.25 mm",
      "0.3 mm",
      "0.5 mm",
      "0.6 mm",
      "1 mm",
      "1.18 mm",
      "2 mm",
      "2.36 mm",
      "5 mm",
      "6.3 mm",
      "10 mm",
      "14 mm",
      "20 mm",
    ],
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
let masonryMachineNormalizationPromise: Promise<void> | null = null;

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
  "Precast",
  "Kerb Stone",
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
        { key: "testingDate", label: "Testing Date", visible: true, order: 0, width: 18 },
        { key: "age", label: "Cube Age", visible: true, order: 1, width: 12 },
        { key: "weight", label: "Cube Weight (g)", visible: true, order: 2, width: 16 },
        { key: "load", label: "Load (kN)", visible: true, order: 3, width: 16 },
        { key: "strength", label: "Strength (N/mm²)", visible: true, order: 4, width: 19 },
        { key: "absorption", label: "Water Absorption (%)", visible: true, order: 5, width: 19 },
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
        { key: "no", label: "No.", visible: true, order: 0, width: 6 },
        { key: "size", label: "Sieve / Pore Size", visible: true, order: 1, width: 17 },
        { key: "returned", label: "Mass Retained (g)", visible: true, order: 2, width: 13 },
        { key: "retained", label: "Retained (%)", visible: true, order: 3, width: 9 },
        { key: "passing", label: "Amount Passing (g)", visible: true, order: 4, width: 11 },
        { key: "percentage", label: "Passing (%)", visible: true, order: 5, width: 8 },
        { key: "lower", label: "Lower Limit", visible: true, order: 6, width: 12 },
        { key: "upper", label: "Upper Limit", visible: true, order: 7, width: 12 },
        { key: "remarks", label: "Remarks", visible: true, order: 8, width: 18 },
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
        { key: "no", label: "No.", visible: true, order: 0, width: 6 },
        { key: "size", label: "Sieve / Pore Size", visible: true, order: 1, width: 17 },
        { key: "returned", label: "Mass Retained (g)", visible: true, order: 2, width: 13 },
        { key: "retained", label: "Retained (%)", visible: true, order: 3, width: 9 },
        { key: "passing", label: "Amount Passing (g)", visible: true, order: 4, width: 11 },
        { key: "percentage", label: "Passing (%)", visible: true, order: 5, width: 8 },
        { key: "lower", label: "Lower Limit", visible: true, order: 6, width: 12 },
        { key: "upper", label: "Upper Limit", visible: true, order: 7, width: 12 },
        { key: "remarks", label: "Remarks", visible: true, order: 8, width: 18 },
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
    columns: {
      waterDetails: [
        { key: "source", label: "Source", visible: true, order: 0, width: 20 },
        { key: "ph", label: "pH", visible: true, order: 1, width: 20 },
        { key: "tds", label: "TDS", visible: true, order: 2, width: 20 },
        { key: "chloride", label: "Chloride", visible: true, order: 3, width: 20 },
        { key: "sulphate", label: "Sulphate", visible: true, order: 4, width: 20 },
      ],
    },
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
    columns: {
      flakinessDetails: [
        { key: "observation1", label: "Observation 1", visible: true, order: 0, width: 50 },
        { key: "observation2", label: "Observation 2", visible: true, order: 1, width: 50 },
      ],
    },
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
    columns: {
      rmxTrialDetails: [
        { key: "observation1", label: "Observation 1", visible: true, order: 0, width: 50 },
        { key: "observation2", label: "Observation 2", visible: true, order: 1, width: 50 },
      ],
    },
  },
  Precast: {
    title: "Precast Test Report",
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
      precastDetails: [
        { key: "sampleDate", label: "Casting Date", visible: true, order: 0, width: 14 },
        { key: "sampleNo", label: "Sample No.", visible: true, order: 1, width: 14 },
        { key: "precastMouldNo", label: "Precast Mould No.", visible: true, order: 2, width: 14 },
        { key: "jobNo", label: "Job No.", visible: true, order: 3, width: 12 },
        { key: "customerName", label: "Customer Name", visible: true, order: 4, width: 18 },
        { key: "material", label: "Product Type", visible: true, order: 5, width: 12 },
        { key: "cubeSize", label: "Cube Size (mm)", visible: true, order: 6, width: 14 },
        { key: "location", label: "Testing Location", visible: true, order: 7, width: 16 },
        { key: "compactionType", label: "Compaction", visible: true, order: 8, width: 16 },
        { key: "testedBy", label: "Tested By", visible: true, order: 9, width: 14 },
      ],
      precastResults: [
        { key: "age", label: "Cube Age (days)", visible: true, order: 0, width: 12 },
        { key: "cubeSize", label: "Cube Size (mm)", visible: true, order: 1, width: 16 },
        { key: "weight", label: "Weight (g)", visible: true, order: 2, width: 13 },
        { key: "density", label: "Density (kg/m³)", visible: true, order: 3, width: 15 },
        { key: "load", label: "Load (kN)", visible: true, order: 4, width: 15 },
        { key: "strength", label: "Compressive Strength (N/mm²)", visible: true, order: 5, width: 29 },
      ],
    },
  },
  "Kerb Stone": {
    title: "Kerb Stone Test Report",
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
      kerbStoneDetails: [
        { key: "testingDate", label: "Testing Date", visible: true, order: 0, width: 20 },
        { key: "age", label: "Age (days)", visible: true, order: 1, width: 16 },
        { key: "kerbType", label: "Kerb Type", visible: true, order: 2, width: 20 },
        { key: "averageStrength", label: "Avg. Strength", visible: true, order: 3, width: 16 },
        { key: "minimumStrength", label: "Min. Strength", visible: true, order: 4, width: 14 },
        { key: "maximumStrength", label: "Max. Strength", visible: true, order: 5, width: 14 },
      ],
    },
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
    const mergedColumns = { ...existingColumns };
    let columnsChanged = false;
    for (const [key, defaultValue] of Object.entries(defaultColumns)) {
      const currentValue = existingColumns[key];
      if (currentValue === undefined) {
        mergedColumns[key] = defaultValue;
        columnsChanged = true;
        continue;
      }
      const supportsColumnAdditions =
        key === "sieveResults" ||
        (testType === "Precast" &&
          (key === "precastDetails" || key === "precastResults"));
      if (
        !supportsColumnAdditions ||
        !Array.isArray(currentValue) ||
        !Array.isArray(defaultValue)
      ) {
        continue;
      }

      let currentColumns = currentValue.filter(
        (column): column is Record<string, unknown> =>
          typeof column === "object" && column !== null,
      );
      if (testType === "Precast" && key === "precastResults") {
        const normalizedColumns: Record<string, unknown>[] = [];
        let normalized = false;
        for (const column of currentColumns) {
          if (column.key === "no") {
            normalized = true;
            continue;
          }
          if (column.key === "weight" && column.label === "Weight (kg)") {
            normalizedColumns.push({ ...column, label: "Weight (g)" });
            normalized = true;
            continue;
          }
          normalizedColumns.push(column);
        }
        if (normalized) {
          currentColumns = normalizedColumns;
          mergedColumns[key] = currentColumns;
          columnsChanged = true;
        }
      }
      const defaultSieveColumns = defaultValue.filter(
        (column): column is Record<string, unknown> =>
          typeof column === "object" && column !== null,
      );
      const currentKeys = new Set(currentColumns.map((column) => column.key));
      const lastOrder = Math.max(
        -1,
        ...currentColumns.map((column) =>
          typeof column.order === "number" ? column.order : -1,
        ),
      );
      const additions = defaultSieveColumns
        .filter(
          (column) =>
            (key !== "sieveResults" ||
              ["retained", "passing", "lower", "upper", "remarks"].includes(String(column.key))) &&
            !currentKeys.has(column.key),
        )
        .map((column, index) => ({
          ...column,
          order: lastOrder + index + 1,
        }));
      if (additions.length) {
        mergedColumns[key] = [...currentColumns, ...additions];
        columnsChanged = true;
      }
    }
    if (existing && columnsChanged) {
      await db
        .update(qcReportLayoutsTable)
        .set({
          config: {
            ...existing.config,
            columns: mergedColumns,
          },
        })
        .where(eq(qcReportLayoutsTable.id, existing.id));
    }
  }
}

const REPORT_TEMPLATE_FIELD_KEYS = new Set([
  "REPORT_TITLE", "REPORT_NUMBER", "REPORT_DATE", "SAMPLE_DATE",
  "SUPPLIER", "SAMPLE_DESCRIPTION", "PROJECT", "TEST_METHOD",
  "TEST_RESULT", "SIEVE_SIZE", "AMOUNT_RETAINED", "AMOUNT_PASSING",
  "PERCENT_PASSING", "RETAINED_PERCENT", "LOWER_LIMIT", "UPPER_LIMIT",
  "REMARKS", "COMPANY_NAME", "SAMPLE_NUMBER", "MATERIAL", "LOCATION",
  "TESTED_BY", "REVIEWED_BY", "record.recordNo", "record.sampleDate",
  "record.location", "record.material", "record.status", "record.testedBy",
  "record.reviewedBy", "record.createdAt", "report.title",
  ...[
    "customerName", "customerLocation", "projectName", "otherDetails",
    "castedBy", "sampleNumber", "slump", "temperature", "compactionType",
    "testingDate", "age", "weight", "load", "strength", "absorption",
    "blockSize", "blockAge", "machine", "sampleType", "conditioningMethod",
    "preparationMethod", "shapeFactor", "blockType", "no", "length", "width",
    "height", "water", "airDry", "normalized", "density", "wetWeight",
    "pavingBlockSize", "correctionFactor", "dryWeight", "waterAbsorption",
    "size", "returned", "retained", "passing", "percentage", "lower", "upper",
    "remarks", "sampleAge", "supplier", "materialCondition", "siltBefore",
    "siltAfter", "silverNitrateContent", "firstChlorideTitrationPoint",
    "secondChlorideTitrationPoint", "crucibleWeight", "crucibleAshWeight",
    "source", "ph", "tds", "chloride", "sulphate", "sampleDate", "location",
    "material", "testedBy", "observation1", "observation2",
    "sampleNo", "precastMouldNo", "jobNo", "cubeSize", "averageStrength1Day",
    "averageStrength7Days", "averageStrength28Days",
    "kerbType", "averageStrength", "minimumStrength", "maximumStrength",
  ].map((key) => `details.${key}`),
]);

const REPORT_TEMPLATE_TABLE_KEYS = new Set([
  "readyMixDetails", "readyMixResults", "blockDetails", "blockCompression",
  "pavingDetails", "pavingResults", "sieveSampleDetails", "sieveResults",
  "sieveChemicalDetails", "waterDetails", "genericContext",
    "flakinessDetails", "rmxTrialDetails", "precastDetails", "precastResults", "kerbStoneDetails",
]);
const REPORT_TEMPLATE_COLUMN_KEYS = new Set(
  [...REPORT_TEMPLATE_FIELD_KEYS]
    .filter((key) => key.startsWith("details."))
    .map((key) => key.slice("details.".length)),
);

function validateReportTemplateDesign(design: unknown): string | null {
  if (typeof design !== "object" || design === null) return "A design is required.";
  const value = design as Record<string, unknown>;
  if (value.schemaVersion !== 1 || !Array.isArray(value.objects)) {
    return "Unsupported report template design.";
  }
  for (const object of value.objects) {
    if (typeof object !== "object" || object === null) return "Invalid report template object.";
    const item = object as Record<string, unknown>;
    if (item.type === "dynamicField" &&
      (typeof item.fieldKey !== "string" || !REPORT_TEMPLATE_FIELD_KEYS.has(item.fieldKey))) {
      return "Dynamic field is not allowed.";
    }
    if (item.type === "table" &&
      (typeof item.tableKey !== "string" || !REPORT_TEMPLATE_TABLE_KEYS.has(item.tableKey))) {
      return "Report table is not allowed.";
    }
    if (item.type === "image") {
      if (typeof item.objectPath !== "string" ||
        !/^\/objects\/uploads\/[A-Za-z0-9._/-]+$/.test(item.objectPath) ||
        item.objectPath.includes("..")) {
        return "Image objects must reference a private uploaded object.";
      }
    }
    if (typeof item.content === "string") {
      const tokens = [...item.content.matchAll(/\{\{([A-Z_]+)\}\}/g)];
      if (tokens.some(([, key]) => !REPORT_TEMPLATE_FIELD_KEYS.has(key))) {
        return "Template text contains an unknown dynamic field.";
      }
    }
  }
  const layout = value.layout;
  if (typeof layout !== "object" || layout === null) return "A report layout is required.";
  const columns = (layout as Record<string, unknown>).columns;
  if (typeof columns !== "object" || columns === null || Array.isArray(columns)) {
    return "Report table columns are invalid.";
  }
  for (const [groupKey, groupColumns] of Object.entries(columns)) {
    if (!REPORT_TEMPLATE_TABLE_KEYS.has(groupKey) || !Array.isArray(groupColumns)) {
      return "Report table columns are not allowed.";
    }
    for (const column of groupColumns) {
      if (typeof column !== "object" || column === null ||
        typeof (column as Record<string, unknown>).key !== "string" ||
        !REPORT_TEMPLATE_COLUMN_KEYS.has((column as Record<string, unknown>).key as string)) {
        return "Report table field is not allowed.";
      }
    }
  }
  return null;
}

function reportTemplateDesignFromLegacy(config: Record<string, unknown>) {
  const paperPadding = typeof config.paperPadding === "number"
    ? config.paperPadding
    : 14;
  return {
    schemaVersion: 1 as const,
    layout: config,
    page: {
      pageSize: "A4" as const,
      orientation: "portrait" as const,
      widthMm: 210,
      heightMm: 297,
      marginTopMm: paperPadding,
      marginRightMm: paperPadding,
      marginBottomMm: paperPadding,
      marginLeftMm: paperPadding,
      showHeader: true,
      showFooter: true,
      headerHeightMm: 24,
      footerHeightMm: 18,
    },
    objects: [],
  };
}

function toReportTemplate(row: typeof qcReportTemplatesTable.$inferSelect) {
  return {
    id: row.id,
    testType: row.testType,
    name: row.name,
    description: row.description,
    isDefault: row.isDefault,
    version: row.version,
    design: row.design,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function ensureReportTemplates() {
  await ensureReportLayouts();
  await db.transaction(async (tx) => {
    const legacyLayouts = await tx.select().from(qcReportLayoutsTable);
    for (const legacy of legacyLayouts) {
      const [existing] = await tx.select({ id: qcReportTemplatesTable.id })
        .from(qcReportTemplatesTable)
        .where(eq(qcReportTemplatesTable.testType, legacy.testType))
        .limit(1);
      if (!existing) {
        await tx.insert(qcReportTemplatesTable).values({
          testType: legacy.testType,
          name: legacy.name,
          description: "Migrated from the legacy report layout.",
          isDefault: true,
          version: 1,
          design: reportTemplateDesignFromLegacy(legacy.config),
          history: [],
        });
      }
    }
  });
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
  if (!masonryMachineNormalizationPromise) {
    masonryMachineNormalizationPromise = (async () => {
      const records = await db
        .select({
          id: qcRecordsTable.id,
          testType: qcRecordsTable.testType,
          details: qcRecordsTable.details,
        })
        .from(qcRecordsTable)
        .where(inArray(qcRecordsTable.testType, ["Blocks", "Paving Blocks"]));

      for (const record of records) {
        const details = normalizeMasonryMachineDetails(
          record.testType,
          record.details,
        );
        if (details === record.details) continue;
        await db
          .update(qcRecordsTable)
          .set({ details })
          .where(eq(qcRecordsTable.id, record.id));
      }
    })().catch((error) => {
      masonryMachineNormalizationPromise = null;
      throw error;
    });
  }
  await masonryMachineNormalizationPromise;
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

const toRecord = (
  row: typeof qcRecordsTable.$inferSelect,
  createdBy: string | null = null,
) => ({
  ...row,
  createdAt: row.createdAt.toISOString(),
  createdBy,
});

async function getRecordCreatorNames(
  rows: Array<typeof qcRecordsTable.$inferSelect>,
) {
  const recordIds = rows.map((row) => String(row.id));
  const creatorNames = new Map<string, string>();
  if (!recordIds.length) return creatorNames;

  const creationEvents = await db
    .select({
      entityId: employeeActivityEventsTable.entityId,
      employeeName: employeeActivityEventsTable.employeeName,
    })
    .from(employeeActivityEventsTable)
    .where(
      and(
        eq(employeeActivityEventsTable.entityType, "QC record"),
        eq(employeeActivityEventsTable.action, "created"),
        inArray(employeeActivityEventsTable.entityId, recordIds),
      ),
    )
    .orderBy(
      asc(employeeActivityEventsTable.occurredAt),
      asc(employeeActivityEventsTable.id),
    );

  for (const event of creationEvents) {
    if (event.entityId && !creatorNames.has(event.entityId)) {
      creatorNames.set(event.entityId, event.employeeName);
    }
  }
  return creatorNames;
}

async function toRecords(
  rows: Array<typeof qcRecordsTable.$inferSelect>,
) {
  const creatorNames = await getRecordCreatorNames(rows);
  return rows.map((row) =>
    toRecord(row, creatorNames.get(String(row.id)) ?? null),
  );
}

async function toRecordWithCreator(
  row: typeof qcRecordsTable.$inferSelect,
) {
  const [record] = await toRecords([row]);
  return record ?? toRecord(row);
}

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
  const currentMonth = sql`
    ${qcRecordsTable.sampleDate} >= date_trunc('month', current_date)
    and ${qcRecordsTable.sampleDate} < date_trunc('month', current_date) + interval '1 month'
  `;
  const [totals] = await db
    .select({
      totalRecords: count(),
      passedRecords: sql<number>`count(*) filter (where ${qcRecordsTable.status} = 'Passed')`,
      reviewRecords: sql<number>`count(*) filter (where ${qcRecordsTable.status} = 'Review')`,
      failedRecords: sql<number>`count(*) filter (where ${qcRecordsTable.status} = 'Failed')`,
      recordsThisMonth: sql<number>`count(*) filter (where ${currentMonth})`,
      passedRecordsThisMonth: sql<number>`count(*) filter (where ${currentMonth} and ${qcRecordsTable.status} = 'Passed')`,
      reviewRecordsThisMonth: sql<number>`count(*) filter (where ${currentMonth} and ${qcRecordsTable.status} = 'Review')`,
      failedRecordsThisMonth: sql<number>`count(*) filter (where ${currentMonth} and ${qcRecordsTable.status} = 'Failed')`,
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
      passedRecordsThisMonth: Number(totals?.passedRecordsThisMonth ?? 0),
      reviewRecordsThisMonth: Number(totals?.reviewRecordsThisMonth ?? 0),
      failedRecordsThisMonth: Number(totals?.failedRecordsThisMonth ?? 0),
      totalComplaints: Number(totals?.totalComplaints ?? 0),
      solvedComplaints: Number(totals?.solvedComplaints ?? 0),
      openComplaints: Number(totals?.openComplaints ?? 0),
      byType: byTypeRows.map((row) => ({
        testType: row.testType,
        count: Number(row.count),
      })),
      recentRecords: await toRecords(recentRows),
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

router.post("/reference-data/categories/:categoryId/items", requireAuthenticated, async (req, res): Promise<void> => {
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
  const isAdministrator = await isConfiguredAdministrator(req.user);
  if (
    !isAdministrator &&
    !canEmployeeAddReferenceCategory(category.key)
  ) {
    res.status(403).json({
      code: "REFERENCE_DATA_ADMIN_REQUIRED",
      error: "Administrator access is required to add values to this category.",
    });
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

router.get("/report-templates", async (req, res): Promise<void> => {
  const query = ListReportTemplatesQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  await ensureReportTemplates();
  const templates = await db
    .select()
    .from(qcReportTemplatesTable)
    .where(query.data.testType
      ? eq(qcReportTemplatesTable.testType, query.data.testType)
      : undefined)
    .orderBy(asc(qcReportTemplatesTable.testType), asc(qcReportTemplatesTable.name));
  res.json(ListReportTemplatesResponse.parse(templates.map(toReportTemplate)));
});

router.post("/report-templates", requireAdministrator, async (req, res): Promise<void> => {
  const body = CreateReportTemplateBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const designError = validateReportTemplateDesign(body.data.design);
  if (designError) {
    res.status(400).json({ error: designError });
    return;
  }
  await ensureReportTemplates();
  const template = await db.transaction(async (tx) => {
    if (body.data.isDefault) {
      await tx.update(qcReportTemplatesTable)
        .set({ isDefault: false })
        .where(eq(qcReportTemplatesTable.testType, body.data.testType));
    }
    const [created] = await tx.insert(qcReportTemplatesTable).values({
      testType: body.data.testType,
      name: body.data.name.trim(),
      description: body.data.description ?? null,
      isDefault: body.data.isDefault ?? false,
      version: 1,
      design: body.data.design,
      history: [],
    }).returning();
    return created;
  });
  res.status(201).json(CreateReportTemplateResponse.parse(toReportTemplate(template)));
});

router.patch("/report-templates/:id", requireAdministrator, async (req, res): Promise<void> => {
  const params = UpdateReportTemplateParams.safeParse(req.params);
  const body = UpdateReportTemplateBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  if (body.data.design) {
    const designError = validateReportTemplateDesign(body.data.design);
    if (designError) {
      res.status(400).json({ error: designError });
      return;
    }
  }
  const [existing] = await db.select().from(qcReportTemplatesTable)
    .where(eq(qcReportTemplatesTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Report template not found" });
    return;
  }
  const designChanged = body.data.design !== undefined;
  const history = Array.isArray(existing.history) ? [...existing.history] : [];
  if (designChanged) {
    history.push({
      version: existing.version,
      design: existing.design,
      createdAt: existing.updatedAt.toISOString(),
    });
  }
  const [updated] = await db.update(qcReportTemplatesTable).set({
    ...(body.data.name !== undefined ? { name: body.data.name.trim() } : {}),
    ...(body.data.description !== undefined ? { description: body.data.description } : {}),
    ...(designChanged ? {
      design: body.data.design,
      version: existing.version + 1,
      history,
    } : {}),
  }).where(eq(qcReportTemplatesTable.id, existing.id)).returning();
  res.json(UpdateReportTemplateResponse.parse(toReportTemplate(updated)));
});

router.delete("/report-templates/:id", requireAdministrator, async (req, res): Promise<void> => {
  const params = DeleteReportTemplateParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [existing] = await db.select().from(qcReportTemplatesTable)
    .where(eq(qcReportTemplatesTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Report template not found" });
    return;
  }
  const templates = await db.select({ id: qcReportTemplatesTable.id })
    .from(qcReportTemplatesTable)
    .where(eq(qcReportTemplatesTable.testType, existing.testType));
  if (templates.length <= 1) {
    res.status(400).json({ error: "The only template for a report type cannot be deleted." });
    return;
  }
  if (existing.isDefault) {
    res.status(409).json({ error: "The default template cannot be deleted." });
    return;
  }
  await db.delete(qcReportTemplatesTable).where(eq(qcReportTemplatesTable.id, existing.id));
  res.sendStatus(204);
});

router.post("/report-templates/:id/duplicate", requireAdministrator, async (req, res): Promise<void> => {
  const params = DuplicateReportTemplateParams.safeParse(req.params);
  const body = DuplicateReportTemplateBody.safeParse(req.body ?? {});
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const [existing] = await db.select().from(qcReportTemplatesTable)
    .where(eq(qcReportTemplatesTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Report template not found" });
    return;
  }
  const duplicatedDesign = body.data.design ?? existing.design;
  const designError = validateReportTemplateDesign(duplicatedDesign);
  if (designError) {
    res.status(400).json({ error: designError });
    return;
  }
  const [created] = await db.insert(qcReportTemplatesTable).values({
    testType: existing.testType,
    name: body.data.name?.trim() || `${existing.name} copy`,
    description: body.data.description === undefined ? existing.description : body.data.description,
    isDefault: false,
    version: 1,
    design: duplicatedDesign,
    history: [],
  }).returning();
  res.status(201).json(DuplicateReportTemplateResponse.parse(toReportTemplate(created)));
});

router.patch("/report-templates/:id/default", requireAdministrator, async (req, res): Promise<void> => {
  const params = SetReportTemplateDefaultParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [existing] = await db.select().from(qcReportTemplatesTable)
    .where(eq(qcReportTemplatesTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Report template not found" });
    return;
  }
  const updated = await db.transaction(async (tx) => {
    await tx.update(qcReportTemplatesTable).set({ isDefault: false })
      .where(eq(qcReportTemplatesTable.testType, existing.testType));
    const [selected] = await tx.update(qcReportTemplatesTable)
      .set({ isDefault: true })
      .where(eq(qcReportTemplatesTable.id, existing.id))
      .returning();
    return selected;
  });
  res.json(SetReportTemplateDefaultResponse.parse(toReportTemplate(updated)));
});

router.get("/report-templates/:id/versions", async (req, res): Promise<void> => {
  const params = ListReportTemplateVersionsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [existing] = await db.select().from(qcReportTemplatesTable)
    .where(eq(qcReportTemplatesTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Report template not found" });
    return;
  }
  const versions = (Array.isArray(existing.history) ? existing.history : [])
    .map((entry) => ({
      version: Number((entry as Record<string, unknown>).version),
      createdAt: String((entry as Record<string, unknown>).createdAt),
    }))
    .filter((entry) => Number.isFinite(entry.version) && entry.createdAt !== "undefined");
  res.json(ListReportTemplateVersionsResponse.parse(versions));
});

router.post("/report-templates/:id/restore/:version", requireAdministrator, async (req, res): Promise<void> => {
  const params = RestoreReportTemplateVersionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [existing] = await db.select().from(qcReportTemplatesTable)
    .where(eq(qcReportTemplatesTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Report template not found" });
    return;
  }
  const target = (Array.isArray(existing.history) ? existing.history : [])
    .find((entry) => Number((entry as Record<string, unknown>).version) === params.data.version);
  if (!target || typeof (target as Record<string, unknown>).design !== "object") {
    res.status(404).json({ error: "Report template version not found" });
    return;
  }
  const targetDesign = (target as Record<string, unknown>).design;
  const designError = validateReportTemplateDesign(targetDesign);
  if (designError) {
    res.status(400).json({ error: designError });
    return;
  }
  const history = Array.isArray(existing.history) ? [...existing.history, {
    version: existing.version,
    design: existing.design,
    createdAt: existing.updatedAt.toISOString(),
  }] : [];
  const [updated] = await db.update(qcReportTemplatesTable).set({
    design: targetDesign as Record<string, unknown>,
    version: existing.version + 1,
    history,
  }).where(eq(qcReportTemplatesTable.id, existing.id)).returning();
  res.json(RestoreReportTemplateVersionResponse.parse(toReportTemplate(updated)));
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

  res.json(ListRecordsResponse.parse(await toRecords(rows)));
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

  const sampleDate = parsed.data.sampleDate.toISOString().slice(0, 10);
  const dateCalculation = calculateRecordTestingDate(
    parsed.data.testType,
    sampleDate,
    parsed.data.details,
  );
  if (dateCalculation.error) {
    res.status(400).json({ error: dateCalculation.error });
    return;
  }
  const normalizedDetails = normalizeMasonryMachineDetails(
    parsed.data.testType,
    dateCalculation.details,
  );
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
            details: normalizedDetails,
          },
          sieveStandards,
        )
      : evaluateStrengthRecord(
    {
      testType: parsed.data.testType,
      material: parsed.data.material,
      location: parsed.data.location,
      details: normalizedDetails,
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
      sampleDate,
      recordNo,
    })
    .returning();

  if (!record) {
    res.status(500).json({ error: "Unable to create record" });
    return;
  }
  const actorEmployeeId = req.user?.id?.startsWith("employee:")
    ? req.user.id.slice("employee:".length).trim()
    : "";
  const createdBy = actorEmployeeId
    ? getActivityEmployeeName(req.user, actorEmployeeId)
    : null;
  if (actorEmployeeId && createdBy) {
    try {
      await recordEmployeeActivityChange({
        employeeId: actorEmployeeId,
        employeeName: createdBy,
        action: "created",
        entityType: "QC record",
        entityId: String(record.id),
        path: req.path,
        submitted: parsed.data,
      });
    } catch (error) {
      req.log.error(
        { error, recordId: record.id },
        "Unable to record QC report creator activity",
      );
    }
  }
  res.status(201).json(CreateRecordResponse.parse(toRecord(record, createdBy)));
});

router.post(
  "/records/age-backfill/preview",
  requireAdministrator,
  async (req, res): Promise<void> => {
    const parsed = PreviewRecordAgeBackfillBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const records = await db
      .select()
      .from(qcRecordsTable)
      .where(inArray(qcRecordsTable.testType, Object.keys(ageDetailKeyForTestType)))
      .orderBy(asc(qcRecordsTable.sampleDate), asc(qcRecordsTable.id));
    const preview = previewHistoricalAgeBackfill(records);
    res.json(PreviewRecordAgeBackfillResponse.parse(preview));
  },
);

router.post(
  "/records/age-backfill/apply",
  requireAdministrator,
  async (req, res): Promise<void> => {
    const parsed = ApplyRecordAgeBackfillBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const candidateIds = parsed.data.candidates.map((candidate) => candidate.id);
    if (
      candidateIds.some((id) => !Number.isSafeInteger(id) || id <= 0) ||
      new Set(candidateIds).size !== candidateIds.length ||
      parsed.data.candidates.some((candidate) => !Number.isSafeInteger(candidate.age))
    ) {
      res.status(400).json({ error: "Candidates must contain unique record IDs and whole-day ages." });
      return;
    }

    const actorEmployeeId = req.user?.id?.startsWith("employee:")
      ? req.user.id.slice("employee:".length).trim()
      : "";
    if (!actorEmployeeId) {
      res.status(403).json({
        error: "An employee identity is required to audit historical date corrections.",
      });
      return;
    }
    const actorEmployeeName = getActivityEmployeeName(req.user, actorEmployeeId);
    const sessionId = getEmployeeActivityRequestSessionId(req);

    const result = await db.transaction(async (tx) => {
      const records = await tx
        .select()
        .from(qcRecordsTable)
        .where(inArray(qcRecordsTable.id, candidateIds));
      const recordsById = new Map(records.map((record) => [record.id, record]));
      const skipped = [];
      let applied = 0;

      for (const expected of parsed.data.candidates) {
        const record = recordsById.get(expected.id);
        const issue = (reason: string) => ({
          id: expected.id,
          recordNo: expected.recordNo,
          testType: expected.testType,
          sampleDate: expected.sampleDate,
          testingDate: expected.testingDate,
          reason,
        });

        if (!record) {
          skipped.push(issue("Record no longer exists. Run a new preview before applying."));
          continue;
        }

        const inspection = inspectHistoricalAgeBackfill(record);
        if (inspection.kind !== "eligible") {
          skipped.push(
            issue(
              inspection.kind === "manualReview"
                ? inspection.issue.reason
                : "An age is already saved. Run a new preview to confirm the current record.",
            ),
          );
          continue;
        }

        const candidate = inspection.candidate;
        if (
          candidate.id !== expected.id ||
          candidate.recordNo !== expected.recordNo ||
          candidate.testType !== expected.testType ||
          candidate.sampleDate !== expected.sampleDate ||
          candidate.testingDate !== expected.testingDate ||
          candidate.age !== expected.age
        ) {
          skipped.push(issue("Record changed after preview. Run a new preview before applying."));
          continue;
        }

        const ageKey = ageDetailKeyForTestType[record.testType];
        if (!ageKey) {
          skipped.push(issue("This record type does not use an age-based Testing Date."));
          continue;
        }
        const details = {
          ...record.details,
          [ageKey]: String(candidate.age),
          testingDate: candidate.testingDate,
        };
        const updated = await tx
          .update(qcRecordsTable)
          .set({ details })
          .where(
            and(
              eq(qcRecordsTable.id, record.id),
              eq(qcRecordsTable.testType, record.testType),
              eq(qcRecordsTable.sampleDate, record.sampleDate),
              eq(qcRecordsTable.details, record.details),
            ),
          )
          .returning({ id: qcRecordsTable.id });
        if (updated.length === 0) {
          skipped.push(issue("Record changed during apply. Run a new preview before applying."));
          continue;
        }
        await recordEmployeeActivityChange(
          {
            employeeId: actorEmployeeId,
            employeeName: actorEmployeeName,
            sessionId,
            action: "updated",
            entityType: "QC record",
            entityId: String(record.id),
            summary: `Backfilled historical age for QC record #${record.id} (${record.recordNo})`,
            path: req.path,
            submitted: {
              operation: "historical age backfill",
              recordId: record.id,
              recordNo: record.recordNo,
              testType: record.testType,
              sampleDate: record.sampleDate,
              oldTestingDate: record.details.testingDate,
              oldAgeValue: record.details[ageKey] ?? null,
              newTestingDate: details.testingDate,
              ageField: ageKey,
              newAgeValue: details[ageKey],
            },
          },
          tx,
        );
        applied += 1;
      }

      return { applied, skipped };
    });

    res.json(ApplyRecordAgeBackfillResponse.parse(result));
  },
);

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
  res.json(
    GetRecordResponse.parse(await toRecordWithCreator(currentRecord ?? record)),
  );
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

  const sampleDate =
    body.data.sampleDate?.toISOString().slice(0, 10) ?? existing.sampleDate;
  const candidateBase = {
    testType: body.data.testType ?? existing.testType,
    material: body.data.material ?? existing.material,
    location: body.data.location ?? existing.location,
  };
  const candidateDetails = normalizeMasonryMachineDetails(
    candidateBase.testType,
    body.data.details ?? existing.details,
  );
  const dateCalculation = calculateRecordTestingDate(
    candidateBase.testType,
    sampleDate,
    candidateDetails,
  );
  const updatesAgeDerivedRecord =
    body.data.details !== undefined ||
    body.data.sampleDate !== undefined ||
    body.data.testType !== undefined;
  if (dateCalculation.error && updatesAgeDerivedRecord) {
    res.status(400).json({ error: dateCalculation.error });
    return;
  }
  const candidate = {
    ...candidateBase,
    details: dateCalculation.details,
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
  const { sampleDate: submittedSampleDate, ...rest } = body.data;
  const updates = {
    ...rest,
    status: evaluated.status ?? body.data.status ?? existing.status,
    ...(evaluated.status !== undefined ||
        body.data.details !== undefined ||
        body.data.sampleDate !== undefined ||
        body.data.testType !== undefined ||
        dateCalculation.testingDate !== null
      ? { details: evaluated.details }
      : {}),
    ...(submittedSampleDate
      ? { sampleDate: submittedSampleDate.toISOString().slice(0, 10) }
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
  res.json(UpdateRecordResponse.parse(await toRecordWithCreator(record)));
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
      record: await toRecordWithCreator(currentRecord ?? record),
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