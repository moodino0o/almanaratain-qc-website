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
) {
  const props: ReportDocumentProps = {
    report: {
      record,
      companyName: "Al Manaratain",
      companySubtitle: "Quality Control",
      ...(layout ? { layout } : {}),
    },
    ...(templateDesign ? { templateDesign } : {}),
  };
  return renderToStaticMarkup(createElement(ReportDocument, props));
}

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
          { key: "load", label: "Load (kN)", width: 20, visible: true, order: 4 },
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
    { testType: "Water", detailsMarker: "Water Quality Details" },
    { testType: "Flakiness & Elongation", detailsMarker: "Elongation Details" },
    { testType: "RMX Trial", detailsMarker: "RMX Trial Details" },
    { testType: "Kerb Stone", detailsMarker: "Kerb Stone Details" },
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
