import assert from "node:assert/strict";
import test from "node:test";
import { RecordStatus, TestType, type QcRecord } from "@workspace/api-client-react";
import {
  blockDimensionsFromSize,
  blockMaterialMatches,
  blockSizeMatches,
  blockTypeMatches,
  calculateBlockDensity,
  calculateBlockStrengths,
  calculatePavingStrengths,
  pavingCorrectionFactorFromSize,
  calculateSieveSampleWeight,
  calculateSieveResults,
  prepareRecordForForm,
} from "./record-form-utils";

const baseRecord = (
  testType: QcRecord["testType"],
  details: Record<string, unknown>,
): QcRecord => ({
  id: 42,
  recordNo: `QC-${testType}`,
  testType,
  sampleDate: "2026-08-30",
  location: "HIDD",
  material: "Test material",
  status: RecordStatus.Passed,
  testedBy: "ADEL ABBAS EBRAHIM",
  remarks: "Keep this remark",
  details,
});

test("maps Block inch sizes to default dimensions", () => {
  assert.deepEqual(blockDimensionsFromSize('4"'), {
    length: "400",
    width: "100",
    height: "200",
  });
  assert.deepEqual(blockDimensionsFromSize('8"'), {
    length: "400",
    width: "200",
    height: "200",
  });
  assert.deepEqual(blockDimensionsFromSize('12"'), {
    length: "400",
    width: "300",
    height: "200",
  });
});

test("matches legacy Block labels to canonical standards", () => {
  assert.equal(blockTypeMatches('8" Plain Block', "Plain Block"), true);
  assert.equal(blockSizeMatches("400*200*200", '8"'), true);
  assert.equal(blockMaterialMatches("Concrete Block", '8" Plain Block', '8" Plain Block'), true);
});

test("calculates Block density from wet weight and specimen dimensions", () => {
  assert.equal(
    calculateBlockDensity({
      length: "400",
      width: "100",
      height: "200",
      wetWeight: "3.730",
    }),
    "466.25",
  );
});

test("calculates and rounds Block air-dry and normalized strengths", () => {
  assert.deepEqual(
    calculateBlockStrengths(
      { length: "400", width: "100", load: "109.1" },
      "1.35",
    ),
    {
      waterStrength: "2.73",
      airDryStrength: "3.3",
      normalizedStrength: "4.5",
    },
  );
});

test("calculates sieve passing mass from cumulative retained amounts", () => {
  const results = calculateSieveResults(
    [
      { amountReturned: "" },
      { amountReturned: "0" },
      { amountReturned: "1.2" },
      { amountReturned: "9" },
    ],
  );

  assert.deepEqual(results, [
    { passingAmount: "", passingPercentage: "" },
    { passingAmount: "10.20", passingPercentage: "100.00" },
    { passingAmount: "9.00", passingPercentage: "88.24" },
    { passingAmount: "0.00", passingPercentage: "0.00" },
  ]);
});

test("calculates sieve sample weight from entered retained amounts", () => {
  assert.equal(
    calculateSieveSampleWeight([
      { amountReturned: "" },
      { amountReturned: "0" },
      { amountReturned: "1.2" },
      { amountReturned: "9" },
    ]),
    10.2,
  );
});

test("copies Ready Mix fields, reference information, and cube rows", () => {
  const source = baseRecord(TestType.Ready_Mix, {
    referenceNumber: "S-1001",
    customerName: "Customer A",
    customerLocation: "Site A",
    slump: 85,
    temperature: 24,
    strengthStandardId: 7,
    testRows: [
      {
        rowNo: 1,
        testAge: 28,
        length: 150,
        width: 150,
        height: 150,
        dryWeight: 8.2,
        wetWeight: 8.7,
        load: 550,
        calculatedStrength: 24.44,
      },
    ],
  });

  const copied = prepareRecordForForm(source);

  assert.equal(copied.referenceNumber, "S-1001");
  assert.equal(copied.customerName, "Customer A");
  assert.equal(copied.customerLocation, "Site A");
  assert.equal(copied.details.slump, "85");
  assert.equal(copied.details.temperature, "24");
  assert.equal(copied.details.strengthStandardId, 7);
  assert.deepEqual(copied.testRows, [{
    id: 1,
    testAge: "28",
    sampleAge: "",
    length: "150",
    width: "150",
    height: "150",
    dryWeight: "8.2",
    wetWeight: "8.7",
    weight: "",
    load: "550",
    strength: "24.44",
    airDryStrength: "",
    normalizedStrength: "",
    compressiveStrength: "24.44",
    correctionFactor: "",
    correctedStrength: "",
    density: "",
    waterAbsorption: "6.10",
    sieveSize: "",
    sieveSizeReferenceItemId: null,
    amountReturned: "",
    passingAmount: "",
    passingPercentage: "",
  }]);
});

