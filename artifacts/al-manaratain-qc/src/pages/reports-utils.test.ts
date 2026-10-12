import assert from "node:assert/strict";
import test from "node:test";
import type { DailyReadyMixResult, QcRecord } from "@workspace/api-client-react";
import {
  buildDailyReportRows,
  buildDailyStrengthRows,
  dailyReportProductOptions,
  downloadDailyReportWorkbook,
  firstWords,
  groupDailyResults,
  sortByReferenceNumber,
  summarizeRecordStrengths,
} from "./reports-utils";

const record = ({
  id,
  mixDesign,
  location,
  sevenDay,
  twentyEightDay,
  sevenDayMinimum = sevenDay,
  sevenDayMaximum = sevenDay,
  twentyEightDayMinimum = twentyEightDay,
  twentyEightDayMaximum = twentyEightDay,
}: {
  id: number;
  mixDesign: string;
  location: string;
  sevenDay: number | null;
  twentyEightDay: number | null;
  sevenDayMinimum?: number | null;
  sevenDayMaximum?: number | null;
  twentyEightDayMinimum?: number | null;
  twentyEightDayMaximum?: number | null;
}): DailyReadyMixResult => ({
  recordId: id,
  recordNo: `RM-${id}`,
  sampleDate: "2026-08-30",
  location,
  mixDesign,
  referenceNumber: `S-${id}`,
  referenceType: "site",
  cubeAge: 7,
  strengths: [],
  averageStrength: twentyEightDay,
  minimumStrength: twentyEightDay,
  maximumStrength: twentyEightDay,
  sevenDay: {
    averageStrength: sevenDay,
    minimumStrength: sevenDayMinimum,
    maximumStrength: sevenDayMaximum,
  },
  twentyEightDay: {
    averageStrength: twentyEightDay,
    minimumStrength: twentyEightDayMinimum,
    maximumStrength: twentyEightDayMaximum,
  },
  strengthUnit: "N/mm²",
});

test("groups all mixes with each plant nested under its mix design", () => {
  const grouped = groupDailyResults([
    record({ id: 1, mixDesign: "25 N OPC", location: "HIDD", sevenDay: 30, twentyEightDay: null }),
    record({
      id: 2,
      mixDesign: "20 N OPC",
      location: "MASA",
      sevenDay: null,
      twentyEightDay: 54,
      twentyEightDayMinimum: 53,
      twentyEightDayMaximum: 55,
    }),
    record({
      id: 3,
      mixDesign: "20 N OPC",
      location: "HIDD",
      sevenDay: 40,
      sevenDayMinimum: 39,
      sevenDayMaximum: 41,
      twentyEightDay: 50,
      twentyEightDayMinimum: 49,
      twentyEightDayMaximum: 51,
    }),
    record({
      id: 4,
      mixDesign: "20 N OPC",
      location: "HIDD",
      sevenDay: 42,
      sevenDayMinimum: 40,
      sevenDayMaximum: 44,
      twentyEightDay: 52,
      twentyEightDayMinimum: 51,
      twentyEightDayMaximum: 53,
    }),
  ]);

  assert.deepEqual(grouped.map((mix) => mix.mixDesign), ["20 N OPC", "25 N OPC"]);
  assert.equal(grouped[0].recordCount, 3);
  assert.deepEqual(grouped[0].locations.map((location) => location.location), ["HIDD", "MASA"]);
  assert.deepEqual(grouped[0].sevenDay, {
    averageStrength: 41,
    minimumStrength: 39,
    maximumStrength: 44,
  });
  assert.deepEqual(grouped[0].twentyEightDay, {
    averageStrength: 52,
    minimumStrength: 49,
    maximumStrength: 55,
  });
  assert.deepEqual(grouped[0].locations[0].sevenDay, {
    averageStrength: 41,
    minimumStrength: 39,
    maximumStrength: 44,
  });
  assert.deepEqual(grouped[0].locations[1].sevenDay, {
    averageStrength: null,
    minimumStrength: null,
    maximumStrength: null,
  });
  assert.deepEqual(grouped[1].twentyEightDay, {
    averageStrength: null,
    minimumStrength: null,
    maximumStrength: null,
  });
});

