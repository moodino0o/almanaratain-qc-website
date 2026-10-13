import assert from "node:assert/strict";
import path from "node:path";
import test, { after, before } from "node:test";
import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import react from "@vitejs/plugin-react";
import { createServer, type ViteDevServer } from "vite";
import type {
  QcRecord,
  ReportTemplateDesign,
  ReportTemplateObject,
  StrengthStandard,
} from "@workspace/api-client-react";
import type { ReportDocumentProps } from "./report-print";
import { createEmptyDesign } from "./report-designer-types";

type DataTableProps = {
  design: ReportTemplateDesign;
  record: QcRecord;
  object: ReportTemplateObject;
  fieldValues: Record<string, string>;
  formulaPreview?: boolean;
};

let viteServer: ViteDevServer;
let ReportTemplateDataTable: ComponentType<DataTableProps>;
let ReportDocument: ComponentType<ReportDocumentProps>;

before(async () => {
  const artifactRoot = path.resolve(import.meta.dirname, "../..");
  viteServer = await createServer({
    configFile: false,
    root: artifactRoot,
    appType: "custom",
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.join(artifactRoot, "src"),
      },
      dedupe: ["react", "react-dom"],
    },
    server: { middlewareMode: true },
  });
  const reportPrint = await viteServer.ssrLoadModule("/src/pages/report-print.tsx");
  ReportTemplateDataTable = reportPrint.ReportTemplateDataTable;
  ReportDocument = reportPrint.ReportDocument;
});

after(async () => {
  await viteServer?.close();
});

function reportFixture(): QcRecord {
  return {
    id: 101,
    recordNo: "RM-101",
    testType: "Ready Mix",
    sampleDate: "2026-09-20",
    location: "Manama",
    material: "Concrete",
    status: "Pass",
    testedBy: "QC Tester",
    reviewedBy: "",
    remarks: "",
    createdAt: "2026-09-21T00:00:00.000Z",
    details: {
      testRows: [
        { sample: "Cube A", mass: 25, total: 100 },
        { sample: "Cube B", mass: 30, total: 60 },
      ],
    },
  } as QcRecord;
}

function templateObject(overrides: Partial<ReportTemplateObject>): ReportTemplateObject {
  return {
    id: "table",
    type: "table",
    name: "Strength results",
    x: 0,
    y: 0,
    width: 180,
    height: 40,
    zIndex: 1,
    visible: true,
    ...overrides,
  } as ReportTemplateObject;
}

function cell(
  id: string,
  parentId: string,
  columnIndex: number,
  overrides: Partial<ReportTemplateObject>,
) {
  return templateObject({
    id,
    parentId,
    type: "tableCell",
    name: id,
    x: columnIndex * 60,
    y: 0,
    width: 60,
    height: 8,
    zIndex: columnIndex,
    visible: true,
    columnIndex,
    ...overrides,
  });
}

function row(
  id: string,
  rowType: "header" | "dynamic" | "static",
  y: number,
  cells: ReportTemplateObject[],
  visible = true,
) {
  return [
    templateObject({
      id,
      parentId: "table",
      type: "tableRow",
      rowType,
      name: id,
      x: 0,
      y,
      width: 180,
      height: 8,
      zIndex: y,
      visible,
    }),
    ...cells,
  ];
}

function structuredDesign(): ReportTemplateDesign {
  const objects = [
    templateObject({ id: "table", tableKey: "readyMixResults" }),
    ...row("header", "header", 0, [
      cell("head-sample", "header", 0, { content: "Sample" }),
      cell("head-mass", "header", 1, { content: "Mass" }),
      cell("head-percent", "header", 2, { content: "Percent" }),
      cell("head-hidden", "header", 3, { content: "HIDDEN_HEADER", visible: false }),
    ]),
    ...row("body", "dynamic", 8, [
      cell("sample-value", "body", 0, { fieldKey: "details.sample" }),
      cell("mass-value", "body", 1, { fieldKey: "details.mass" }),
      cell("percent-value", "body", 2, { formula: "=({{details.mass}} / {{details.total}}) * 100" }),
      cell("body-hidden", "body", 3, { content: "HIDDEN_CELL", visible: false }),
    ]),
    ...row("hidden-row", "static", 16, [
      cell("hidden-row-cell", "hidden-row", 0, { content: "HIDDEN_ROW" }),
    ], false),
  ];
  return {
    schemaVersion: 2,
    page: {
      widthMm: 210,
      heightMm: 297,
      orientation: "portrait",
      marginTopMm: 10,
      marginRightMm: 10,
      marginBottomMm: 10,
      marginLeftMm: 10,
      showHeader: true,
      showFooter: true,
    },
    layout: { title: "Results", columns: {} },
    objects,
  } as ReportTemplateDesign;
}

function renderTable(
  design: ReportTemplateDesign,
  object: ReportTemplateObject,
  record = reportFixture(),
) {
  return renderToStaticMarkup(createElement(ReportTemplateDataTable, {
    design,
    record,
    object,
    fieldValues: {},
  }));
}

function renderDocument(
  record: QcRecord,
  templateDesign?: ReportTemplateDesign,
  layout?: ReportDocumentProps["report"]["layout"],
  strengthStandards?: StrengthStandard[],
) {
  const props: ReportDocumentProps = {
    report: {
      record,
      companyName: "Al Manaratain",
      companySubtitle: "Quality Control",
      ...(layout ? { layout } : {}),
    },
    ...(templateDesign ? { templateDesign } : {}),
    ...(strengthStandards ? { strengthStandards } : {}),
  };
  return renderToStaticMarkup(createElement(ReportDocument, props));
}

