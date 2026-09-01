import assert from "node:assert/strict";
import test from "node:test";
import type { QcStrengthStandardRow } from "@workspace/db";
import type { SieveStandardForEvaluation } from "./qc-strength";
import {
  blockDimensionsFromSize,
  evaluateSieveRecord,
  evaluateStrengthRecord,
  normalizeBlockDetails,
} from "./qc-strength";

const blockStandard = (
  overrides: Partial<QcStrengthStandardRow> = {},
): QcStrengthStandardRow => ({
  id: 1,
  testType: "Blocks",
  material: "Concrete Block",
  blockType: "8'' Solid Block",
  blockSize: "400 x 200 x 200",
  bsStandard: "BS EN 771-3",
  requiredStrength: "5",
  strengthUnit: "N/mm²",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  ...overrides,
});

const blockRecord = (
  rows: Record<string, unknown>[],
): Parameters<typeof evaluateStrengthRecord>[0] => ({
  testType: "Blocks",
  material: "Concrete Block",
  details: {
    blockType: "8'' Solid Block",
    blockSize: "400 x 200 x 200",
    blockAge: 28,
    testRows: rows,
  },
});

const standard = (
  overrides: Partial<SieveStandardForEvaluation> = {},
): SieveStandardForEvaluation => ({
  id: 1,
  testType: "Sand Sieve",
  materialReferenceItemId: 10,
  sieveSizeReferenceItemId: 20,
  standardReference: "BS 812",
  measurementType: "percentage",
  minimum: "0",
  maximum: "100",
  unit: "%",
  material: "Sand",
  sieveSize: "5 mm",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  ...overrides,
});

const record = (
  details: Record<string, unknown> = {},
): Parameters<typeof evaluateSieveRecord>[0] => ({
  testType: "Sand Sieve",
  material: "Sand",
  details: {
    materialReferenceItemId: 10,
    sampleWeight: 999,
    sieveRows: [
      {
        rowNo: 1,
        sieveSize: "5 mm",
        sieveSizeReferenceItemId: 20,
        amountReturned: 40,
        passingAmount: 999,
        passingPercentage: 999,
      },
      {
        rowNo: 2,
        sieveSize: "2.36 mm",
        sieveSizeReferenceItemId: 21,
        amountReturned: 60,
      },
    ],
    ...details,
  },
});

const criterion = (result: ReturnType<typeof evaluateSieveRecord>) =>
  result.evaluation.criteria[0];

test("maps inch Block sizes to the existing specimen dimensions", () => {
  assert.deepEqual(blockDimensionsFromSize('4"'), { length: 400, width: 100, height: 200 });
  assert.deepEqual(blockDimensionsFromSize('6"'), { length: 400, width: 150, height: 200 });
  assert.deepEqual(blockDimensionsFromSize('8"'), { length: 400, width: 200, height: 200 });
  assert.deepEqual(blockDimensionsFromSize('12"'), { length: 400, width: 250, height: 200 });
  assert.deepEqual(blockDimensionsFromSize("400*150*200"), { length: 400, width: 150, height: 200 });
});

test("normalizes Block age once and fills only missing dimensions", () => {
  const details = normalizeBlockDetails({
    blockSize: '8"',
    testRows: [
      { rowNo: 1, sampleAge: 28, length: "", width: "", height: "", load: 800 },
      { rowNo: 2, sampleAge: 28, length: 410, width: 205, height: 200, load: 820 },
    ],
  });

  assert.equal(details.blockAge, "28");
  assert.deepEqual(details.testRows, [
    { rowNo: 1, length: 400, width: 200, height: 200, load: 800 },
    { rowNo: 2, length: 410, width: 205, height: 200, load: 820 },
  ]);
});

test("matches legacy Block labels to canonical standards", () => {
  const result = evaluateStrengthRecord(
    {
      testType: "Blocks",
      material: '8" Plain Block',
      details: {
        blockType: '8" Plain Block',
        blockSize: "400*200*200",
        blockAge: 28,
        testRows: [{ length: 400, width: 200, load: 800 }],
      },
    },
    [blockStandard({
      blockType: "Plain Block",
      blockSize: '8"',
      requiredStrength: "7.5",
    })],
  );

  assert.equal(result.status, "Passed");
  assert.equal((result.details.strengthEvaluation as Record<string, unknown>).requiredStrength, 7.5);
});

