import assert from "node:assert/strict";
import test from "node:test";
import {
  blockReportColumnsWithoutWetWeight,
  filterRowsWithLoad,
  formatShapeFactor,
  formatWholeNumber,
} from "./report-print-utils";
import { fieldsForReport } from "./report-layout-fields";

test("prints Block report shape factors to two decimal places", () => {
  assert.equal(formatShapeFactor("1.15"), "1.15");
  assert.equal(formatShapeFactor(1.2), "1.20");
  assert.equal(formatShapeFactor(null), "-");
});

test("formats Block dimensions as whole numbers without changing nonnumeric labels", () => {
  assert.equal(formatWholeNumber("200.4"), "200");
  assert.equal(formatWholeNumber(200.5), "201");
  assert.equal(formatWholeNumber("  "), "-");
  assert.equal(formatWholeNumber("unknown"), "unknown");
});

test("Block compression layouts cannot expose Wet Weight", () => {
  const configured = [
    { key: "length", visible: true },
    { key: "wetWeight", visible: true },
    { key: "density", visible: true },
  ];
  assert.deepEqual(blockReportColumnsWithoutWetWeight(configured), [
    configured[0],
    configured[2],
  ]);
  assert.equal(
    fieldsForReport("Blocks", "blockCompression").some((field) => field.key === "wetWeight"),
    false,
  );
});

test("report rows require an entered load, while preserving an explicit zero", () => {
  const rows = [
    { rowNo: 1, load: "" },
    { rowNo: 2, load: "   " },
    { rowNo: 3, load: 0 },
    { rowNo: 4, load: "425" },
  ];

  assert.deepEqual(filterRowsWithLoad(rows), [rows[2], rows[3]]);
});