test("copies Blocks fields and every block specimen row", () => {
  const source = baseRecord(TestType.Blocks, {
    blockType: "8'' Solid Block",
    blockSize: "400*200*200",
    machine: "Machine 4",
    blockNo: "B-12",
    shapeFactor: 1.1,
    strengthStandardId: 9,
    testRows: [{
      rowNo: 1,
      sampleAge: 7,
      length: 400,
      width: 200,
      height: 200,
      dryWeight: 18,
      wetWeight: 19,
      load: 800,
      strength: 10,
      airDryStrength: 11.25,
      normalizedStrength: 12.4,
      density: 1187.5,
    }],
  });

  const copied = prepareRecordForForm(source);

  assert.equal(copied.machine, "Machine 4");
  assert.equal(copied.details.blockType, "8'' Solid Block");
  assert.equal(copied.details.blockSize, "400*200*200");
  assert.equal(copied.details.blockNo, "B-12");
  assert.equal(copied.details.shapeFactor, 1.1);
  assert.deepEqual(copied.testRows[0], {
    id: 1,
    sampleAge: "7",
    testAge: "",
    length: "400",
    width: "200",
    height: "200",
    dryWeight: "18",
    wetWeight: "19",
    weight: "",
    load: "800",
    strength: "10",
    airDryStrength: "11.25",
    normalizedStrength: "12.4",
    compressiveStrength: "10",
    correctionFactor: "",
    correctedStrength: "",
    density: "1187.5",
    waterAbsorption: "5.56",
    sieveSize: "",
    sieveSizeReferenceItemId: null,
    amountReturned: "",
    passingAmount: "",
    passingPercentage: "",
  });
});

for (const testType of [TestType.Sand_Sieve, TestType.Aggregate_Sieve]) {
  test(`copies ${testType} reference data and every sieve row`, () => {
    const source = baseRecord(testType, {
      materialReferenceItemId: 12,
      sampleWeight: 1000,
      sieveRows: [{
        rowNo: 1,
        sieveSize: "5 mm",
        sieveSizeReferenceItemId: 21,
        amountReturned: 275,
        passingAmount: 725,
        passingPercentage: 72.5,
      }],
    });

    const copied = prepareRecordForForm(source);

    assert.equal(copied.details.materialReferenceItemId, 12);
    assert.equal(copied.details.sampleWeight, "1000");
    assert.deepEqual(copied.testRows[0], {
      id: 1,
      length: "",
      width: "",
      height: "",
      dryWeight: "",
      wetWeight: "",
      weight: "",
      sampleAge: "",
      testAge: "",
      load: "",
      strength: "",
      airDryStrength: "",
      normalizedStrength: "",
      compressiveStrength: "",
      correctionFactor: "",
      correctedStrength: "",
      density: "",
      waterAbsorption: "",
      sieveSize: "5 mm",
      sieveSizeReferenceItemId: 21,
      amountReturned: "275",
      passingAmount: "725",
      passingPercentage: "72.5",
    });
  });
}

test("copies Paving Blocks material details", () => {
  const source = baseRecord(TestType.Paving_Blocks, {
    weight: 3.2,
    length: 200,
    width: 100,
    height: 80,
    compressiveStrength: 42,
    target: "40 N/mm²",
    strength: 42,
    correctionFactor: 1,
  });

  const copied = prepareRecordForForm(source);

  assert.deepEqual(copied.details, {
    weight: "3.2",
    length: "200",
    width: "100",
    height: "80",
    compressiveStrength: "42",
    target: "40 N/mm²",
    strength: 42,
    correctionFactor: 1,
  });
  assert.deepEqual(copied.testRows, [{
    id: 1,
    length: "",
    width: "",
    height: "",
    dryWeight: "",
    wetWeight: "",
      weight: "",
    sampleAge: "",
    testAge: "",
    load: "",
    strength: "",
    airDryStrength: "",
    normalizedStrength: "",
      compressiveStrength: "",
      correctionFactor: "",
      correctedStrength: "",
    density: "",
    waterAbsorption: "",
    sieveSize: "",
    sieveSizeReferenceItemId: null,
    amountReturned: "",
    passingAmount: "",
    passingPercentage: "",
  }]);
});

test("applies paving correction factors by the size suffix", () => {
  assert.equal(pavingCorrectionFactorFromSize("200*100*60"), "0.87");
  assert.equal(pavingCorrectionFactorFromSize("200x100x80 mm"), "1");
  assert.equal(pavingCorrectionFactorFromSize("200*100*50"), "");
  assert.deepEqual(
    calculatePavingStrengths(
      {
        length: "200",
        width: "100",
        load: "",
        compressiveStrength: "42",
      },
      "0.87",
    ),
    { compressiveStrength: "42.00", correctedStrength: "36.54" },
  );
});

test("copies Water material details", () => {
  const source = baseRecord(TestType.Water, {
    ph: 7.2,
    tds: 350,
    chloride: 80,
    sulphate: 120,
    observation1: "Clear",
    observation2: "No visible sediment",
  });

  const copied = prepareRecordForForm(source);

  assert.deepEqual(copied.details, source.details);
});

test("does not share copied details or rows with the source record", () => {
  const source = baseRecord(TestType.Ready_Mix, {
    customerName: "Original customer",
    testRows: [{ rowNo: 1, testAge: 28, load: 500, length: 150, width: 150 }],
  });
  const originalDetails = structuredClone(source.details);

  const copied = prepareRecordForForm(source);
  copied.details.customerName = "Copied customer";
  copied.testRows[0].load = "600";

  assert.deepEqual(source.details, originalDetails);
  assert.equal("id" in copied, false);
});