test("prints Water reports with dates, limits, exact SO3 choice, chloride, and derived conductivity", () => {
  const record = {
    ...reportFixture(),
    testType: "Water",
    sampleDate: "2026-05-21",
    location: "HIDD",
    details: {
      testingAge: 10,
      ph: 7.2,
      tds: "273.90",
      chloride: 38.28924,
      sulphate: ">400",
      waterEvaluation: {
        criteria: [
          { parameter: "pH", minimum: 4.5, maximum: 8, withinLimits: true },
          { parameter: "Chloride (Cl)", minimum: 0, maximum: 350, withinLimits: true },
          { parameter: "TDS", minimum: 0, maximum: 2000, withinLimits: true },
          { parameter: "SO3", minimum: 400, maximum: 1000, withinLimits: true },
        ],
      },
    },
  } as QcRecord;
  const markup = renderDocument(record);

  assert.match(markup, /PARAMETER \/ LIMIT/);
  assert.match(markup, /Sampling Date/);
  assert.match(markup, /Testing Date/);
  assert.match(markup, /21-May-26/);
  assert.match(markup, /31-May-26/);
  assert.match(markup, /&gt;400/);
  assert.match(markup, /38\.29/);
  assert.match(markup, /273\.90/);
  assert.match(markup, /0\.41/);
  assert.match(markup, /Cl Content:/);
  assert.match(markup, /SO₄ Content:/);
  assert.match(markup, /Conductivity:/);
  assert.match(markup, /Non/);
  assert.match(markup, /PASS/);
  assert.doesNotMatch(markup, /Water Quality Details/);
});

