import assert from "node:assert/strict";
import test from "node:test";
import type { QcShapeFactorRow, QcStrengthStandardRow } from "@workspace/db";
import type { SieveStandardForEvaluation } from "./qc-strength";
import {
  blockShapeFactorFromSize,
  blockDimensionsFromSize,
  evaluateSieveRecord,
  evaluateStrengthRecord,
  normalizeBlockDetails,
  pavingCorrectionFactorFromSize,
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

const blockShapeFactor = (
  overrides: Partial<QcShapeFactorRow> = {},
): QcShapeFactorRow => ({
  id: 1,
  blockType: null,
  blockSize: "400 x 200 x 200",
  shapeFactor: "1.15",
  correctionFactor: null,
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
  assert.deepEqual(blockDimensionsFromSize('12"'), { length: 400, width: 300, height: 200 });
  assert.deepEqual(blockDimensionsFromSize("400*150*200"), { length: 400, width: 150, height: 200 });
});

test("maps Block sizes to the supplied height and width shape factor table", () => {
  assert.equal(blockShapeFactorFromSize('4"'), 1.35);
  assert.equal(blockShapeFactorFromSize('6"'), 1.25);
  assert.equal(blockShapeFactorFromSize('8"'), 1.15);
  assert.equal(blockShapeFactorFromSize('12"'), 1.1);
  assert.equal(blockShapeFactorFromSize("400*250*200"), 1.1);
  assert.equal(blockShapeFactorFromSize("400*200*100"), 0.8);
  assert.equal(blockShapeFactorFromSize("400*200*80"), null);
});

test("maps paving sizes ending in 60 and 80 to correction factors", () => {
  assert.equal(pavingCorrectionFactorFromSize("200*200*60"), 0.87);
  assert.equal(pavingCorrectionFactorFromSize("200 x 200 x 80 mm"), 1);
  assert.equal(pavingCorrectionFactorFromSize("200 x 200 x 50"), null);
});

test("evaluates multiple paving rows using the configured correction factor", () => {
  const result = evaluateStrengthRecord(
    {
      testType: "Paving Blocks",
      material: "Concrete Block",
      details: {
        pavingBlockSize: "200*200*60",
        testRows: [
          { rowNo: 1, length: 200, width: 200, load: 400 },
          { rowNo: 2, length: 200, width: 200, load: 800 },
        ],
      },
    },
    [{
      ...blockStandard(),
      testType: "Paving Blocks",
      blockType: null,
      blockSize: "200 x 200 x 60",
      requiredStrength: "13",
    }],
    [{
      ...blockShapeFactor(),
      blockSize: "200*200*60",
      shapeFactor: null,
      correctionFactor: "0.87",
    }],
  );

  const details = result.details as Record<string, unknown>;
  const rows = details.testRows as Array<Record<string, unknown>>;
  assert.equal(result.status, "Passed");
  assert.equal(result.evaluation.averageStrength, 13.05);
  assert.equal(rows[0].compressiveStrength, "10.00");
  assert.equal(rows[0].correctedStrength, 8.7);
  assert.equal(rows[1].correctedStrength, 17.4);
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

test("calculates Block air-dry and normalized strength with one-decimal rounding", () => {
  const result = evaluateStrengthRecord(
    {
      ...blockRecord([{
        length: 400,
        width: 100,
        height: 200,
        wetWeight: 3.73,
        load: 109.1,
        airDryStrength: 99,
        normalizedStrength: 99,
      }]),
      details: {
        ...blockRecord([]).details,
        shapeFactor: 1.35,
        testRows: [{
          length: 400,
          width: 100,
          height: 200,
          wetWeight: 3.73,
          load: 109.1,
          airDryStrength: 99,
          normalizedStrength: 99,
        }],
      },
    },
    [blockStandard({
      blockType: "8'' Solid Block",
      blockSize: "400 x 200 x 200",
      requiredStrength: "3.5",
    })],
  );
  const row = (result.details.testRows as Record<string, unknown>[])[0];

  assert.equal(row.waterStrength, "2.73");
  assert.equal(row.density, "466.25");
  assert.equal(row.airDryStrength, 3.3);
  assert.equal(row.normalizedStrength, 4.5);
});

test("uses air-dry strength for every Block evaluation and keeps Dammam water equal to air-dry", () => {
  const result = evaluateStrengthRecord(
    {
      ...blockRecord([{ length: 400, width: 200, height: 200, load: 1000 }]),
      location: "Dammam",
    },
    [blockStandard({ requiredStrength: "12.5" })],
  );
  const row = (result.details.testRows as Record<string, unknown>[])[0];

  assert.equal(row.waterStrength, "12.50");
  assert.equal(row.airDryStrength, 12.5);
  assert.equal(result.evaluation!.averageStrength, 12.5);
  assert.equal(result.status, "Passed");
});

test("uses the air-dry result for Block pass and fail evaluation", () => {
  const result = evaluateStrengthRecord(
    blockRecord([{ length: 400, width: 200, height: 200, load: 1000 }]),
    [blockStandard({ requiredStrength: "13" })],
  );

  assert.equal(result.evaluation!.averageStrength, 15);
  assert.equal(result.status, "Passed");
});

test("applies a configured Block-size shape factor only when no saved value exists", () => {
  const result = evaluateStrengthRecord(
    blockRecord([
      { length: 400, width: 200, height: 200, load: 1000 },
    ]),
    [blockStandard()],
    [blockShapeFactor()],
  );

  const resultDetails = result.details as Record<string, unknown>;
  const resultRows = resultDetails.testRows as Array<Record<string, unknown>>;
  assert.equal(resultDetails.shapeFactor, "1.15");
  assert.equal(resultRows[0].normalizedStrength, 17.3);

  const legacyResult = evaluateStrengthRecord(
    {
      ...blockRecord([
        { length: 400, width: 200, height: 200, load: 1000 },
      ]),
      details: {
        ...blockRecord([]).details,
        shapeFactor: "1.3",
        testRows: [{ length: 400, width: 200, height: 200, load: 1000 }],
      },
    },
    [blockStandard()],
    [blockShapeFactor()],
  );
  const legacyDetails = legacyResult.details as Record<string, unknown>;
  const legacyRows = legacyDetails.testRows as Array<Record<string, unknown>>;
  assert.equal(legacyDetails.shapeFactor, "1.3");
  assert.equal(legacyRows[0].normalizedStrength, 19.5);
});

test("does not apply a shape factor configured for a different Block size", () => {
  const result = evaluateStrengthRecord(
    blockRecord([
      { length: 400, width: 200, height: 200, load: 1000 },
    ]),
    [blockStandard()],
    [blockShapeFactor({ blockSize: "400 x 100 x 200", shapeFactor: "1.3" })],
  );

  const resultDetails = result.details as Record<string, unknown>;
  const resultRows = resultDetails.testRows as Array<Record<string, unknown>>;
  assert.equal("shapeFactor" in resultDetails, false);
  assert.equal("normalizedStrength" in resultRows[0], false);
});

test("keeps legacy manual Block strengths when calculation inputs are incomplete", () => {
  const result = evaluateStrengthRecord(
    blockRecord([{
      length: 400,
      width: 100,
      load: "",
      airDryStrength: 3.27,
      normalizedStrength: 4.42,
    }]),
    [blockStandard()],
  );
  const row = (result.details.testRows as Record<string, unknown>[])[0];

  assert.equal(row.airDryStrength, 3.27);
  assert.equal(row.normalizedStrength, 4.42);
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
  assert.equal(result.evaluation!.averageStrength, 7.2);
  assert.equal(result.evaluation!.minimumStrength, 4.8);
  assert.equal(result.evaluation!.maximumStrength, 9.6);
  assert.equal(result.evaluation!.reason, null);
});

test("uses Air Dry strength for Dammam Block compliance", () => {
  const result = evaluateStrengthRecord(
    {
      ...blockRecord([
        { rowNo: 1, length: 100, width: 100, load: 125 },
        { rowNo: 2, length: 100, width: 100, load: 150 },
      ]),
      location: "Dammam",
    },
    [blockStandard({ requiredStrength: "13.75" })],
  );

  assert.equal(result.status, "Passed");
  assert.equal(result.evaluation!.averageStrength, 13.75);
  assert.equal(result.evaluation!.minimumStrength, 12.5);
  assert.equal(result.evaluation!.maximumStrength, 15);
});

test("fails block compliance when the average sample strength is below the standard", () => {
  const result = evaluateStrengthRecord(
    blockRecord([
      { rowNo: 1, length: 100, width: 100, load: 60 },
      { rowNo: 2, length: 100, width: 100, load: 40 },
    ]),
    [blockStandard({ requiredStrength: "6.1" })],
  );

  assert.equal(result.status, "Failed");
  assert.equal(result.evaluation!.averageStrength, 6);
  assert.equal(result.evaluation!.minimumStrength, 4.8);
  assert.equal(result.evaluation!.maximumStrength, 7.2);
  assert.match(result.evaluation!.reason ?? "", /average block air-dry strength/i);
});