test("keeps a single-mix filter in the same nested hierarchy", () => {
  const selectedMix = [
    record({ id: 1, mixDesign: "20 N OPC", location: "MASA", sevenDay: 38, twentyEightDay: 48 }),
    record({ id: 2, mixDesign: "20 N OPC", location: "HIDD", sevenDay: 40, twentyEightDay: 50 }),
  ];

  const grouped = groupDailyResults(selectedMix);

  assert.equal(grouped.length, 1);
  assert.equal(grouped[0].mixDesign, "20 N OPC");
  assert.deepEqual(grouped[0].locations.map((location) => location.location), ["HIDD", "MASA"]);
  assert.equal(grouped[0].locations.reduce((count, location) => count + location.recordCount, 0), 2);
});

test("returns no hierarchy for an empty result set", () => {
  assert.deepEqual(groupDailyResults([]), []);
});

test("sorts Ready Mix references by H number, then S number", () => {
  const entries = [
    { referenceNumber: "S.253" },
    { referenceNumber: "H.10" },
    { referenceNumber: "S.2" },
    { referenceNumber: "H.2" },
    { referenceNumber: "H.1" },
  ];

  assert.deepEqual(
    sortByReferenceNumber(entries, (entry) => entry.referenceNumber)
      .map((entry) => entry.referenceNumber),
    ["H.1", "H.2", "H.10", "S.2", "S.253"],
  );
});

test("builds one daily strength row per mix, plant, and cube age", () => {
  const rows = buildDailyStrengthRows([
    {
      ...record({ id: 1, mixDesign: "25 N OPC", location: "HIDD", sevenDay: 30, twentyEightDay: null }),
      cubeAge: 28,
      strengths: [48, 52],
    },
    {
      ...record({ id: 2, mixDesign: "20 N OPC", location: "MASA", sevenDay: null, twentyEightDay: 54 }),
      cubeAge: 28,
      strengths: [53, 55],
    },
    {
      ...record({ id: 3, mixDesign: "20 N OPC", location: "MASA", sevenDay: 38, twentyEightDay: null }),
      cubeAge: 7,
      strengths: [37, 39],
    },
  ]);

  assert.deepEqual(
    rows.map(({ mixDesign, plant, cubeAge }) => ({ mixDesign, plant, cubeAge })),
    [
      { mixDesign: "20 N OPC", plant: "MASA", cubeAge: 7 },
      { mixDesign: "20 N OPC", plant: "MASA", cubeAge: 28 },
      { mixDesign: "25 N OPC", plant: "HIDD", cubeAge: 28 },
    ],
  );
  assert.deepEqual(rows[0], {
    mixDesign: "20 N OPC",
    plant: "MASA",
    cubeAge: 7,
    averageStrength: 38,
    minimumStrength: 37,
    maximumStrength: 39,
    strengthUnit: "N/mm²",
  });
});

const qcRecord = ({
  id,
  testType,
  sampleDate,
  location,
  material,
  details,
}: {
  id: number;
  testType: QcRecord["testType"];
  sampleDate: string;
  location: string;
  material: string;
  details: Record<string, unknown>;
}): QcRecord => ({
  id,
  recordNo: `QC-${id}`,
  testType,
  sampleDate,
  location,
  material,
  status: "Passed",
  testedBy: "Tester",
  details,
});