test("prints Kerbstone specimen measurements and per-type formula-calculated bending strengths", () => {
  const record = {
    ...reportFixture(),
    testType: "Kerb Stone",
    sampleDate: "2026-10-11T00:00:00.000Z",
    details: {
      kerbType: "Road kerb",
      age: "28.0",
      testingDate: "2026-10-12T00:00:00.000Z",
      testRows: [{
        rowNo: 1,
        length: "915.0",
        width: "100.0",
        height: "225.0",
        batterDepth: "40.0",
        batterAngle: "15.0",
        spanLength: "300.0",
        failureLoad: "10",
        weight: "12",
        wetWeight: "12.5",
      }],
    },
  } as QcRecord;
  const markup = renderDocument(record);

  assert.match(markup, /Kerbstone Specimen Results/);
  assert.match(markup, /kerb-details-layout/);
  assert.match(markup, /Kerb Size:/);
  assert.match(markup, /915 × 125 × 225 mm/);
  assert.match(markup, /Test Conducted:/);
  assert.match(markup, /Bending-load test/);
  assert.ok(markup.indexOf("Bending-load test") < markup.indexOf("Test Results Summary"));
  assert.ok(markup.indexOf("Applicable Standard") < markup.indexOf("Test Results Summary"));
  assert.ok(markup.indexOf("Test Results Summary") < markup.indexOf("Kerbstone Specimen Results"));
  assert.match(markup, /Applicable Standard/);
  assert.match(markup, /11 - Oct - 2026/);
  assert.match(markup, /08 - Nov - 2026/);
  assert.ok(markup.indexOf("11 - Oct - 2026") < markup.indexOf("08 - Nov - 2026"));
  assert.doesNotMatch(markup, /915\.0|100\.0|225\.0|40\.0|15\.0|300\.0/);
  assert.match(markup, /Test Results Summary/);
  assert.doesNotMatch(markup, /Test Results Summary<\/h3>\s*<strong/);
  assert.match(markup, /Characteristic bending strength/);
  assert.match(markup, /Water absorption/);
  assert.match(markup, /<td>1\.21 MPa<\/td>/);
  assert.match(markup, /<td>4\.17%<\/td>/);
  assert.doesNotMatch(markup, /Bending strength\s*<\/strong>|Average: 1\.2 MPa|Minimum: 1\.2 MPa|Maximum: 1\.2 MPa|28\.13 MPa/);
  assert.match(markup, /kerbstone-specimen-table/);
  assert.match(markup, /kerbstone-specimen-section/);
  assert.doesNotMatch(markup, /<th>y \(mm\)<\/th>|<th>I \(mm⁴\)<\/th>/);
  assert.doesNotMatch(markup, /Weight \(kg\)|Wet Weight \(kg\)/);
  assert.doesNotMatch(markup, /specimens assessed|Avg\. Strength:|Min\. Strength:|Max\. Strength:/);
  assert.doesNotMatch(markup, /Batter Depth \(mm\)|Batter Angle \(deg\)|Formula: \(failure load/);
  assert.match(markup, /Failure Load \(kN\)/);
  assert.match(markup, /1\.21 MPa/);
});

test("prints structured table headings, every data row, formulas, and visibility rules", () => {
  const design = structuredDesign();
  const markup = renderTable(design, design.objects[0]);

  assert.match(markup, /<thead>[\s\S]*Sample[\s\S]*Mass[\s\S]*Percent[\s\S]*<\/thead>/);
  assert.equal((markup.match(/<tr/g) ?? []).length, 3);
  assert.match(markup, /data-report-cell="head-sample">Sample<\/td>/);
  assert.match(markup, /data-report-cell="head-mass">Mass<\/td>/);
  assert.match(markup, /data-report-cell="head-percent">Percent<\/td>/);
  assert.match(markup, /data-report-cell="sample-value">Cube A<\/td>/);
  assert.match(markup, /data-report-cell="mass-value">25\.0<\/td>/);
  assert.match(markup, /data-report-cell="percent-value">25<\/td>/);
  assert.match(markup, /data-report-cell="sample-value">Cube B<\/td>/);
  assert.match(markup, /data-report-cell="mass-value">30\.0<\/td>/);
  assert.match(markup, /data-report-cell="percent-value">50<\/td>/);
  assert.doesNotMatch(markup, /HIDDEN_HEADER|HIDDEN_CELL|HIDDEN_ROW|head-hidden|body-hidden|hidden-row-cell/);
  assert.ok(markup.indexOf("Cube A") < markup.indexOf("Cube B"));
});

test("keeps legacy configured-column tables rendering their headers and data", () => {
  const object = templateObject({ id: "legacy-table", tableKey: "readyMixResults", name: "Legacy results" });
  const design = {
    layout: {
      title: "Legacy",
      columns: {
        readyMixResults: [
          { key: "sample", label: "Sample", width: 50, visible: true, order: 0 },
          { key: "mass", label: "Mass", width: 50, visible: true, order: 1 },
        ],
      },
    },
    objects: [object],
  } as ReportTemplateDesign;
  const markup = renderTable(design, object);

  assert.match(markup, /<th[^>]*>Sample<\/th>/);
  assert.match(markup, /<th[^>]*>Mass<\/th>/);
  assert.equal((markup.match(/<tr/g) ?? []).length, 3);
  assert.match(markup, /<td[^>]*>Cube A<\/td>/);
  assert.match(markup, /<td[^>]*>25\.0<\/td>/);
  assert.match(markup, /<td[^>]*>Cube B<\/td>/);
  assert.match(markup, /<td[^>]*>30\.0<\/td>/);
});

test("adds calculated Net Area to legacy configured-column Blocks tables", () => {
  const object = templateObject({
    id: "table",
    tableKey: "blockCompression",
    name: "Block compression results",
  });
  const legacyColumns = [
    { key: "no", label: "No.", width: 20, visible: true, order: 0 },
    { key: "length", label: "Length (mm)", width: 20, visible: true, order: 1 },
    { key: "width", label: "Width (mm)", width: 20, visible: true, order: 2 },
    { key: "height", label: "Height (mm)", width: 20, visible: true, order: 3 },
    { key: "load", label: "Load (kN)", width: 20, visible: true, order: 4 },
  ];
  const design = {
    layout: { title: "Legacy Blocks", columns: { blockCompression: legacyColumns } },
    objects: [object],
  } as ReportTemplateDesign;
  const record = {
    ...reportFixture(),
    testType: "Blocks",
    details: {
      testRows: [{ rowNo: 1, length: 400, width: 250, height: 180, load: 500 }],
    },
  } as QcRecord;

  const markup = renderTable(design, object, record);
  assert.match(markup, /<th[^>]*>Net Area \(mm²\)<\/th>/);
  assert.match(markup, /<td[^>]*>100000<\/td>/);
});

test("adds calculated Net Area to saved structured Block tables without that cell", () => {
  const object = templateObject({
    id: "table",
    tableKey: "blockCompression",
    name: "Block compression results",
  });
  const headerCells = [
    cell("head-no", "block-header", 0, { content: "No.", width: 36 }),
    cell("head-length", "block-header", 1, { content: "Length (mm)", width: 36 }),
    cell("head-width", "block-header", 2, { content: "Width (mm)", width: 36 }),
    cell("head-height", "block-header", 3, { content: "Height (mm)", width: 36 }),
    cell("head-load", "block-header", 4, { content: "Load (kN)", width: 36 }),
  ];
  const bodyCells = [
    cell("body-no", "block-body", 0, { fieldKey: "details.no", width: 36 }),
    cell("body-length", "block-body", 1, { fieldKey: "details.length", width: 36 }),
    cell("body-width", "block-body", 2, { fieldKey: "details.width", width: 36 }),
    cell("body-height", "block-body", 3, { fieldKey: "details.height", width: 36 }),
    cell("body-load", "block-body", 4, { fieldKey: "details.load", width: 36 }),
  ];
  const design = {
    layout: {
      title: "Saved Blocks",
      columns: {
        blockCompression: [
          { key: "no", label: "No.", width: 20, visible: true, order: 0 },
          { key: "length", label: "Length (mm)", width: 20, visible: true, order: 1 },
          { key: "width", label: "Width (mm)", width: 20, visible: true, order: 2 },
          { key: "height", label: "Height (mm)", width: 20, visible: true, order: 3 },
          { key: "faceThickness", label: "Face Thickness (mm)", width: 10, visible: true, order: 4 },
          { key: "webThickness", label: "Web Thickness (mm)", width: 10, visible: true, order: 5 },
          { key: "numberOfHoles", label: "Number of Holes", width: 10, visible: true, order: 6 },
          { key: "load", label: "Load (kN)", width: 20, visible: true, order: 7 },
        ],
      },
    },
    objects: [
      object,
      ...row("block-header", "header", 0, headerCells),
      ...row("block-body", "dynamic", 8, bodyCells),
    ],
  } as ReportTemplateDesign;
  const record = {
    ...reportFixture(),
    testType: "Blocks",
    details: {
      testRows: [{ rowNo: 1, length: 400, width: 250, height: 180, load: 500 }],
    },
  } as QcRecord;

  const markup = renderTable(design, object, record);
  assert.match(markup, /Net Area \(mm²\)/);
  assert.match(markup, /data-report-cell="block-body-face-area">100000<\/td>/);
});

test("updates legacy structured Face Area cells to Net Area and recalculates width times length", () => {
  const object = templateObject({
    id: "table",
    tableKey: "blockCompression",
    name: "Block compression results",
  });
  const headerCells = [
    cell("head-face-area", "block-header", 0, { content: "Face Area (mm²)" }),
  ];
  const bodyCells = [
    cell("body-face-area", "block-body", 0, {
      name: "Face Area",
      formula: "={{details.length}} * {{details.height}}",
    }),
  ];
  const design = {
    layout: {
      title: "Saved Blocks",
      columns: {
        blockCompression: [
          { key: "faceArea", label: "Face Area (mm²)", width: 100, visible: true, order: 0 },
        ],
      },
    },
    objects: [
      object,
      ...row("block-header", "header", 0, headerCells),
      ...row("block-body", "dynamic", 8, bodyCells),
    ],
  } as ReportTemplateDesign;
  const record = {
    ...reportFixture(),
    testType: "Blocks",
    details: {
      testRows: [{ rowNo: 1, length: 400, width: 250, height: 180, load: 500 }],
    },
  } as QcRecord;

  const markup = renderTable(design, object, record);
  assert.match(markup, /Net Area \(mm²\)/);
  assert.doesNotMatch(markup, /Face Area/);
  assert.match(markup, /data-report-cell="body-face-area">100000<\/td>/);
});

test("prints recalculated Dammam geometry and strength in saved Block report tables", () => {
  const object = templateObject({
    id: "table",
    tableKey: "blockCompression",
    name: "Block compression results",
  });
  const design = {
    layout: {
      title: "Saved Dammam Blocks",
      columns: {
        blockCompression: [
          { key: "no", label: "No.", width: 20, visible: true, order: 0 },
          { key: "length", label: "Length (mm)", width: 20, visible: true, order: 1 },
          { key: "width", label: "Width (mm)", width: 20, visible: true, order: 2 },
          { key: "height", label: "Height (mm)", width: 20, visible: true, order: 3 },
          { key: "load", label: "Load (kN)", width: 20, visible: true, order: 4 },
        ],
      },
    },
    objects: [object],
  } as ReportTemplateDesign;
  const record = {
    ...reportFixture(),
    testType: "Blocks",
    location: "Dammam Plant",
    details: {
      blockType: '8" Plain Block',
      blockSize: '8"',
      faceThickness: "30",
      webThickness: "30",
      testRows: [
        {
          rowNo: 1,
          length: 400,
          width: 200,
          height: 200,
          load: 500,
          faceThickness: 30,
          webThickness: 30,
        },
        {
          rowNo: 2,
          length: 400,
          width: 200,
          height: 200,
          load: 500,
          faceThickness: 40,
          webThickness: 25,
        },
      ],
    },
  } as QcRecord;

  const markup = renderTable(design, object, record);
  assert.match(markup, /Failure Load \(kN\)/);
  assert.doesNotMatch(markup, /Gross Area|Air Dry/);
  assert.match(markup, /Net Area \(mm²\)/);
  assert.doesNotMatch(markup, /Web Thickness|Face Thickness|Number of Holes/);
  assert.match(markup, /Gross Strength \(N\/mm²\)/);
  assert.match(markup, /Net Strength \(N\/mm²\)/);
  assert.match(markup, /40,800/);
  assert.match(markup, /47,600/);
  assert.match(markup, />6\.3<\/td>/);
  assert.match(markup, />10\.5<\/td>/);
  assert.doesNotMatch(markup, /Normalized/);

  const otherPlantMarkup = renderTable(design, object, {
    ...record,
    location: "Manama",
  } as QcRecord);
  assert.doesNotMatch(otherPlantMarkup, /Gross Area|Gross Strength|Net Strength|Failure Load/);
  assert.match(otherPlantMarkup, /Net Area \(mm²\)/);
});

test("adds missing Dammam result columns to saved structured Block tables", () => {
  const object = templateObject({
    id: "table",
    tableKey: "blockCompression",
    name: "Block compression results",
  });
  const savedColumns = [
    { key: "no", label: "No.", width: 20, visible: true, order: 0 },
    { key: "length", label: "Length (mm)", width: 20, visible: true, order: 1 },
    { key: "width", label: "Width (mm)", width: 20, visible: true, order: 2 },
    { key: "height", label: "Height (mm)", width: 20, visible: true, order: 3 },
    { key: "load", label: "Load (kN)", width: 20, visible: true, order: 4 },
  ];
  const headerCells = [
    cell("head-no", "block-header", 0, { content: "No." }),
    cell("head-length", "block-header", 1, { content: "Length (mm)" }),
    cell("head-width", "block-header", 2, { content: "Width (mm)" }),
    cell("head-height", "block-header", 3, { content: "Height (mm)" }),
    cell("head-load", "block-header", 4, { content: "Load (kN)" }),
  ];
  const bodyCells = [
    cell("body-no", "block-body", 0, { fieldKey: "details.no" }),
    cell("body-length", "block-body", 1, { fieldKey: "details.length" }),
    cell("body-width", "block-body", 2, { fieldKey: "details.width" }),
    cell("body-height", "block-body", 3, { fieldKey: "details.height" }),
    cell("body-load", "block-body", 4, { fieldKey: "details.load" }),
  ];
  const design = {
    layout: { title: "Saved Dammam Blocks", columns: { blockCompression: savedColumns } },
    objects: [
      object,
      ...row("block-header", "header", 0, headerCells),
      ...row("block-body", "dynamic", 8, bodyCells),
    ],
  } as ReportTemplateDesign;
  const record = {
    ...reportFixture(),
    testType: "Blocks",
    location: "Dammam Plant",
    details: {
      blockSize: '8"',
      faceThickness: "30",
      webThickness: "30",
      testRows: [{ rowNo: 1, length: 400, width: 200, height: 200, load: 500 }],
    },
  } as QcRecord;

  const markup = renderTable(design, object, record);
  assert.match(markup, /Failure Load \(kN\)/);
  assert.match(markup, /Net Area \(mm²\)/);
  assert.doesNotMatch(markup, /Gross Area|Air Dry/);
  assert.match(markup, /Net Strength \(N\/mm²\)/);
  assert.match(markup, /data-report-cell="block-body-netArea">40,800<\/td>/);
  assert.match(markup, /data-report-cell="block-body-grossStrength">6\.3<\/td>/);
  assert.match(markup, /data-report-cell="block-body-netStrength">12\.3<\/td>/);
});

test("uses sandwich result columns in saved structured Dammam Block tables", () => {
  const object = templateObject({
    id: "table",
    tableKey: "blockCompression",
    name: "Sandwich Block results",
  });
  const savedColumns = [
    { key: "no", label: "No.", width: 15, visible: true, order: 0 },
    { key: "length", label: "Length (mm)", width: 15, visible: true, order: 1 },
    { key: "width", label: "Width (mm)", width: 15, visible: true, order: 2 },
    { key: "height", label: "Height (mm)", width: 15, visible: true, order: 3 },
    { key: "load", label: "Load (kN)", width: 15, visible: true, order: 4 },
    { key: "faceThickness", label: "Face Thickness (mm)", width: 10, visible: true, order: 5 },
    { key: "webThickness", label: "Web Thickness (mm)", width: 10, visible: true, order: 6 },
    { key: "netArea", label: "Net Area (mm²)", width: 10, visible: true, order: 7 },
    { key: "netStrength", label: "Net Strength (N/mm²)", width: 10, visible: true, order: 8 },
  ];
  const headerCells = [
    cell("head-no", "block-header", 0, { content: "No." }),
    cell("head-length", "block-header", 1, { content: "Length (mm)" }),
    cell("head-width", "block-header", 2, { content: "Width (mm)" }),
    cell("head-height", "block-header", 3, { content: "Height (mm)" }),
    cell("head-load", "block-header", 4, { content: "Load (kN)" }),
  ];
  const bodyCells = [
    cell("body-no", "block-body", 0, { fieldKey: "details.no" }),
    cell("body-length", "block-body", 1, { fieldKey: "details.length" }),
    cell("body-width", "block-body", 2, { fieldKey: "details.width" }),
    cell("body-height", "block-body", 3, { fieldKey: "details.height" }),
    cell("body-load", "block-body", 4, { fieldKey: "details.load" }),
  ];
  const design = {
    layout: { title: "Saved Sandwich Blocks", columns: { blockCompression: savedColumns } },
    objects: [
      object,
      ...row("block-header", "header", 0, headerCells),
      ...row("block-body", "dynamic", 8, bodyCells),
    ],
  } as ReportTemplateDesign;
  const record = {
    ...reportFixture(),
    testType: "Blocks",
    location: "Dammam Plant",
    details: {
      blockType: "12 inch XL Sandwich Block",
      blockSize: '12"',
      shapeFactor: "1.1",
      testRows: [{
        rowNo: 1,
        length: 400,
        width: 300,
        height: 200,
        load: 1500,
        netArea: 120_000,
        netStrength: 88,
      }],
    },
  } as QcRecord;

  const markup = renderTable(design, object, record);
  assert.match(markup, /Gross Area \(mm²\)/);
  assert.match(markup, /Air-dry Strength \(N\/mm²\)/);
  assert.match(markup, /Normalized Strength \(N\/mm²\)/);
  assert.match(markup, /120,000/);
  assert.match(markup, /12\.5/);
  assert.match(markup, /13\.8/);
  assert.doesNotMatch(
    markup,
    /Face Thickness|Web Thickness|Net Area|Net Strength|Gross Strength|Number of Holes/,
  );
});

test("omits Dammam thickness and hole count from saved Block Test Details tables", () => {
  const object = templateObject({
    id: "details-table",
    tableKey: "blockDetails",
    name: "Block test details",
  });
  const columns = [
    { key: "blockSize", label: "Block Size", width: 20, visible: true, order: 0 },
    { key: "faceThickness", label: "Face Thickness (mm)", width: 20, visible: true, order: 1 },
    { key: "webThickness", label: "Web Thickness (mm)", width: 20, visible: true, order: 2 },
    { key: "numberOfHoles", label: "Number of Holes", width: 20, visible: true, order: 3 },
  ];
  const design = {
    layout: { title: "Dammam Block Details", columns: { blockDetails: columns } },
    objects: [object],
  } as ReportTemplateDesign;
  const record = {
    ...reportFixture(),
    testType: "Blocks",
    location: "Dammam",
    details: {
      blockType: '8" Plain Block',
      blockSize: '8"',
      faceThickness: "30",
      webThickness: "30",
      numberOfHoles: 3,
      testRows: [],
    },
  } as QcRecord;

  const markup = renderTable(design, object, record);

  assert.match(markup, /Block Size/);
  assert.doesNotMatch(markup, /Face Thickness|Web Thickness|Number of Holes/);

  const dynamicField = templateObject({
    id: "number-holes-field",
    type: "dynamicField",
    name: "Number of Holes",
    fieldKey: "details.numberOfHoles",
  });
  const dynamicDesign = createEmptyDesign("Blocks");
  dynamicDesign.objects.push(dynamicField);
  const dynamicMarkup = renderDocument(record, dynamicDesign);
  assert.match(dynamicMarkup, /data-report-object="number-holes-field"[^>]*><\/div>/);
  assert.doesNotMatch(dynamicMarkup, /data-report-object="number-holes-field"[^>]*>3<\/div>/);
});

test("prints Dammam net area and Net Strength summaries without Gross Area or Air Dry", () => {
  const record = {
    ...reportFixture(),
    testType: "Blocks",
    location: "Dammam Plant",
    material: '8" Plain Block',
    details: {
      blockType: '8" Plain Block',
      blockSize: '8"',
      faceThickness: "30",
      webThickness: "30",
      testRows: [{ rowNo: 1, length: 400, width: 200, height: 200, load: 500 }],
    },
  } as QcRecord;
  const markup = renderDocument(record);

  assert.match(markup, /Plant:/);
  assert.match(markup, /Dammam: Net Strength compliance basis/);
  assert.match(markup, /STRENGTH BASIS:<\/span><strong>NET STRENGTH/);
  assert.match(markup, /Net Area/);
  assert.match(markup, /Gross Strength/);
  assert.match(markup, /Net Strength/);
  assert.match(markup, /40,800/);
  assert.doesNotMatch(markup, /Normalized/);
  assert.match(markup, /Maximum<\/strong><span>Net Strength<\/span><b>12\.3<\/b>/);
  const detailsStart = markup.indexOf("Test details");
  const detailsEnd = markup.indexOf("</section>", detailsStart);
  const testDetails = markup.slice(detailsStart, detailsEnd);
  assert.doesNotMatch(testDetails, /FACE THICKNESS|WEB THICKNESS|NUMBER OF HOLES/);
  assert.doesNotMatch(markup, /Web Thickness|Face Thickness|Gross Area|Air Dry/);
  assert.match(markup, /block-report-average-row"><td colSpan="6">AVERAGE:<\/td><td>6\.3<\/td><td>12\.3<\/td>/);
  assert.match(markup, /Maximum<\/strong><span>Net Strength<\/span><b>12\.3<\/b>/);
  assert.match(markup, /Minimum<\/strong><span>Net Strength<\/span><b>12\.3<\/b>/);

  const savedLayout = {
    id: 1,
    testType: "Blocks",
    name: "Dammam Blocks layout",
    config: {
      title: "Dammam Blocks",
      fontFamily: "Arial",
      fontSize: 13,
      textColor: "#20252b",
      accentColor: "#9b1739",
      paperPadding: 13,
      sections: [
        { key: "header", visible: true, order: 0 },
        { key: "standard", visible: true, order: 1 },
        { key: "context", visible: true, order: 2 },
        { key: "remarks", visible: true, order: 3 },
        { key: "results", visible: true, order: 4 },
        { key: "signatures", visible: true, order: 5 },
      ],
      columns: {
        blockCompression: [
          { key: "faceThickness", label: "Face Thickness (mm)", width: 20, visible: true, order: 0 },
          { key: "webThickness", label: "Web Thickness (mm)", width: 20, visible: true, order: 1 },
          { key: "grossArea", label: "Gross Area (mm²)", width: 20, visible: true, order: 2 },
          { key: "airDry", label: "Air Dry (N/mm2)", width: 20, visible: true, order: 3 },
          { key: "numberOfHoles", label: "Number of Holes", width: 20, visible: true, order: 4 },
        ],
      },
      elements: [],
    },
  } as NonNullable<ReportDocumentProps["report"]["layout"]>;
  const savedMarkup = renderDocument(record, undefined, savedLayout);
  assert.doesNotMatch(savedMarkup, /Web Thickness|Face Thickness|Number of Holes|Gross Area|Air Dry/);
  assert.match(savedMarkup, /Net Area/);
  assert.match(savedMarkup, /Net Strength/);

  const otherPlantMarkup = renderDocument({ ...record, location: "Manama" } as QcRecord);
  assert.doesNotMatch(otherPlantMarkup, /FACE THICKNESS|WEB THICKNESS|NUMBER OF HOLES|Gross Area|Net Strength/);
  assert.match(otherPlantMarkup, /Normalized/);
  assert.match(otherPlantMarkup, /Net Area/);
});

test("renders Blocks remarks between Test Details and SPECIMEN RESULTS", () => {
  const record = {
    ...reportFixture(),
    recordNo: "BLK-101",
    testType: "Blocks",
    remarks: "Check the face for visible damage.",
    details: {
      blockSize: "200 mm",
      machine: "Compression Machine",
      testRows: [{ rowNo: 1, length: 400, width: 200, height: 200, load: 500 }],
    },
  } as QcRecord;
  const markup = renderDocument(record);

  const testDetailsIndex = markup.indexOf("Test details");
  const remarksIndex = markup.indexOf("Remarks:");
  const resultsIndex = markup.indexOf("Specimen results");
  assert.ok(testDetailsIndex >= 0, "Test Details should appear in the Blocks report");
  assert.ok(remarksIndex > testDetailsIndex, "Remarks should follow Test Details");
  assert.ok(resultsIndex > remarksIndex, "SPECIMEN RESULTS should follow Remarks");
});

test("prints Dammam Sandwich Blocks with gross-area and Air-dry results only", () => {
  const record = {
    ...reportFixture(),
    testType: "Blocks",
    location: "Dammam Plant",
    material: "12 inch XL Sandwich Block",
    details: {
      blockType: "12 inch XL Sandwich Block",
      blockSize: '12"',
      shapeFactor: "1.1",
      testRows: [{
        rowNo: 1,
        length: 400,
        width: 300,
        height: 200,
        load: 1500,
        faceThickness: 30,
        webThickness: 30,
        netArea: 80_000,
        netStrength: 18.75,
      }],
    },
  } as QcRecord;
  const savedLayout = {
    id: 2,
    testType: "Blocks",
    name: "Sandwich Blocks",
    config: {
      title: "Sandwich Blocks",
      fontFamily: "Arial",
      fontSize: 13,
      textColor: "#20252b",
      accentColor: "#9b1739",
      paperPadding: 13,
      sections: [
        { key: "header", visible: true, order: 0 },
        { key: "standard", visible: true, order: 1 },
        { key: "context", visible: true, order: 2 },
        { key: "remarks", visible: true, order: 3 },
        { key: "results", visible: true, order: 4 },
        { key: "signatures", visible: true, order: 5 },
      ],
      columns: {
        blockCompression: [
          { key: "faceThickness", label: "Face Thickness (mm)", width: 15, visible: true, order: 0 },
          { key: "webThickness", label: "Web Thickness (mm)", width: 15, visible: true, order: 1 },
          { key: "numberOfHoles", label: "Number of Holes", width: 15, visible: true, order: 2 },
          { key: "netArea", label: "Net Area (mm²)", width: 15, visible: true, order: 3 },
          { key: "netStrength", label: "Net Strength (N/mm²)", width: 15, visible: true, order: 4 },
        ],
      },
      elements: [],
    },
  } as NonNullable<ReportDocumentProps["report"]["layout"]>;

  for (const markup of [renderDocument(record), renderDocument(record, undefined, savedLayout)]) {
    assert.match(markup, /Dammam Sandwich: Air-dry Strength compliance basis/);
    assert.match(markup, /Gross Area/);
    assert.match(markup, /120,000/);
    assert.match(markup, /Air-dry Strength/);
    assert.match(markup, /12\.5/);
    assert.match(markup, /Normalized Strength/);
    assert.match(markup, /13\.8/);
    assert.doesNotMatch(
      markup,
      /Net Area|Net Strength|Web Thickness|Face Thickness|Number of Holes|Gross Strength/,
    );
  }
});

test("keeps legacy Blocks remarks below Test Details even when saved section order puts results first", () => {
  const record = {
    ...reportFixture(),
    testType: "Blocks",
    remarks: "Sample",
    details: {
      blockSize: "200 mm",
      machine: "Compression Machine",
      testRows: [{ rowNo: 1, length: 400, width: 200, height: 200, load: 500 }],
    },
  } as QcRecord;
  const layout = {
    id: 1,
    testType: "Blocks",
    name: "Legacy Blocks layout",
    config: {
      title: "Block Compression Test",
      fontFamily: "Arial",
      fontSize: 13,
      textColor: "#20252b",
      accentColor: "#9b1739",
      paperPadding: 13,
      sections: [
        { key: "header", visible: true, order: 0 },
        { key: "standard", visible: true, order: 1 },
        { key: "results", visible: true, order: 0 },
        { key: "remarks", visible: true, order: 8 },
        { key: "signatures", visible: true, order: 5 },
      ],
      columns: {},
      elements: [],
    },
  } as NonNullable<ReportDocumentProps["report"]["layout"]>;
  const markup = renderDocument(record, undefined, layout);
  const standardIndex = markup.indexOf("ACCORDING TO");
  const contextIndex = markup.indexOf("Test details");
  const remarksIndex = markup.indexOf("Remarks:");
  const resultsIndex = markup.indexOf("Specimen results");

  assert.match(markup, /class="report-layout-content[^"]*report-layout-content-flow"/);
  assert.ok(standardIndex >= 0 && standardIndex < contextIndex, "Test Details should follow the report standard");
  assert.ok(contextIndex < remarksIndex, "Remarks should follow Test Details");
  assert.ok(remarksIndex < resultsIndex, "SPECIMEN RESULTS should follow Remarks");
});

test("keeps saved Blocks template remarks after details, above results, and renders only one remarks field", () => {
  const record = {
    ...reportFixture(),
    recordNo: "BLK-102",
    testType: "Blocks",
    remarks: "Sample",
    details: {
      blockSize: "200 mm",
      machine: "Compression Machine",
      testRows: [{ rowNo: 1, length: 400, width: 200, height: 200, load: 500 }],
    },
  } as QcRecord;
  const sourceDesign = createEmptyDesign("Blocks");
  const design: ReportTemplateDesign = {
    ...sourceDesign,
    objects: [
      ...sourceDesign.objects,
      templateObject({
        id: "remarks-copy",
        type: "dynamicField",
        name: "Remarks",
        fieldKey: "REMARKS",
        x: 13,
        y: 30,
        width: 80,
        height: 8,
        zIndex: 20,
      }),
    ],
  };

  const markup = renderDocument(record, design);
  const testDetailsIndex = markup.indexOf("Test details");
  const remarksIndex = markup.indexOf("Remarks:");
  const resultsIndex = markup.indexOf("Specimen results");
  const contextStyle = markup.match(/data-report-object="section-context"[^>]*style="([^"]*)"/)?.[1] ?? "";
  const resultsStyle = markup.match(/data-report-object="section-results"[^>]*style="([^"]*)"/)?.[1] ?? "";
  const remarksStyle = markup.match(/class="report-remarks report-layout-section"[^>]*style="([^"]*)"/)?.[1] ?? "";
  const contextTop = Number(contextStyle.match(/top:([\d.]+)mm/)?.[1]);
  const contextHeight = Number(contextStyle.match(/height:([\d.]+)mm/)?.[1]);
  const resultsTop = Number(resultsStyle.match(/top:([\d.]+)mm/)?.[1]);
  const remarksTop = Number(remarksStyle.match(/top:([\d.]+)mm/)?.[1]);
  const remarksHeight = Number(remarksStyle.match(/min-height:([\d.]+)mm/)?.[1]);

  assert.ok(testDetailsIndex >= 0);
  assert.ok(remarksIndex > testDetailsIndex);
  assert.ok(resultsIndex > remarksIndex);
  assert.ok(contextTop + contextHeight < remarksTop, "Remarks should start below the full details section");
  assert.ok(remarksTop + remarksHeight <= resultsTop, "results should start below Remarks");
  assert.equal(sourceDesign.objects.find((object) => object.sectionKey === "context")?.height, 39);
  assert.doesNotMatch(markup, /data-report-object="section-remarks"/);
  assert.doesNotMatch(markup, /data-report-object="remarks-copy"/);
  assert.equal((markup.match(/Remarks:/g) ?? []).length, 1);
});

