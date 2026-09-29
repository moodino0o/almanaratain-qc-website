import assert from "node:assert/strict";
import test from "node:test";
import { formatShapeFactor } from "./report-print-utils";

test("prints Block report shape factors to two decimal places", () => {
  assert.equal(formatShapeFactor("1.15"), "1.15");
  assert.equal(formatShapeFactor(1.2), "1.20");
  assert.equal(formatShapeFactor(null), "-");
});