test("summarizes Masonry records using their existing strength calculation basis", () => {
  const blockRecord = qcRecord({
    id: 90,
    testType: "Blocks",
    sampleDate: "2026-09-01",
    location: "Eastern",
    material: "Concrete Block",
    details: {
      testRows: [
        { load: 500, calculatedStrength: 40, airDryStrength: 48 },
        { load: 600, calculatedStrength: 50, airDryStrength: 60 },
      ],
    },
  });
  const pavingRecord = qcRecord({
    id: 91,
    testType: "Paving Blocks",
    sampleDate: "2026-09-01",
    location: "Eastern",
    material: "Paving Block",
    details: {
      testRows: [
        { load: 500, tensileStrength: 4, correctedStrength: 4.5 },
        { load: 600, tensileStrength: 6, correctedStrength: 6.5 },
      ],
    },
  });

  assert.deepEqual(summarizeRecordStrengths(blockRecord), {
    averageStrength: 54,
    minimumStrength: 48,
    maximumStrength: 60,
  });
  assert.deepEqual(summarizeRecordStrengths(pavingRecord), {
    averageStrength: 5,
    minimumStrength: 4,
    maximumStrength: 6,
  });
});

test("daily report summaries ignore Ready Mix and Masonry rows without load", () => {
  const readyMix = qcRecord({
    id: 92,
    testType: "Ready Mix",
    sampleDate: "2026-09-01",
    location: "Plant A",
    material: "25 N OPC",
    details: {
      designStrength: "25 N OPC",
      testRows: [
        { testAge: 7, load: "", calculatedStrength: 99 },
        { testAge: 7, load: 500, calculatedStrength: 30 },
      ],
    },
  });
  const blocks = qcRecord({
    id: 93,
    testType: "Blocks",
    sampleDate: "2026-09-01",
    location: "Plant B",
    material: "Concrete Block",
    details: {
      blockType: "Hollow Concrete Block",
      blockAge: 7,
      testRows: [
        { load: "", airDryStrength: 99 },
        { load: 800, airDryStrength: 12 },
      ],
    },
  });

  assert.deepEqual(summarizeRecordStrengths(readyMix), {
    averageStrength: 30,
    minimumStrength: 30,
    maximumStrength: 30,
  });
  assert.deepEqual(summarizeRecordStrengths(blocks), {
    averageStrength: 12,
    minimumStrength: 12,
    maximumStrength: 12,
  });
  assert.deepEqual(
    buildDailyReportRows([readyMix, blocks], "2026-09-08", "2026-09-08")
      .map(({ category, averageStrength }) => ({ category, averageStrength })),
    [
      { category: "Blocks", averageStrength: 12 },
      { category: "Ready Mix", averageStrength: 30 },
    ],
  );
});

test("groups Ready Mix products by their first three words and summarizes each day", () => {
  const records = [
    qcRecord({
      id: 10,
      testType: "Ready Mix",
      sampleDate: "2026-09-01",
      location: "Plant A",
      material: "OPC",
      details: {
        designStrength: "25 N OPC 20mm",
        testRows: [
          { testAge: 28, load: 500, calculatedStrength: 40 },
          { testAge: 28, load: 600, calculatedStrength: 44 },
        ],
      },
    }),
    qcRecord({
      id: 11,
      testType: "Ready Mix",
      sampleDate: "2026-09-01",
      location: "Plant A",
      material: "OPC",
      details: {
        designStrength: "25 N OPC 10mm",
        testRows: [{ testAge: 28, load: 550, calculatedStrength: 42 }],
      },
    }),
  ];

  assert.equal(firstWords("25 N OPC 20mm", 3), "25 N OPC");
  assert.deepEqual(dailyReportProductOptions(records), [
    { key: "Ready Mix\u000025 N OPC", category: "Ready Mix", product: "25 N OPC" },
  ]);
  assert.deepEqual(
    buildDailyReportRows(records, "2026-09-29", "2026-09-29"),
    [{
      date: "2026-09-29",
      castingDate: "2026-09-01",
      testingDate: "2026-09-29",
      category: "Ready Mix",
      plant: "Plant A",
      machineType: "",
      product: "25 N OPC",
      cubeAge: 28,
      averageStrength: 42,
      minimumStrength: 40,
      maximumStrength: 44,
      standardDeviation: Math.sqrt(8 / 3),
      strengthUnit: "N/mm²",
    }],
  );
});