test("recomputes percentage standards from sample weight and returned amount", () => {
  const result = evaluateSieveRecord(
    record(),
    [standard({ minimum: "60", maximum: "60" })],
  );

  assert.equal(result.status, "Passed");
  assert.equal(criterion(result).measuredValue, 60);
  assert.equal(criterion(result).withinLimits, true);
  assert.equal(result.details.sieveRows[0].passingAmount, 60);
  assert.equal(result.details.sieveRows[0].passingPercentage, 60);
});

test("calculates passing mass from cumulative retained amounts", () => {
  const result = evaluateSieveRecord(
    record({
      sampleWeight: 300,
      sieveRows: [
        {
          rowNo: 1,
          sieveSize: "20 mm",
          sieveSizeReferenceItemId: 19,
        },
        {
          rowNo: 2,
          sieveSize: "5 mm",
          sieveSizeReferenceItemId: 20,
          amountReturned: 0,
        },
        {
          rowNo: 3,
          sieveSize: "2.36 mm",
          sieveSizeReferenceItemId: 21,
          amountReturned: 1.2,
        },
        {
          rowNo: 4,
          sieveSize: "1.18 mm",
          sieveSizeReferenceItemId: 22,
          amountReturned: 9,
        },
        {
          rowNo: 5,
          sieveSize: "0.063 mm",
          sieveSizeReferenceItemId: 23,
          amountReturned: 289.8,
        },
      ],
    }),
    [standard()],
  );

  assert.deepEqual(
    result.details.sieveRows.map((row) => row.passingAmount),
    [undefined, 300, 298.8, 289.8, 0],
  );
  assert.deepEqual(
    result.details.sieveRows.map((row) => row.passingPercentage),
    [undefined, 100, 99.6, 96.6, 0],
  );
  assert.equal(result.details.sampleWeight, 300);
});

test("recomputes amount standards using the same passing mass", () => {
  const result = evaluateSieveRecord(
    record({
      sieveRows: [
        {
          rowNo: 1,
          sieveSize: "5 mm",
          sieveSizeReferenceItemId: 20,
          amountReturned: 37.25,
          passingAmount: 1,
          passingPercentage: 1,
        },
        {
          rowNo: 2,
          sieveSize: "2.36 mm",
          sieveSizeReferenceItemId: 21,
          amountReturned: 62.75,
        },
      ],
    }),
    [standard({ measurementType: "amount", minimum: "62.75", maximum: "62.75", unit: "g" })],
  );

  assert.equal(result.status, "Passed");
  assert.equal(criterion(result).measuredValue, 62.75);
  assert.equal(criterion(result).withinLimits, true);
  assert.equal(result.details.sieveRows[0].passingAmount, 62.75);
  assert.equal(result.details.sieveRows[0].passingPercentage, 62.75);
});

test("keeps the result in Review when sample weight is zero", () => {
  const result = evaluateSieveRecord(
    record({
      sampleWeight: 0,
      sieveRows: [{
        rowNo: 1,
        sieveSize: "5 mm",
        sieveSizeReferenceItemId: 20,
        amountReturned: "",
      }],
    }),
    [standard({ minimum: "0", maximum: "100" })],
  );

  assert.equal(result.status, "Review");
  assert.equal(criterion(result).measuredValue, null);
  assert.equal(criterion(result).withinLimits, null);
  assert.equal("passingAmount" in result.details.sieveRows[0], false);
  assert.equal("passingPercentage" in result.details.sieveRows[0], false);
});

test("keeps the result in Review when no sieve amounts are entered", () => {
  const result = evaluateSieveRecord(
    record({
      sampleWeight: "",
      sieveRows: [{
        rowNo: 1,
        sieveSize: "5 mm",
        sieveSizeReferenceItemId: 20,
        amountReturned: "",
      }],
    }),
    [standard({ minimum: "0", maximum: "100" })],
  );

  assert.equal(result.status, "Review");
  assert.equal(criterion(result).measuredValue, null);
});

