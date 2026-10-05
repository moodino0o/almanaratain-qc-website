import assert from "node:assert/strict";
import test from "node:test";
import type { QcWaterStandardRow } from "@workspace/db";
import { evaluateWaterRecord } from "./qc-water";

const waterStandard = (
  overrides: Partial<QcWaterStandardRow> = {},
): QcWaterStandardRow => ({
  id: 1,
  name: "Water Quality Limits",
  phMin: "4.5",
  phMax: "8",
  chlorideMin: "0",
  chlorideMax: "350",
  tdsMin: "0",
  tdsMax: "2000",
  so3Min: "0",
  so3Max: "1000",
  isDefault: true,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  ...overrides,
});

const waterRecord = (details: Record<string, unknown> = {}) => ({
  testType: "Water",
  details: {
    ph: 4.5,
    chloride: 350,
    tds: 2000,
    sulphate: 1000,
    ...details,
  },
});

test("accepts inclusive Water limit boundaries and links the default profile", () => {
  const result = evaluateWaterRecord(waterRecord(), [waterStandard()]);

  assert.equal(result.status, "Passed");
  assert.equal((result.details as Record<string, unknown>).waterStandardId, 1);
  assert.deepEqual(
    result.evaluation?.criteria.map((criterion) => criterion.withinLimits),
    [true, true, true, true],
  );
});

test("uses the Water profile linked to the record and fails out-of-range results", () => {
  const defaultProfile = waterStandard();
  const customProfile = waterStandard({
    id: 2,
    name: "Tight Water Limits",
    phMin: "6",
    phMax: "7",
    chlorideMax: "100",
    tdsMax: "500",
    so3Max: "250",
    isDefault: false,
  });
  const passed = evaluateWaterRecord(
    waterRecord({
      ph: 6.5,
      chloride: 50,
      tds: 400,
      sulphate: 200,
      waterStandardId: 2,
    }),
    [defaultProfile, customProfile],
  );
  const failed = evaluateWaterRecord(
    waterRecord({
      ph: 6.5,
      chloride: 101,
      tds: 400,
      sulphate: 200,
      waterStandardId: 2,
    }),
    [defaultProfile, customProfile],
  );

  assert.equal(passed.status, "Passed");
  assert.equal(failed.status, "Failed");
  assert.equal(failed.evaluation?.standardId, 2);
});

test("keeps incomplete and broken Water links in Review", () => {
  const incomplete = evaluateWaterRecord(
    waterRecord({ tds: "" }),
    [waterStandard()],
  );
  const missingLink = evaluateWaterRecord(
    waterRecord({ waterStandardId: 99 }),
    [waterStandard()],
  );

  assert.equal(incomplete.status, "Review");
  assert.equal(missingLink.status, "Review");
  assert.match(missingLink.evaluation?.reason ?? "", /no longer available/);
});