test("daily Ready Mix results use calculated strength instead of air-dry strength", () => {
  const rows = buildDailyReportRows(
    [
      qcRecord({
        id: 28,
        testType: "Ready Mix",
        sampleDate: "2026-08-01",
        location: "Eastern",
        material: "45 N OPC Ice",
        details: {
          designStrength: "45 N OPC Ice",
          testRows: [
            { testAge: "", calculatedStrength: null, airDryStrength: null },
            { testAge: "28", load: "500", calculatedStrength: "54.96", strength: "54.96", airDryStrength: "66" },
            { testAge: "28", load: "600", calculatedStrength: "57.22", strength: "57.22", airDryStrength: "68.7" },
          ],
        },
      }),
    ],
    "2026-08-29",
    "2026-08-29",
  );

  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.averageStrength, 56.09);
  assert.equal(rows[0]?.minimumStrength, 54.96);
  assert.equal(rows[0]?.maximumStrength, 57.22);
});

test("daily Ready Mix results filter Site S and Plant H references or include all by default", () => {
  const records = [
    qcRecord({
      id: 51,
      testType: "Ready Mix",
      sampleDate: "2026-09-01",
      location: "Plant A",
      material: "OPC",
      details: {
        referenceNumber: "S-1",
        designStrength: "25 N OPC 20mm",
        testRows: [
          { testAge: 7, load: 500, calculatedStrength: 40 },
          { testAge: 7, load: 600, calculatedStrength: 44 },
        ],
      },
    }),
    qcRecord({
      id: 52,
      testType: "Ready Mix",
      sampleDate: "2026-09-01",
      location: "Plant A",
      material: "OPC",
      details: {
        referenceNumber: "s-2",
        designStrength: "25 N OPC 20mm",
        testRows: [{ testAge: 7, load: 550, calculatedStrength: 50 }],
      },
    }),
    qcRecord({
      id: 53,
      testType: "Ready Mix",
      sampleDate: "2026-09-01",
      location: "Plant A",
      material: "OPC",
      details: {
        referenceNumber: "H-1",
        designStrength: "25 N OPC 20mm",
        testRows: [{ testAge: 7, load: 500, calculatedStrength: 60 }],
      },
    }),
    qcRecord({
      id: 54,
      testType: "Ready Mix",
      sampleDate: "2026-09-01",
      location: "Plant A",
      material: "OPC",
      details: {
        referenceNumber: "H-2",
        designStrength: "25 N OPC 20mm",
        testRows: [{ testAge: 7, load: 600, calculatedStrength: 64 }],
      },
    }),
    qcRecord({
      id: 55,
      testType: "Ready Mix",
      sampleDate: "2026-09-01",
      location: "Plant A",
      material: "OPC",
      details: {
        referenceNumber: "X-1",
        designStrength: "25 N OPC 20mm",
        testRows: [{ testAge: 7, load: 700, calculatedStrength: 100 }],
      },
    }),
  ];
  const summarize = (referenceFilter?: "site" | "plant") => {
    const [row] = buildDailyReportRows(
      records,
      "2026-09-08",
      "2026-09-08",
      [],
      referenceFilter ?? null,
    );
    return row && {
      average: row.averageStrength,
      minimum: row.minimumStrength,
      maximum: row.maximumStrength,
    };
  };

  assert.deepEqual(summarize("site"), {
    average: 134 / 3,
    minimum: 40,
    maximum: 50,
  });
  assert.deepEqual(summarize("plant"), {
    average: 62,
    minimum: 60,
    maximum: 64,
  });
  assert.deepEqual(summarize(), {
    average: 358 / 6,
    minimum: 40,
    maximum: 100,
  });
});