test("places remarks after report details and before specimen results across every report renderer", () => {
  const cases: Array<{
    testType: QcRecord["testType"];
    detailsMarker: string;
    resultsMarker?: string;
  }> = [
    {
      testType: "Ready Mix",
      detailsMarker: "Test Details",
      resultsMarker: 'class="report-ready-mix-results"',
    },
    {
      testType: "Paving Blocks",
      detailsMarker: "Customer and Mix Details",
      resultsMarker: "report-specimen-table",
    },
    {
      testType: "Sand Sieve",
      detailsMarker: "Sample Details",
      resultsMarker: "Sieve Measurements:",
    },
    {
      testType: "Aggregate Sieve",
      detailsMarker: "Sample Details",
      resultsMarker: "Sieve Measurements:",
    },
    {
      testType: "Precast",
      detailsMarker: "Precast Details",
      resultsMarker: "Precast Compression Results",
    },
    { testType: "Water", detailsMarker: "PARAMETER / LIMIT" },
    { testType: "Flakiness & Elongation", detailsMarker: "Elongation Details" },
    { testType: "RMX Trial", detailsMarker: "RMX Trial Details" },
    { testType: "Kerb Stone", detailsMarker: "Test Details" },
  ];

  for (const scenario of cases) {
    const record = {
      ...reportFixture(),
      testType: scenario.testType,
      remarks: "Same placement",
      details: {
        testRows: [
          { rowNo: 1, age: 28, length: 400, width: 200, height: 200, load: 500 },
        ],
        sieveRows: [
          { sieveSize: "4.75 mm", amountReturned: 100, amountPassing: 900, passingPercentage: 90 },
        ],
        sampleAge: 7,
        testingDate: "2026-09-27",
      },
    } as QcRecord;
    const markup = renderDocument(record);
    const detailsIndex = markup.indexOf(scenario.detailsMarker);
    const remarksIndex = markup.indexOf("Remarks:");
    const resultsIndex = scenario.resultsMarker
      ? markup.indexOf(scenario.resultsMarker)
      : -1;

    assert.ok(detailsIndex >= 0, `${scenario.testType}: details should render`);
    assert.ok(remarksIndex > detailsIndex, `${scenario.testType}: Remarks should follow details`);
    if (scenario.resultsMarker) {
      assert.ok(
        resultsIndex > remarksIndex,
        `${scenario.testType}: specimen results should follow Remarks`,
      );
    }
    assert.equal(
      (markup.match(/class="report-remarks report-layout-section"/g) ?? []).length,
      1,
      `${scenario.testType}: Remarks should render once`,
    );
  }
});

