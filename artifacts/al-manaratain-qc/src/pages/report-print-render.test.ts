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

type DataTableProps = {
  design: ReportTemplateDesign;
  record: QcRecord;
  object: ReportTemplateObject;
  fieldValues: Record<string, string>;
  formulaPreview?: boolean;
};

let viteServer: ViteDevServer;
let ReportTemplateDataTable: ComponentType<DataTableProps>;

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

function renderTable(design: ReportTemplateDesign, object: ReportTemplateObject) {
  return renderToStaticMarkup(createElement(ReportTemplateDataTable, {
    design,
    record: reportFixture(),
    object,
    fieldValues: {},
  }));
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