test("includes non-Ready Mix categories, date ranges, and selected product groups", () => {
  const records = [
    qcRecord({
      id: 12,
      testType: "Blocks",
      sampleDate: "2026-09-10",
      location: "Plant B",
      material: "4 inch Block",
      details: {
        blockType: "Hollow Concrete Block",
        machine: "MASA FRIMA 1",
        blockAge: "28",
        testRows: [{ load: 800, calculatedStrength: 8 }, { load: 1000, calculatedStrength: 10 }],
      },
    }),
    qcRecord({
      id: 13,
      testType: "Water",
      sampleDate: "2026-09-11",
      location: "Plant C",
      material: "Water",
      details: { strength: 5 },
    }),
  ];

  assert.deepEqual(
    buildDailyReportRows(records, "2026-10-08", "2026-10-08", ["Blocks\u0000Hollow Concrete Block"]),
    [{
      date: "2026-10-08",
      castingDate: "2026-09-10",
      testingDate: "2026-10-08",
      category: "Blocks",
      plant: "Plant B",
      machineType: "MASA FRIMA 1",
      product: "Hollow Concrete Block",
      cubeAge: 28,
      averageStrength: 10.8,
      minimumStrength: 9.6,
      maximumStrength: 12,
      standardDeviation: Math.sqrt(((9.6 - 10.8) ** 2 + (12 - 10.8) ** 2) / 2),
      strengthUnit: "N/mm²",
    }],
  );
});

test("daily results show full Block and Paving product names and machine types", () => {
  const rows = buildDailyReportRows(
    [
      qcRecord({
        id: 110,
        testType: "Blocks",
        sampleDate: "2026-09-01",
        location: "Plant B",
        material: "Concrete Block",
        details: {
          blockType: "Hollow Concrete Block",
          blockAge: 28,
          machine: "MASA FRIMA 1",
          testRows: [{ load: 800, airDryStrength: 12 }],
        },
      }),
      qcRecord({
        id: 111,
        testType: "Paving Blocks",
        sampleDate: "2026-09-01",
        location: "Plant C",
        material: "Paving Block Premium Grey 80mm",
        details: {
          blockAge: 28,
          machine: "MASA FRIMA 2",
          testRows: [{ load: 600, tensileStrength: 8 }],
        },
      }),
    ],
    "2026-09-29",
    "2026-09-29",
  );

  assert.deepEqual(
    rows.map(({ category, machineType, product }) => ({ category, machineType, product })),
    [
      {
        category: "Blocks",
        machineType: "MASA FRIMA 1",
        product: "Hollow Concrete Block",
      },
      {
        category: "Paving Blocks",
        machineType: "MASA FRIMA 2",
        product: "Paving Block Premium Grey 80mm",
      },
    ],
  );
});

test("Block daily report uses Dammam net strength and other plants' air-dry strength", () => {
  const rows = buildDailyReportRows(
    [
      qcRecord({
        id: 40,
        testType: "Blocks",
        sampleDate: "2026-09-10",
        location: "Plant A",
        material: "4 inch Block",
        details: {
          blockType: "Hollow Concrete Block",
          blockAge: 28,
          testRows: [
            { load: 500, waterStrength: 8, calculatedStrength: 8, airDryStrength: "", dryAirStrength: 12 },
            { load: 600, waterStrength: 10, calculatedStrength: 10, airDryStrength: 14 },
          ],
        },
      }),
      qcRecord({
        id: 41,
        testType: "Blocks",
        sampleDate: "2026-09-10",
        location: "Dammam",
        material: "4 inch Block",
        details: {
          blockType: "Hollow Concrete Block",
          blockAge: 28,
          testRows: [
            { load: 500, waterStrength: "", calculatedStrength: 8, airDryStrength: 9.6, netStrength: 18 },
            { load: 600, waterStrength: 10, calculatedStrength: 10, airDryStrength: 12, netStrength: 22 },
          ],
        },
      }),
    ],
    "2026-10-08",
    "2026-10-08",
  );

  const plantA = rows.find((row) => row.plant === "Plant A");
  const dammam = rows.find((row) => row.plant === "Dammam");
  assert.equal(plantA?.minimumStrength, 12);
  assert.equal(plantA?.maximumStrength, 14);
  assert.equal(dammam?.averageStrength, 20);
  assert.equal(dammam?.minimumStrength, 18);
  assert.equal(dammam?.maximumStrength, 22);
});

