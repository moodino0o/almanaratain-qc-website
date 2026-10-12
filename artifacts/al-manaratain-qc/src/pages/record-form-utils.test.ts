import assert from "node:assert/strict";
import test from "node:test";
import { RecordStatus, TestType, type QcRecord } from "@workspace/api-client-react";
import {
  applySizeDimensionDefaults,
  blockAirDryRowStrength,
  blockDimensionsFromSize,
  blockMaterialMatches,
  blockSizeMatches,
  blockTypeMatches,
  calculateBlockDensity,
  calculateCubeDensity,
  cubeWeightInGrams,
  integerIdentifierValue,
  calculateBlockStrengths,
  calculateDammamBlockResults,
  getDammamBlockHoleCount,
  getDammamBlockThicknessDefaults,
  isDammamBlockLocation,
  calculateCubeCompressiveStrength,
  averageCubeStrengthAtAge,
  precastAgeStrengthSummary,
  precastStrengthOutcome,
  calculateChlorideContent,
  calculateMoistureContent,
  calculateRetainedPercentage,
  calculateSiltContent,
  calculatePavingStrengths,
  calculateSulphateContent,
  pavingCorrectionFactorFromSize,
  calculateSieveSampleWeight,
  calculateSieveResults,
  sortSieveRowsByPoreSize,
  evaluateContentAgainstLimit,
  evaluateSiltContent,
  prepareRecordForForm,
  createDefaultTestRows,
  calculateKerbBendingStrength,
  kerbBendingFactorsForType,
  evaluateKerbWaterAbsorption,
  getReadyMixReferenceNumberError,
  filterSieveSizeItems,
  kerbDimensionsForType,
  sieveSizeNumber,
} from "./record-form-utils";
import {
  dammamBlockDisplayResults,
  summarizeDammamBlockAirDryStrengths,
  summarizeDammamBlockNetStrengths,
} from "./record-detail-utils";

test("defaults Ready Mix and Masonry entry rows to the requested ages and counts", () => {
  const readyMixRows = createDefaultTestRows(TestType.Ready_Mix);
  assert.equal(readyMixRows.length, 4);
  assert.deepEqual(readyMixRows.map((row) => row.testAge), ["7", "7", "28", "28"]);

  assert.equal(createDefaultTestRows(TestType.Blocks).length, 5);
  assert.equal(createDefaultTestRows(TestType.Paving_Blocks).length, 5);
  assert.equal(createDefaultTestRows(TestType.Kerb_Stone).length, 3);
  const precastRows = createDefaultTestRows(TestType.Precast);
  assert.equal(precastRows.length, 5);
  assert.deepEqual(precastRows.map((row) => row.testAge), ["1", "7", "7", "28", "28"]);
  assert.deepEqual(
    createDefaultTestRows(TestType.Ready_Mix, 10).map((row) => row.id),
    [10, 11, 12, 13],
  );
});

test("Kerbstone dimensions and bending strength use per-type section factors", () => {
  assert.deepEqual(kerbDimensionsForType("Road kerb"), {
    length: "915",
    width: "125",
    height: "225",
  });
  assert.deepEqual(kerbDimensionsForType("Edge kerb"), {
    length: "915",
    width: "50",
    height: "150",
  });
  assert.equal(kerbDimensionsForType("Unknown"), null);
  assert.deepEqual(kerbBendingFactorsForType("Road kerb"), {
    y: 60.3,
    secondMoment: 37_300_000,
  });
  assert.deepEqual(kerbBendingFactorsForType("Edge kerb"), {
    y: 25,
    secondMoment: 2_600_000,
  });
  assert.equal(
    calculateKerbBendingStrength("Road kerb", {
      failureLoad: "10",
      spanLength: "300",
    }),
    "1.21",
  );
  assert.equal(
    calculateKerbBendingStrength("Edge kerb", {
      failureLoad: "10",
      spanLength: "300",
    }),
    "7.21",
  );
  assert.equal(
    calculateKerbBendingStrength("Unknown", {
      failureLoad: "10",
      spanLength: "300",
    }),
    "",
  );
  assert.equal(
    calculateKerbBendingStrength("Edge kerb", {
      failureLoad: "",
      spanLength: "300",
    }),
    "",
  );
});

