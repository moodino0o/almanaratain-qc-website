import assert from "node:assert/strict";
import test from "node:test";
import type { DailyReadyMixResult } from "@workspace/api-client-react";
import { buildDailyStrengthRows, groupDailyResults, sortByReferenceNumber } from "./reports-utils";

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