test("Dammam register and daily summaries recalculate net strength using record thickness defaults", () => {
  const dammam = qcRecord({
    id: 80,
    testType: "Blocks",
    sampleDate: "2026-09-10",
    location: "Dammam Plant",
    details: {
      blockSize: '4"',
      blockAge: 28,
      faceThickness: "20",
      webThickness: "20",
      averageStrength: 88,
      strengthEvaluation: { averageStrength: 88 },
      testRows: [
        { load: 200, airDryStrength: 88, netStrength: 99 },
        { load: 300, airDryStrength: 88, netStrength: 99 },
      ],
    },
  });
  const expected = [200_000 / 19_600, 300_000 / 19_600];
  const summary = summarizeRecordStrengths(dammam)!;
  assert.equal(summary.minimumStrength, expected[0]);
  assert.equal(summary.maximumStrength, expected[1]);
  assert.equal(summary.averageStrength, (expected[0] + expected[1]) / 2);
  const daily = buildDailyReportRows([dammam], "2026-10-08", "2026-10-08")[0];
  assert.equal(daily.averageStrength, summary.averageStrength);
  assert.equal(daily.minimumStrength, summary.minimumStrength);
  assert.equal(daily.maximumStrength, summary.maximumStrength);
  assert.equal(daily.standardDeviation, (expected[1] - expected[0]) / 2);
  const legacyFailureLoad = {
    ...dammam,
    details: { ...dammam.details, testRows: [{ failureLoad: 200 }] },
  };
  assert.equal(summarizeRecordStrengths(legacyFailureLoad)?.averageStrength, expected[0]);
});

test("Dammam Sandwich register and daily summaries use gross-area Air-dry strength", () => {
  const sandwich = qcRecord({
    id: 82,
    testType: "Blocks",
    sampleDate: "2026-09-10",
    location: "Dammam Plant",
    details: {
      blockType: "8 inch Sandwich Block",
      blockSize: "400 x 200 x 200",
      blockAge: 28,
      testRows: [
        { length: 400, width: 200, load: 1200, netStrength: 99 },
        { length: 400, width: 200, load: 1500, netStrength: 99 },
      ],
    },
  });

  const summary = summarizeRecordStrengths(sandwich)!;
  assert.equal(summary.minimumStrength, 15);
  assert.equal(summary.maximumStrength, 18.8);
  assert.equal(summary.averageStrength, 16.9);

  const daily = buildDailyReportRows([sandwich], "2026-10-08", "2026-10-08")[0];
  assert.equal(daily.averageStrength, summary.averageStrength);
  assert.equal(daily.minimumStrength, summary.minimumStrength);
  assert.equal(daily.maximumStrength, summary.maximumStrength);
});

test("Dammam never substitutes a generic, gross or air-dry average for missing net results", () => {
  const dammam = qcRecord({
    id: 81,
    testType: "Blocks",
    material: "Concrete Block",
    sampleDate: "2026-09-10",
    location: "Dammam",
    details: {
      blockAge: 28,
      averageStrength: 88,
      calculatedStrength: 44,
      airDryStrength: 88,
      strengthEvaluation: { averageStrength: 88 },
    },
  });
  assert.equal(summarizeRecordStrengths(dammam), null);
  assert.equal(buildDailyReportRows([dammam], "2026-10-08", "2026-10-08").length, 0);
  assert.equal(summarizeRecordStrengths({
    ...dammam, details: { ...dammam.details, averageNetStrength: 7 },
  })?.averageStrength, 7);
  assert.equal(summarizeRecordStrengths({
    ...dammam, details: { ...dammam.details, testRows: [{ load: "", airDryStrength: 88, netStrength: 7 }] },
  }), null);
});

