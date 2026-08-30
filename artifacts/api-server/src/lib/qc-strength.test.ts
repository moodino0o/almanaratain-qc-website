import assert from "node:assert/strict";
import test from "node:test";
import type { SieveStandardForEvaluation } from "./qc-strength";
import { evaluateSieveRecord } from "./qc-strength";

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
    sampleWeight: 100,
    sieveRows: [
      {
        rowNo: 1,
        sieveSize: "5 mm",
        sieveSizeReferenceItemId: 20,
        amountReturned: 40,
        passingAmount: 999,
        passingPercentage: 999,
      },
    ],
    ...details,
  },
});

const criterion = (result: ReturnType<typeof evaluateSieveRecord>) =>
  result.evaluation.criteria[0];

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
    record({ sampleWeight: 0 }),
    [standard({ minimum: "0", maximum: "100" })],
  );

  assert.equal(result.status, "Review");
  assert.equal(criterion(result).measuredValue, null);
  assert.equal(criterion(result).withinLimits, null);
  assert.equal("passingAmount" in result.details.sieveRows[0], false);
  assert.equal("passingPercentage" in result.details.sieveRows[0], false);
});

test("keeps the result in Review when sample weight is missing", () => {
  const result = evaluateSieveRecord(
    record({ sampleWeight: "" }),
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
  assert.equal("passingAmount" in result.details.sieveRows[0], false);
  assert.equal("passingPercentage" in result.details.sieveRows[0], false);
});

test("keeps the result in Review when returned amount exceeds sample weight", () => {
  const result = evaluateSieveRecord(
    record({
      sieveRows: [
        {
          rowNo: 1,
          sieveSize: "5 mm",
          sieveSizeReferenceItemId: 20,
          amountReturned: 101,
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
      ],
    }),
    [standard({ minimum: "60", maximum: "60" })],
  );

  assert.equal(result.status, "Passed");
  assert.equal(result.evaluation.criteria.length, 1);
  assert.equal(result.details.sieveRows.length, 2);
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