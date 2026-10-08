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
  cubeAge: null,
  bsStandard: "BS EN 771-3",
  requiredStrength: "5",
  strengthUnit: "N/mm²",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  ...overrides,
});

const precastStandard = (
  id: number,
  material: string,
  cubeAge: number,
  requiredStrength: number,
): QcStrengthStandardRow => ({
  id,
  testType: "Precast",
  material,
  blockType: null,
  blockSize: null,
  cubeAge: String(cubeAge),
  bsStandard: `Precast ${cubeAge}-day criterion`,
  requiredStrength: String(requiredStrength),
  strengthUnit: "N/mm²",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
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

const precastRecord = (
  rows: Record<string, unknown>[],
  cubeWeightUnit: string | null = "g",
  material = "150 mm slab",
): Parameters<typeof evaluateStrengthRecord>[0] => ({
  testType: "Precast",
  material,
  details: {
    ...(cubeWeightUnit ? { cubeWeightUnit } : {}),
    cubeSize: "100*100*100",
    testRows: rows,
  },
});

const readyMixStandard = (
  overrides: Partial<QcStrengthStandardRow> = {},
): QcStrengthStandardRow => ({
  id: 3,
  testType: "Ready Mix",
  material: "Concrete",
  blockType: null,
  blockSize: null,
  cubeAge: null,
  bsStandard: "Ready Mix strength",
  requiredStrength: "7",
  strengthUnit: "N/mm²",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  ...overrides,
});

const readyMixRecord = (
  rows: Record<string, unknown>[],
): Parameters<typeof evaluateStrengthRecord>[0] => ({
  testType: "Ready Mix",
  material: "Concrete",
  details: { testRows: rows },
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

test("Ready Mix waits for blank 28-day results and reviews incomplete required entries", () => {
  const standards = [readyMixStandard()];
  const waiting = evaluateStrengthRecord(
    readyMixRecord([
      { id: 1, testAge: "7", length: 400, width: 200, load: 100 },
      { id: 2, testAge: "28", length: "", width: "", load: "" },
      { id: 3, testAge: "28", length: "", width: "", load: "" },
    ]),
    standards,
  );
  assert.equal(waiting.status, "Waiting for results");
  assert.equal(waiting.evaluation?.status, "Waiting for results");

  const incompleteResult = evaluateStrengthRecord(
    readyMixRecord([
      { id: 1, testAge: "28", length: 400, width: 200, load: "" },
    ]),
    standards,
  );
  assert.equal(incompleteResult.status, "Review");
  assert.equal(
    incompleteResult.evaluation?.reason,
    "Complete each 28-day cube's dimensions and load.",
  );

  const missingAge = evaluateStrengthRecord(
    readyMixRecord([{ id: 1, length: "", width: "", load: "" }]),
    standards,
  );
  assert.equal(missingAge.status, "Review");

  const completedResult = evaluateStrengthRecord(
    readyMixRecord([
      { id: 1, testAge: "28", length: 400, width: 200, load: 600 },
    ]),
    standards,
  );
  assert.equal(completedResult.status, "Passed");
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

test("evaluates Precast age thresholds and calculates cube density from weight", () => {
  const result = evaluateStrengthRecord(
    precastRecord([
      { rowNo: 1, testAge: 1, length: 200, width: 100, height: 100, load: 600, weight: 4000 },
      { rowNo: 2, testAge: 7, length: 100, width: 100, height: 100, load: 520, weight: 2400 },
      { rowNo: 3, testAge: 7, length: 100, width: 100, height: 100, load: 520, weight: 2400 },
      { rowNo: 4, testAge: 28, length: 100, width: 100, height: 100, load: 650, weight: 2400 },
      { rowNo: 5, testAge: 28, length: 100, width: 100, height: 100, load: 650, weight: 2400 },
    ]),
    [],
  );
  const details = result.details as Record<string, unknown>;
  const evaluations = details.precastAgeEvaluations as Array<Record<string, unknown>>;
  const rows = details.testRows as Array<Record<string, unknown>>;

  assert.equal(result.status, "Passed");
  assert.deepEqual(
    evaluations.map(({ age, minimumStrength, averageStrength, outcome }) => ({
      age,
      minimumStrength,
      averageStrength,
      outcome,
    })),
    [
      { age: 1, minimumStrength: 30, averageStrength: 30, outcome: "Approved for demolding" },
      { age: 7, minimumStrength: 52, averageStrength: 52, outcome: "Pass" },
      { age: 28, minimumStrength: 65, averageStrength: 65, outcome: "Pass" },
    ],
  );
  assert.equal(rows[0].density, "2000.00");
});

test("matches editable Precast age thresholds by product type", () => {
  const standards = [
    precastStandard(1, "150 mm slab", 28, 68),
    precastStandard(2, "200", 28, 72),
  ];
  const specimenRows = [
    { rowNo: 1, testAge: 28, length: 100, width: 100, height: 100, load: 700 },
  ];
  const lowerThreshold = evaluateStrengthRecord(
    precastRecord(specimenRows, "g", "150 mm slab"),
    standards,
  );
  const higherThreshold = evaluateStrengthRecord(
    precastRecord(specimenRows, "g", "200"),
    standards,
  );

  assert.equal(lowerThreshold.status, "Passed");
  assert.equal(higherThreshold.status, "Failed");
  assert.equal(
    (
      (lowerThreshold.details as Record<string, unknown>)
        .precastAgeEvaluations as Array<Record<string, unknown>>
    ).find((evaluation) => evaluation.age === 28)?.minimumStrength,
    68,
  );
  assert.equal(
    (
      (higherThreshold.details as Record<string, unknown>)
        .precastAgeEvaluations as Array<Record<string, unknown>>
    ).find((evaluation) => evaluation.age === 28)?.minimumStrength,
    72,
  );
});

test("applies the same Precast age thresholds to other product types", () => {
  const result = evaluateStrengthRecord(
    precastRecord(
      [
        { rowNo: 1, testAge: 1, length: 100, width: 100, height: 100, load: 300 },
        { rowNo: 2, testAge: 7, length: 100, width: 100, height: 100, load: 520 },
        { rowNo: 3, testAge: 28, length: 100, width: 100, height: 100, load: 650 },
      ],
      "g",
      "200",
    ),
    [],
  );
  const details = result.details as Record<string, unknown>;
  const evaluations = details.precastAgeEvaluations as Array<Record<string, unknown>>;

  assert.equal(result.status, "Passed");
  assert.deepEqual(
    evaluations.map(({ age, minimumStrength, outcome }) => ({
      age,
      minimumStrength,
      outcome,
    })),
    [
      { age: 1, minimumStrength: 30, outcome: "Approved for demolding" },
      { age: 7, minimumStrength: 52, outcome: "Pass" },
      { age: 28, minimumStrength: 65, outcome: "Pass" },
    ],
  );
});

test("keeps existing Precast weights saved in kilograms compatible", () => {
  const result = evaluateStrengthRecord(
    precastRecord(
      [
        {
          rowNo: 1,
          testAge: 28,
          length: 100,
          width: 100,
          height: 100,
          load: 650,
          weight: 2.4,
        },
      ],
      null,
    ),
    [],
  );
  const details = result.details as Record<string, unknown>;
  const rows = details.testRows as Array<Record<string, unknown>>;

  assert.equal(result.status, "Passed");
  assert.equal(rows[0].density, "2400.00");
});

test("marks Precast age criteria below threshold and leaves incomplete ages pending", () => {
  const result = evaluateStrengthRecord(
    precastRecord([
      { rowNo: 1, testAge: 1, length: 100, width: 100, height: 100, load: 290 },
      { rowNo: 2, testAge: 7, length: 100, width: 100, height: 100, load: 510 },
      { rowNo: 3, testAge: 7, length: 100, width: 100, height: 100, load: "" },
      { rowNo: 4, testAge: 28, length: 100, width: 100, height: 100, load: 640 },
      { rowNo: 5, testAge: 28, length: 100, width: 100, height: 100, load: 640 },
    ]),
    [],
  );
  const details = result.details as Record<string, unknown>;
  const evaluations = details.precastAgeEvaluations as Array<Record<string, unknown>>;

  assert.equal(result.status, "Failed");
  assert.deepEqual(
    evaluations.map(({ age, outcome }) => ({ age, outcome })),
    [
      { age: 1, outcome: "Not approved for demolding" },
      { age: 7, outcome: "Pending" },
      { age: 28, outcome: "Fail" },
    ],
  );
});

test("calculates Paving tensile strength and evaluates the average against its standard", () => {
  const result = evaluateStrengthRecord(
    {
      testType: "Paving Blocks",
      material: "Concrete Block",
      details: {
        pavingBlockSize: "200*100*60",
        testRows: [
          {
            rowNo: 1,
            length: 200,
            width: 100,
            height: 60,
            load: 60.79,
            dryWeight: 2.51,
            wetWeight: 2.6,
          },
          {
            rowNo: 2,
            length: 200,
            width: 100,
            height: 60,
            load: 62.47,
            dryWeight: 2.5,
            wetWeight: 2.6,
          },
          {
            rowNo: 3,
            length: 200,
            width: 100,
            height: 60,
            load: 58.51,
            dryWeight: 2.49,
            wetWeight: 2.57,
          },
          {
            rowNo: 4,
            length: 200,
            width: 100,
            height: 60,
            load: 58.42,
            dryWeight: 2.48,
            wetWeight: 2.56,
          },
        ],
      },
    },
    [{
      ...blockStandard(),
      testType: "Paving Blocks",
      blockType: null,
      blockSize: "200 x 100 x 60",
      requiredStrength: "3.6",
    }],
    [{
      ...blockShapeFactor(),
      blockSize: "200*100*60",
      shapeFactor: null,
      correctionFactor: "0.87",
    }],
  );

  const details = result.details as Record<string, unknown>;
  const rows = details.testRows as Array<Record<string, unknown>>;
  assert.equal(result.status, "Failed");
  assert.equal(result.evaluation.averageStrength, 2.78);
  assert.equal(rows[0].tensileStrength, "2.81");
  assert.equal(rows[0].correctedStrength, 2.81);
  assert.equal(rows[1].tensileStrength, "2.89");
  assert.equal(rows[2].tensileStrength, "2.70");
  assert.equal(rows[0].density, "2166.67");
  assert.equal(rows[0].waterAbsorption, "3.59");
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

test("uses net strength for Dammam evaluation and keeps its water and air-dry results equal", () => {
  const result = evaluateStrengthRecord(
    {
      ...blockRecord([{ length: 400, width: 200, height: 200, load: 1000 }]),
      location: "Dammam",
    },
    [blockStandard({ requiredStrength: "13" })],
  );
  const row = (result.details.testRows as Record<string, unknown>[])[0];

  assert.equal(row.waterStrength, "12.50");
  assert.equal(row.airDryStrength, 12.5);
  assert.ok(Math.abs(Number(row.netStrength) - 24.509803921568626) < 1e-10);
  assert.equal(result.evaluation!.averageStrength, 24.51);
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

test("calculates Dammam gross and net results and uses net strength for compliance", () => {
  const record = blockRecord([
    { length: 400, width: 200, height: 200, load: 1200 },
    { length: 400, width: 200, height: 200, load: 1500 },
  ]);
  record.location = "Dammam Plant";
  record.details.blockSize = '8"';
  record.details.faceThickness = 30;
  record.details.webThickness = 30;

  const result = evaluateStrengthRecord(
    record,
    [blockStandard({ requiredStrength: "18" })],
  );
  const rows = result.details.testRows as Record<string, unknown>[];

  assert.equal((result.details as Record<string, unknown>).numberOfHoles, 3);
  assert.equal(rows[1].numberOfHoles, 3);
  assert.equal(rows[1].failureLoad, 1500);
  assert.equal(rows[1].failureLoadN, 1_500_000);
  assert.equal(rows[1].grossArea, 80_000);
  assert.equal(rows[1].netArea, 40_800);
  assert.equal(rows[1].grossStrength, 18.75);
  assert.ok(Math.abs(Number(rows[1].netStrength) - 1_500_000 / 40_800) < 1e-10);
  assert.equal(rows[1].airDryStrength, 18.8);
  assert.equal(result.evaluation!.averageStrength, 33.09);
  assert.ok(Math.abs(result.evaluation!.minimumStrength! - 1_200_000 / 40_800) < 1e-10);
  assert.ok(Math.abs(result.evaluation!.maximumStrength! - 1_500_000 / 40_800) < 1e-10);
  assert.equal(result.status, "Passed");
});

test("uses gross-area Air-dry strength for Dammam Sandwich Block compliance", () => {
  const record = blockRecord([
    { length: 400, width: 200, height: 200, load: 1200 },
    { length: 400, width: 200, height: 200, load: 1500 },
  ]);
  record.location = "Dammam Plant";
  record.details = {
    ...record.details,
    blockType: "8'' Sandwich Insulation Block",
    blockSize: "400 x 200 x 200",
    shapeFactor: "1.1",
  };

  const result = evaluateStrengthRecord(
    record,
    [
      blockStandard({
        blockType: "8'' Sandwich Insulation Block",
        requiredStrength: "16.7",
      }),
    ],
  );
  const details = result.details as Record<string, unknown>;
  const rows = details.testRows as Record<string, unknown>[];

  assert.equal(rows[1].grossArea, 80_000);
  assert.equal(rows[1].grossStrength, 18.75);
  assert.equal(rows[1].waterStrength, "15.63");
  assert.equal(rows[1].airDryStrength, 18.8);
  assert.equal(rows[1].normalizedStrength, 20.7);
  assert.equal("netArea" in rows[1], false);
  assert.equal("netStrength" in rows[1], false);
  assert.equal("faceThickness" in rows[1], false);
  assert.equal("webThickness" in rows[1], false);
  assert.equal("numberOfHoles" in details, false);
  assert.equal(result.evaluation!.averageStrength, 16.9);
  assert.equal(result.status, "Passed");
});

test("uses size defaults and each specimen's own Dammam thickness values", () => {
  const cases = [
    { blockSize: "400*200*200", width: 200, expectedWeb: 30 },
    { blockSize: "400*150*200", width: 150, expectedWeb: 25 },
    { blockSize: "400*100*200", width: 100, expectedWeb: 25 },
  ];

  for (const { blockSize, width, expectedWeb } of cases) {
    const result = evaluateStrengthRecord(
      {
        ...blockRecord([{ length: 400, width, height: 200, load: 1000 }]),
        location: "Dammam",
        details: {
          ...blockRecord([]).details,
          blockSize,
          testRows: [{ length: 400, width, height: 200, load: 1000 }],
        },
      },
      [blockStandard()],
    );
    const row = (result.details.testRows as Record<string, unknown>[])[0];
    assert.equal(row.faceThickness, 30);
    assert.equal(row.webThickness, expectedWeb);
  }

  const customResult = evaluateStrengthRecord(
    {
      ...blockRecord([
        { length: 400, width: 200, height: 200, load: 1000 },
        {
          length: 400,
          width: 200,
          height: 200,
          load: 1000,
          faceThickness: 40,
          webThickness: 30,
        },
      ]),
      location: "Dammam",
    },
    [blockStandard()],
  );
  const rows = customResult.details.testRows as Record<string, unknown>[];
  assert.equal(rows[0].webThickness, 30);
  assert.equal(rows[0].faceThickness, 30);
  assert.equal(rows[1].webThickness, 30);
  assert.equal(rows[1].faceThickness, 40);
  assert.notEqual(rows[0].netArea, rows[1].netArea);
});

test("does not add Dammam result fields or change strength outside Dammam", () => {
  const result = evaluateStrengthRecord(
    blockRecord([{ length: 400, width: 200, height: 200, load: 1000 }]),
    [blockStandard()],
  );
  const row = (result.details.testRows as Record<string, unknown>[])[0];

  assert.equal("grossArea" in row, false);
  assert.equal("netArea" in row, false);
  assert.equal(row.airDryStrength, 15);
});

test("matches a Block standard by Block Type and Size without a material entry", () => {
  const result = evaluateStrengthRecord(
    {
      ...blockRecord([{ length: 400, width: 200, height: 200, load: 1000 }]),
      material: "",
    },
    [blockStandard()],
  );

  assert.equal(result.evaluation?.bsStandard, "BS EN 771-3");
  assert.equal(result.status, "Passed");
});

test("allows a saved manual Block standard to override the automatic match", () => {
  const selectedStandard = blockStandard({
    id: 2,
    bsStandard: "Manual block standard",
    requiredStrength: "20",
  });
  const record = blockRecord([
    { length: 400, width: 200, height: 200, load: 1000 },
  ]);
  record.details.strengthStandardId = selectedStandard.id;

  const result = evaluateStrengthRecord(
    { ...record, material: "" },
    [blockStandard(), selectedStandard],
  );

  assert.equal(result.evaluation?.bsStandard, "Manual block standard");
  assert.equal(result.status, "Failed");
});

test("passes Blocks when air-dry average meets the minimum even if wet average does not", () => {
  const result = evaluateStrengthRecord(
    blockRecord([
      { length: 400, width: 200, height: 200, load: 460.8 },
      { length: 400, width: 200, height: 200, load: 447.3 },
      { length: 400, width: 200, height: 200, load: 572.3 },
      { length: 400, width: 200, height: 200, load: 590.3 },
      { length: 400, width: 200, height: 200, load: 598.4 },
    ]),
    [blockStandard({ requiredStrength: "7.5" })],
  );

  assert.equal(result.evaluation!.averageStrength, 8.02);
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

test("preserves the configured shape-factor precision in Block calculations", () => {
  const result = evaluateStrengthRecord(
    blockRecord([
      { length: 400, width: 200, height: 200, load: 1000 },
    ]),
    [blockStandard()],
    [blockShapeFactor({ shapeFactor: "1.234" })],
  );

  const resultDetails = result.details as Record<string, unknown>;
  const resultRows = resultDetails.testRows as Array<Record<string, unknown>>;
  assert.equal(resultDetails.shapeFactor, "1.234");
  assert.equal(resultRows[0].normalizedStrength, 18.5);
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

test("keeps Dammam Blocks in Review when Net Strength cannot be calculated", () => {
  const result = evaluateStrengthRecord(
    {
      ...blockRecord([
        {
          rowNo: 1,
          length: 400,
          width: 200,
          height: 200,
          load: 1500,
          faceThickness: 500,
          webThickness: 500,
          airDryStrength: 100,
        },
      ]),
      location: "Dammam",
    },
    [blockStandard({ requiredStrength: "13" })],
  );

  assert.equal(result.status, "Review");
  assert.equal(result.evaluation!.averageStrength, null);
  assert.match(result.evaluation!.reason ?? "", /net strength/i);
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