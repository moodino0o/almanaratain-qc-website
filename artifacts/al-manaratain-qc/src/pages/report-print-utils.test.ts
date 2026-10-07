import assert from "node:assert/strict";
import test from "node:test";
import {
  blockReportColumnsWithFaceArea,
  blockReportColumnsWithRequiredFields,
  blockReportColumnsWithoutWetWeight,
  calculateBlockNetArea,
  formatDammamBlockArea,
  formatBlockNetArea,
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

test("calculates Block net area from width and length and handles missing dimensions", () => {
  assert.equal(calculateBlockNetArea("250", "400"), 100_000);
  assert.equal(formatBlockNetArea(250, 400), "100000");
  assert.equal(formatBlockNetArea("250.5", "400"), "100200");
  assert.equal(calculateBlockNetArea("", 400), null);
  assert.equal(calculateBlockNetArea(250, "not entered"), null);
});

test("formats Dammam area with grouping and preserves one-decimal report strengths", () => {
  assert.equal(formatDammamBlockArea(176245.7), "176,246");
  assert.equal(formatDammamBlockArea(""), "-");
});

test("Dammam Block layouts always include plant, geometry, and strength result fields", () => {
  const fallback = fieldsForReport("Blocks", "blockCompression")
    .map((field, order) => ({ ...field, order, visible: true }));
  const saved = fallback.filter((column) =>
    !["faceArea", "water", "grossArea", "netArea", "grossStrength", "netStrength"].includes(column.key),
  );
  const compatible = blockReportColumnsWithRequiredFields(
    saved,
    fallback.map((column) =>
      column.key === "load" ? { ...column, label: "Failure Load (kN)" } : column,
    ),
    ["no", "length", "width", "height", "load", "grossArea", "netArea", "grossStrength", "netStrength", "airDry", "normalized", "density"],
  );

  assert.ok(compatible.some((column) => column.key === "grossArea" && column.visible));
  assert.ok(compatible.some((column) => column.key === "netArea" && column.visible));
  assert.ok(compatible.some((column) => column.key === "grossStrength" && column.visible));
  assert.ok(compatible.some((column) => column.key === "netStrength" && column.visible));
  assert.equal(compatible.find((column) => column.key === "load")?.label, "Failure Load (kN)");
  assert.ok(compatible.reduce((sum, column) => sum + (column.visible ? column.width : 0), 0) <= 100.001);
});

test("adds Net Area after Height to older Block compression column layouts", () => {
  const fallback = fieldsForReport("Blocks", "blockCompression")
    .map((field, order) => ({ ...field, order, visible: true }));
  const saved = fallback
    .filter((column) =>
      !["faceArea", "grossArea", "netArea", "grossStrength", "netStrength"].includes(column.key),
    )
    .map((column, order) => ({ ...column, order }));
  const compatible = blockReportColumnsWithFaceArea(
    saved,
    fallback.find((column) => column.key === "faceArea"),
  );

  assert.deepEqual(
    compatible.map((column) => column.key),
    ["no", "length", "width", "height", "faceArea", "load", "water", "airDry", "normalized", "density"],
  );
  assert.equal(compatible.find((column) => column.key === "faceArea")?.label, "Net Area (mm²)");
  assert.ok(compatible.reduce((sum, column) => sum + column.width, 0) <= 100.001);
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