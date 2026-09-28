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
        { calculatedStrength: 40, airDryStrength: 48 },
        { calculatedStrength: 50, airDryStrength: 60 },
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
        { tensileStrength: 4, correctedStrength: 4.5 },
        { tensileStrength: 6, correctedStrength: 6.5 },
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
          { testAge: 28, calculatedStrength: 40 },
          { testAge: 28, calculatedStrength: 44 },
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
        testRows: [{ testAge: 28, calculatedStrength: 42 }],
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
            { testAge: "28", calculatedStrength: "54.96", strength: "54.96", airDryStrength: "66" },
            { testAge: "28", calculatedStrength: "57.22", strength: "57.22", airDryStrength: "68.7" },
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
          { testAge: 7, calculatedStrength: 40 },
          { testAge: 7, calculatedStrength: 44 },
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
        testRows: [{ testAge: 7, calculatedStrength: 50 }],
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
        testRows: [{ testAge: 7, calculatedStrength: 60 }],
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
        testRows: [{ testAge: 7, calculatedStrength: 64 }],
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
        testRows: [{ testAge: 7, calculatedStrength: 100 }],
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
        blockAge: "28",
        testRows: [{ calculatedStrength: 8 }, { calculatedStrength: 10 }],
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
    buildDailyReportRows(records, "2026-09-10", "2026-09-11", ["Blocks\u0000Hollow Concrete"]),
    [{
      date: "2026-09-10",
      castingDate: "2026-09-10",
      testingDate: "2026-10-08",
      category: "Blocks",
      plant: "Plant B",
      product: "Hollow Concrete",
      cubeAge: 28,
      averageStrength: 10.8,
      minimumStrength: 9.6,
      maximumStrength: 12,
      standardDeviation: Math.sqrt(((9.6 - 10.8) ** 2 + (12 - 10.8) ** 2) / 2),
      strengthUnit: "N/mm²",
    }],
  );
});

test("Block daily report min and max use air-dry strength, including the Dammam basis", () => {
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
            { waterStrength: 8, calculatedStrength: 8, airDryStrength: "", dryAirStrength: 12 },
            { waterStrength: 10, calculatedStrength: 10, airDryStrength: 14 },
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
            { waterStrength: "", calculatedStrength: 8, airDryStrength: 9.6 },
            { waterStrength: 10, calculatedStrength: 10, airDryStrength: 12 },
          ],
        },
      }),
    ],
    "2026-09-10",
    "2026-09-10",
  );

  const plantA = rows.find((row) => row.plant === "Plant A");
  const dammam = rows.find((row) => row.plant === "Dammam");
  assert.equal(plantA?.minimumStrength, 12);
  assert.equal(plantA?.maximumStrength, 14);
  assert.equal(dammam?.minimumStrength, 8);
  assert.equal(dammam?.maximumStrength, 10);
});

test("uses an entered Block testing date before the age-derived date", () => {
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
          testRows: [{ calculatedStrength: 10 }],
        },
      }),
    ],
    "2026-09-01",
    "2026-09-01",
  );

  assert.equal(rows[0]?.castingDate, "2026-09-01");
  assert.equal(rows[0]?.testingDate, "2026-10-02");
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
        testRows: [{ testAge: 28, calculatedStrength: 44 }],
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
        testRows: [{ testAge: 7, calculatedStrength: 30 }],
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
        testRows: [{ calculatedStrength: 10 }],
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