test("Kerbstone water absorption passes strictly below the editable limit and skips blank wet weights", () => {
  assert.deepEqual(evaluateKerbWaterAbsorption("100", "106.49", "6.5"), {
    value: "6.49",
    status: "Pass",
  });
  assert.deepEqual(evaluateKerbWaterAbsorption("100", "106.5", "6.5"), {
    value: "6.50",
    status: "Fail",
  });
  assert.deepEqual(evaluateKerbWaterAbsorption("1000", "1064.99", "6.5"), {
    value: "6.50",
    status: "Pass",
  });
  assert.equal(evaluateKerbWaterAbsorption("100", "", "6.5"), null);
  assert.deepEqual(evaluateKerbWaterAbsorption("", "106", "6.5"), {
    value: "",
    status: "Review",
  });
});

test("Dammam Block details display recalculated Net Area and Net Strength", () => {
  const row = {
    length: "400",
    width: "100",
    load: "297.9",
    faceThickness: "30",
    webThickness: "25",
    loadedFaceArea: "40000",
    netArea: "40000",
    airDryStrength: "7.45",
    netStrength: "7.45",
  };

  const result = dammamBlockDisplayResults(row, "400*100*200");

  assert.equal(result.netArea, 27_400);
  assert.ok(Math.abs((result.netStrength ?? 0) - 297_900 / 27_400) < 1e-10);
  assert.notEqual(result.netArea, Number(row.loadedFaceArea));
  assert.notEqual(result.netStrength, Number(row.airDryStrength));
});

test("Dammam Block minimum, average, and maximum use Net Strength", () => {
  const rows = [
    { length: "400", width: "100", load: "297.9", faceThickness: "30", webThickness: "25", airDryStrength: "7.45" },
    { length: "400", width: "100", load: "215.7", faceThickness: "30", webThickness: "25", airDryStrength: "5.39" },
    { length: "400", width: "100", load: "221.5", faceThickness: "30", webThickness: "25", airDryStrength: "5.54" },
  ];
  const strengths = rows.map((row) => dammamBlockDisplayResults(row, "400*100*200").netStrength!);
  const summary = summarizeDammamBlockNetStrengths(rows, "400*100*200");

  assert.equal(summary.minimum, Math.min(...strengths));
  assert.equal(summary.maximum, Math.max(...strengths));
  assert.equal(
    summary.average,
    strengths.reduce((total, strength) => total + strength, 0) / strengths.length,
  );
  assert.ok((summary.average ?? 0) > 6.51);
});

test("calculates Precast cube compressive strength and averages specimens by age", () => {
  assert.equal(
    calculateCubeCompressiveStrength({
      length: "100",
      width: "100",
      load: "250",
    }),
    "25.00",
  );
  assert.equal(
    calculateCubeCompressiveStrength({ length: "", width: "100", load: "250" }),
    "",
  );
  assert.equal(
    averageCubeStrengthAtAge(
      [
        { testAge: "7", length: "100", width: "100", load: "250" },
        { testAge: "7", calculatedStrength: "30" },
        { testAge: "28", calculatedStrength: "40" },
      ],
      7,
    ),
    27.5,
  );
});

test("Ready Mix references require an S. or H. prefix followed by a number", () => {
  for (const value of ["S.123", "H. 456", "s.78A"]) {
    assert.equal(getReadyMixReferenceNumberError(value), null);
  }
  assert.equal(
    getReadyMixReferenceNumberError("PO-1042"),
    "Reference Number must start with S. or H. followed by a number.",
  );
  assert.equal(
    getReadyMixReferenceNumberError("S."),
    "Reference Number must start with S. or H. followed by a number.",
  );
  assert.equal(
    getReadyMixReferenceNumberError(""),
    "Reference Number is required.",
  );
});

test("sorts sieve pore sizes from largest to smallest without reordering ties", () => {
  const rows = [
    { sieveSize: "0.075 mm", row: "fine" },
    { sieveSize: "4.75 mm", row: "coarse" },
    { sieveSize: "2.36 mm", row: "middle first" },
    { sieveSize: "2.36 mm", row: "middle second" },
  ];

  assert.deepEqual(
    sortSieveRowsByPoreSize(rows, (row) => row.sieveSize).map((row) => row.row),
    ["coarse", "middle first", "middle second", "fine"],
  );
});

