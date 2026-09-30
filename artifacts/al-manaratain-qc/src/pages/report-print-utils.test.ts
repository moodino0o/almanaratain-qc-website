import assert from "node:assert/strict";
import test from "node:test";
import { filterRowsWithLoad, formatShapeFactor } from "./report-print-utils";

test("prints Block report shape factors to two decimal places", () => {
  assert.equal(formatShapeFactor("1.15"), "1.15");
  assert.equal(formatShapeFactor(1.2), "1.20");
  assert.equal(formatShapeFactor(null), "-");
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