test("keeps the result in Review when returned amount is missing", () => {
  const result = evaluateSieveRecord(
    record({
      sieveRows: [
        {
          rowNo: 1,
          sieveSize: "5 mm",
          sieveSizeReferenceItemId: 20,
          amountReturned: "",
          passingAmount: 60,
          passingPercentage: 60,
        },
      ],
    }),
    [standard({ minimum: "0", maximum: "100" })],
  );

  assert.equal(result.status, "Review");
  assert.equal(criterion(result).measuredValue, null);
  assert.equal("amountReturned" in result.details.sieveRows[0], false);
  assert.equal("passingAmount" in result.details.sieveRows[0], false);
  assert.equal("passingPercentage" in result.details.sieveRows[0], false);
});

test("keeps the result in Review when a sieve amount is invalid", () => {
  const result = evaluateSieveRecord(
    record({
      sieveRows: [
        {
          rowNo: 1,
          sieveSize: "5 mm",
          sieveSizeReferenceItemId: 20,
          amountReturned: "not a number",
        },
      ],
    }),
    [standard({ minimum: "0", maximum: "100" })],
  );

  assert.equal(result.status, "Review");
  assert.equal(criterion(result).measuredValue, null);
  assert.equal("passingAmount" in result.details.sieveRows[0], false);
  assert.equal("passingPercentage" in result.details.sieveRows[0], false);
});

test("treats both standard limits as inclusive", () => {
  const result = evaluateSieveRecord(
    record(),
    [standard({ minimum: "60", maximum: "60" })],
  );

  assert.equal(criterion(result).measuredValue, 60);
  assert.equal(criterion(result).withinLimits, true);
  assert.equal(result.status, "Passed");
});

test("ignores reference-only sieve rows when configured criteria pass", () => {
  const result = evaluateSieveRecord(
    record({
      sieveRows: [
        {
          rowNo: 1,
          sieveSize: "5 mm",
          sieveSizeReferenceItemId: 20,
          amountReturned: 40,
        },
        {
          rowNo: 2,
          sieveSize: "2.36 mm",
          sieveSizeReferenceItemId: 21,
          amountReturned: "",
        },
        {
          rowNo: 3,
          sieveSize: "1.18 mm",
          sieveSizeReferenceItemId: 22,
          amountReturned: 60,
        },
      ],
    }),
    [standard({ minimum: "60", maximum: "60" })],
  );

  assert.equal(result.status, "Passed");
  assert.equal(result.evaluation.criteria.length, 1);
  assert.equal(result.details.sieveRows.length, 3);
});

test("keeps unmatched materials in Review", () => {
  const result = evaluateSieveRecord(
    record({ materialReferenceItemId: 999 }),
    [standard()],
  );

  assert.equal(result.status, "Review");
  assert.equal(result.evaluation.criteria.length, 0);
  assert.match(result.evaluation.reason ?? "", /No matching sieve standards/);
});

test("keeps missing sieve rows in Review", () => {
  const result = evaluateSieveRecord(
    record({ sieveRows: [] }),
    [standard()],
  );

  assert.equal(result.status, "Review");
  assert.equal(criterion(result).measuredValue, null);
  assert.equal(criterion(result).withinLimits, null);
});

test("evaluates block compliance using the average sample strength", () => {
  const result = evaluateStrengthRecord(
    blockRecord([
      { rowNo: 1, length: 100, width: 100, load: 80 },
      { rowNo: 2, length: 100, width: 100, load: 40 },
    ]),
    [blockStandard({ requiredStrength: "5" })],
  );

  assert.equal(result.status, "Passed");
  assert.equal(result.evaluation.averageStrength, 6);
  assert.equal(result.evaluation.minimumStrength, 4);
  assert.equal(result.evaluation.maximumStrength, 8);
  assert.equal(result.evaluation.reason, null);
});

test("fails block compliance when the average sample strength is below the standard", () => {
  const result = evaluateStrengthRecord(
    blockRecord([
      { rowNo: 1, length: 100, width: 100, load: 60 },
      { rowNo: 2, length: 100, width: 100, load: 40 },
    ]),
    [blockStandard({ requiredStrength: "5.1" })],
  );

  assert.equal(result.status, "Failed");
  assert.equal(result.evaluation.averageStrength, 5);
  assert.equal(result.evaluation.minimumStrength, 4);
  assert.equal(result.evaluation.maximumStrength, 6);
  assert.match(result.evaluation.reason ?? "", /average block strength/i);
});