test("filters sieve form pore sizes by sand, dust, and aggregate material", () => {
  const items = [
    "20 mm",
    "14 mm",
    "10 mm",
    "6.3 mm",
    "5 mm",
    "2.36 mm",
    "1.18 mm",
    "0.6 mm",
    "0.3 mm",
    "0.15 mm",
    "0.075 mm",
    "0 mm",
    "0.063 mm",
  ].map((value, index) => ({ id: index + 1, value }));
  const valuesFor = (testType: string, material: string) =>
    filterSieveSizeItems(items, testType, material)
      .sort((left, right) => sieveSizeNumber(right.value) - sieveSizeNumber(left.value))
      .map((item) => item.value);

  assert.deepEqual(valuesFor("Sand Sieve", "Sand"), [
    "5 mm",
    "2.36 mm",
    "1.18 mm",
    "0.6 mm",
    "0.3 mm",
    "0.15 mm",
    "0.075 mm",
    "0 mm",
  ]);
  assert.deepEqual(valuesFor("Sand Sieve", "Dust"), [
    "10 mm",
    "5 mm",
    "2.36 mm",
    "1.18 mm",
    "0.6 mm",
    "0.3 mm",
    "0.15 mm",
    "0.075 mm",
    "0 mm",
  ]);
  const coarseAggregateSizes = [
    "20 mm",
    "14 mm",
    "10 mm",
    "6.3 mm",
    "5 mm",
    "2.36 mm",
    "0 mm",
  ];
  assert.deepEqual(valuesFor("Aggregate Sieve", "10 mm Aggregate"), coarseAggregateSizes);
  assert.deepEqual(valuesFor("Aggregate Sieve", "20 mm Aggregate"), coarseAggregateSizes);
  assert.deepEqual(valuesFor("Aggregate Sieve", "2-5 mm Aggregate"), [
    "5 mm",
    "2.36 mm",
    "1.18 mm",
    "0.6 mm",
    "0.3 mm",
    "0.15 mm",
    "0.075 mm",
    "0 mm",
  ]);
});

test("calculates aggregate moisture content from dry and wet sample weights", () => {
  assert.equal(calculateMoistureContent("100", "112.5"), "12.50");
  assert.equal(calculateMoistureContent("0", "112.5"), "");
  assert.equal(calculateMoistureContent("", "112.5"), "");
});

test("calculates silt content and applies the strict less-than-three-percent limit", () => {
  const siltContent = calculateSiltContent("100", "97");
  assert.equal(siltContent, 3);
  assert.equal(calculateSiltContent("100", "98")?.toFixed(2), "2.00");
  assert.equal(calculateSiltContent("0", "0"), null);
  assert.equal(evaluateSiltContent(2.999), "Pass");
  assert.equal(evaluateSiltContent(siltContent), "Fail");
  assert.equal(evaluateSiltContent(null), "Pending");
});

test("calculates aggregate chloride and sulphate content from the supplied equations", () => {
  assert.equal(calculateChlorideContent("25", "1.2", "2.4")?.toFixed(2), "1.69");
  assert.equal(calculateChlorideContent("25", "", "2.4"), null);
  assert.equal(calculateSulphateContent("10", "10.25")?.toFixed(2), "2.86");
  assert.equal(calculateSulphateContent("10", ""), null);
});

test("calculates retained percentage against the total sieve sample weight", () => {
  assert.equal(calculateRetainedPercentage("25", "100"), "25.00");
  assert.equal(calculateRetainedPercentage("100.01", "100"), "");
  assert.equal(calculateRetainedPercentage("25", "0"), "");
});

test("fails aggregate chemistry only when content exceeds its standard", () => {
  assert.equal(evaluateContentAgainstLimit(0.06, 0.06), "Pass");
  assert.equal(evaluateContentAgainstLimit(0.060001, 0.06), "Fail");
  assert.equal(evaluateContentAgainstLimit(0.4, 0.4), "Pass");
  assert.equal(evaluateContentAgainstLimit(0.400001, 0.4), "Fail");
  assert.equal(evaluateContentAgainstLimit(null, 0.06), "Pending");
});

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