test("prints editable Precast standards for the matching product type", () => {
  const record = {
    ...reportFixture(),
    testType: "Precast",
    material: "150 mm slab",
    details: { testRows: [{ testAge: 7, strength: 60 }] },
  } as QcRecord;
  const standards = [
    {
      id: 1,
      testType: "Precast",
      material: "150 mm slab",
      blockType: null,
      blockSize: null,
      cubeAge: 7,
      bsStandard: "150 mm slab 7-day",
      requiredStrength: 57,
      strengthUnit: "N/mm²",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: 2,
      testType: "Precast",
      material: "200",
      blockType: null,
      blockSize: null,
      cubeAge: 7,
      bsStandard: "200 7-day",
      requiredStrength: 77,
      strengthUnit: "N/mm²",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  ] as StrengthStandard[];
  const markup = renderDocument(record, undefined, undefined, standards);

  assert.match(markup, /57\.0 N\/mm²/);
  assert.match(markup, /20 - Sept - 2026/);
  assert.match(markup, /<th[^>]*>Testing Date<\/th>/);
  assert.match(markup, /class="report-table precast-compression-results"/);
  assert.match(markup, /<td>7<\/td>\s*<td>27 - Sept - 2026<\/td>/);
  assert.match(markup, /Outcome/);
  assert.match(markup, /7 days<\/td>\s*<td>60\.0<\/td>\s*<td>57\.0 N\/mm²<\/td>\s*<td class="report-compliance-status pass">PASS/);
  assert.doesNotMatch(markup, /77\.0 N\/mm²/);
});