test("uses the Block age-derived testing date instead of the entered legacy date", () => {
  const rows = buildDailyReportRows(
    [
      qcRecord({
        id: 17,
        testType: "Blocks",
        sampleDate: "2026-09-01",
        location: "Plant A",
        material: "4 inch Block",
        details: {
          blockType: "Hollow Concrete Block",
          blockAge: 28,
          testingDate: "2026-10-02",
          testRows: [{ load: 800, calculatedStrength: 10 }],
        },
      }),
    ],
    "2026-09-29",
    "2026-09-29",
  );

  assert.equal(rows[0]?.date, "2026-09-29");
  assert.equal(rows[0]?.castingDate, "2026-09-01");
  assert.equal(rows[0]?.testingDate, "2026-09-29");
});

test("derives Sand, Aggregate, and Paving testing dates from their saved ages", () => {
  const records = [
    qcRecord({
      id: 61,
      testType: "Sand Sieve",
      sampleDate: "2026-09-01",
      location: "Plant A",
      material: "Sand",
      details: {
        sampleAge: "5",
        testingDate: "2026-09-20",
        testRows: [{ strength: 12 }],
      },
    }),
    qcRecord({
      id: 62,
      testType: "Aggregate Sieve",
      sampleDate: "2026-09-01",
      location: "Plant A",
      material: "Aggregate",
      details: {
        sampleAge: 7,
        testingDate: "2026-09-20",
        testRows: [{ strength: 14 }],
      },
    }),
    qcRecord({
      id: 63,
      testType: "Paving Blocks",
      sampleDate: "2026-09-01",
      location: "Plant A",
      material: "Paving Block",
      details: {
        blockAge: 10,
        testingDate: "2026-09-20",
        testRows: [{ load: 600, tensileStrength: 8 }],
      },
    }),
  ];

  const rows = buildDailyReportRows(records, "2026-09-06", "2026-09-11");
  assert.deepEqual(
    rows.map((row) => [row.category, row.cubeAge, row.testingDate]),
    [
      ["Aggregate Sieve", 7, "2026-09-08"],
      ["Paving Blocks", 10, "2026-09-11"],
      ["Sand Sieve", 5, "2026-09-06"],
    ],
  );
});

test("uses Block Age for block results and orders Ready Mix ages 7 days before 28 days per plant", () => {
  const records = [
    qcRecord({
      id: 14,
      testType: "Ready Mix",
      sampleDate: "2026-09-01",
      location: "Plant A",
      material: "OPC",
      details: {
        designStrength: "25 N OPC 20mm",
        testRows: [{ testAge: 28, load: 500, calculatedStrength: 44 }],
      },
    }),
    qcRecord({
      id: 15,
      testType: "Ready Mix",
      sampleDate: "2026-09-01",
      location: "Plant A",
      material: "OPC",
      details: {
        designStrength: "25 N OPC 20mm",
        testRows: [{ testAge: 7, load: 550, calculatedStrength: 30 }],
      },
    }),
    qcRecord({
      id: 16,
      testType: "Blocks",
      sampleDate: "2026-09-01",
      location: "Plant B",
      material: "4 inch Block",
      details: {
        blockType: "Hollow Concrete Block",
        blockAge: "28",
        testRows: [{ load: 800, calculatedStrength: 10 }],
      },
    }),
  ];

  const rows = buildDailyReportRows(records, "2026-09-01", "2026-09-29");
  assert.deepEqual(
    rows.map(({ category, plant, cubeAge }) => ({ category, plant, cubeAge })),
    [
      { category: "Blocks", plant: "Plant B", cubeAge: 28 },
      { category: "Ready Mix", plant: "Plant A", cubeAge: 7 },
      { category: "Ready Mix", plant: "Plant A", cubeAge: 28 },
    ],
  );
  assert.deepEqual(
    rows.map(({ category, castingDate, testingDate }) => ({
      category,
      castingDate,
      testingDate,
    })),
    [
      { category: "Blocks", castingDate: "2026-09-01", testingDate: "2026-09-29" },
      { category: "Ready Mix", castingDate: "2026-09-01", testingDate: "2026-09-08" },
      { category: "Ready Mix", castingDate: "2026-09-01", testingDate: "2026-09-29" },
    ],
  );
});

test("does not attempt an Excel download for an empty report", () => {
  assert.doesNotThrow(() => downloadDailyReportWorkbook([]));
});