test("uses selected block sizes as editable dimension defaults", () => {
  const previousSize = blockDimensionsFromSize("200*100*60");
  const nextSize = blockDimensionsFromSize("200*100*80");
  assert.ok(previousSize);
  assert.ok(nextSize);

  const defaultedRow = applySizeDimensionDefaults(
    { id: 1, length: "", width: "", height: "" },
    previousSize,
    null,
  );
  assert.deepEqual(
    { length: defaultedRow.length, width: defaultedRow.width, height: defaultedRow.height },
    previousSize,
  );

  const resizedRow = applySizeDimensionDefaults(defaultedRow, nextSize, previousSize);
  assert.deepEqual(
    { length: resizedRow.length, width: resizedRow.width, height: resizedRow.height },
    nextSize,
  );

  const manuallyEditedRow = applySizeDimensionDefaults(
    { ...defaultedRow, length: "210" },
    nextSize,
    previousSize,
  );
  assert.deepEqual(
    {
      length: manuallyEditedRow.length,
      width: manuallyEditedRow.width,
      height: manuallyEditedRow.height,
    },
    { length: "210", width: "100", height: "60" },
  );
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

test("calculates Precast density from cube weight and applies age thresholds", () => {
  assert.equal(calculateCubeDensity("100*100*100", "2400"), "2400.00");
  assert.equal(calculateCubeDensity("100*100*100", "2.4", "kg"), "2400.00");
  assert.equal(calculateCubeDensity("200*100*100", "4000"), "2000.00");
  assert.equal(cubeWeightInGrams("2.4", "kg"), "2400");
  assert.equal(calculateCubeDensity("invalid", "2.4"), "");

  const summary = precastAgeStrengthSummary(
    [
      { testAge: "7", length: "100", width: "100", load: "520" },
      { testAge: "7", length: "100", width: "100", load: "" },
    ],
    7,
  );
  assert.equal(summary.averageStrength, 52);
  assert.equal(summary.complete, false);
  assert.equal(precastStrengthOutcome(1, 30), "Approved for demolding");
  assert.equal(precastStrengthOutcome(7, 52), "Pass");
  assert.equal(precastStrengthOutcome(28, 65), "Pass");
  assert.equal(precastStrengthOutcome(7, 52, false), "Pending");
  assert.equal(precastStrengthOutcome(28, 64), "Fail");
});

test("keeps Precast sample and mould numbers whole and converts legacy weights to grams", () => {
  assert.equal(integerIdentifierValue("0042"), "0042");
  assert.equal(integerIdentifierValue(42), "42");
  assert.equal(integerIdentifierValue("42.5"), "");

  const source = baseRecord(TestType.Precast, {
    sampleNo: "0042",
    precastMouldNo: "0017",
    cubeSize: "100*100*100",
    testRows: [
      {
        testAge: 1,
        length: 100,
        width: 100,
        height: 100,
        load: 300,
        weight: 2.4,
      },
    ],
  });

  const copied = prepareRecordForForm(source);

  assert.equal(copied.details.sampleNo, "0042");
  assert.equal(copied.details.precastMouldNo, "0017");
  assert.equal(copied.details.cubeWeightUnit, "g");
  assert.equal(copied.testRows[0].weight, "2400");
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

test("uses the Dammam Block compliance basis in the form preview", () => {
  assert.deepEqual(
    calculateBlockStrengths(
      { length: "400", width: "100", load: "109.1" },
      "1.35",
      "Dammam",
    ),
    {
      waterStrength: "2.73",
      airDryStrength: "2.7",
      normalizedStrength: "3.6",
    },
  );
});

test("calculates Dammam Block gross and net results from saved inputs", () => {
  assert.equal(isDammamBlockLocation("Dammam"), true);
  assert.equal(isDammamBlockLocation("Dammam Plant"), true);
  assert.equal(isDammamBlockLocation("Hidd"), false);
  assert.equal(getDammamBlockHoleCount('4"'), 2);
  assert.equal(getDammamBlockHoleCount('6"'), 2);
  assert.equal(getDammamBlockHoleCount('8"'), 3);
  assert.equal(getDammamBlockHoleCount('12"'), null);
  assert.deepEqual(getDammamBlockThicknessDefaults("400*200*200"), {
    faceThickness: "30",
    webThickness: "30",
  });
  assert.deepEqual(getDammamBlockThicknessDefaults("400*150*200"), {
    faceThickness: "30",
    webThickness: "25",
  });
  assert.deepEqual(getDammamBlockThicknessDefaults("400*100*200"), {
    faceThickness: "30",
    webThickness: "25",
  });

  const eightInch = calculateDammamBlockResults(
    { length: "400", width: "200", load: "1500" },
    '8"',
    "30",
    "30",
  );
  assert.ok(eightInch);
  assert.equal(eightInch.numberOfHoles, 3);
  assert.equal(eightInch.failureLoadN, 1_500_000);
  assert.equal(eightInch.grossArea, 80_000);
  assert.equal(eightInch.netArea, 40_800);
  assert.equal(eightInch.grossStrength, 18.75);
  assert.ok(Math.abs(eightInch.netStrength - 1_500_000 / 40_800) < 1e-10);

  const sixInch = calculateDammamBlockResults(
    { length: "400", width: "150", load: "1000" },
    '6"',
    "30",
    "30",
  );
  assert.equal(sixInch?.netArea, 32_100);
  assert.equal(sixInch?.grossStrength, 1000 / 60);
  assert.equal(
    calculateDammamBlockResults(
      { length: "400", width: "200", load: "0" },
      '8"',
      "30",
      "30",
    ),
    null,
  );
});

test("uses Gross Area and Air-dry strength for Dammam Sandwich Blocks", () => {
  assert.deepEqual(
    calculateBlockStrengths(
      { length: "400", width: "200", load: "1500" },
      "1.1",
      "Dammam Plant",
      "Sandwich Insulation Block",
    ),
    {
      waterStrength: "15.63",
      airDryStrength: "18.8",
      normalizedStrength: "20.7",
    },
  );

  const displayed = dammamBlockDisplayResults(
    { length: 400, width: 300, load: 1500 },
    '12"',
    { blockType: "XL Sandwich Block", shapeFactor: "1.1" },
  );
  assert.equal(displayed.airDryStrength, 12.5);
  assert.equal(displayed.normalizedStrength, 13.8);

  const sandwichGeometry = calculateDammamBlockResults(
    { length: "400", width: "300", load: "1500" },
    '12"',
    "",
    "",
    "XL Sandwich Block",
  );
  assert.equal(sandwichGeometry?.grossArea, 120_000);
  assert.equal(sandwichGeometry?.grossStrength, 12.5);
  assert.equal(sandwichGeometry?.netArea, null);
  assert.equal(sandwichGeometry?.netStrength, null);

  const rows = [
    { length: 400, width: 200, load: 1200 },
    { length: 400, width: 200, load: 1500 },
  ];
  assert.deepEqual(
    summarizeDammamBlockAirDryStrengths(rows, "400*200*200", {
      blockType: "Sandwich Insulation Block",
    }),
    { average: 16.9, minimum: 15, maximum: 18.8 },
  );
});

test("uses air-dry strength in Block specimen details, with the Dammam exception", () => {
  assert.equal(
    blockAirDryRowStrength(
      { calculatedStrength: "6.46", airDryStrength: "7.8" },
      "HIDD",
    ),
    7.8,
  );
  assert.equal(
    blockAirDryRowStrength({ calculatedStrength: "6.46" }, "Eastern"),
    7.8,
  );
  assert.equal(
    blockAirDryRowStrength({ calculatedStrength: "6.46" }, "Dammam"),
    null,
  );
  assert.equal(
    blockAirDryRowStrength({ calculatedStrength: "6.46", airDryStrength: "7.8", netStrength: "8.2" }, "Dammam Plant"),
    8.2,
  );
  assert.equal(blockAirDryRowStrength({}, "HIDD"), null);
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
    tensileStrength: "",
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
    tensileStrength: "10",
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
      tensileStrength: "",
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
  assert.equal(copied.testRows.length, 5);
  assert.deepEqual(copied.testRows.map((row) => row.id), [1, 2, 3, 4, 5]);
  assert.ok(copied.testRows.every((row) => row.load === ""));
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
        height: "60",
        load: "60.79",
      },
      "0.87",
    ),
    { tensileStrength: "2.81", correctedStrength: "2.81" },
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