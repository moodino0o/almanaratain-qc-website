import assert from "node:assert/strict";
import test from "node:test";
import { RecordStatus, TestType } from "@workspace/api-client-react";
import {
  calculateReadyMixAgeBandAverages,
  dashboardStatusRegisterUrl,
  filterRecordsByDashboardStatus,
  parseDashboardRegisterFilters,
  registerTestingDate,
} from "./records-utils";

test("builds QC register links for the selected month and status", () => {
  assert.equal(dashboardStatusRegisterUrl("2026-10"), "/records?month=2026-10");
  assert.equal(
    dashboardStatusRegisterUrl("2026-10", RecordStatus.Passed),
    "/records?month=2026-10&status=Passed",
  );
  assert.equal(
    dashboardStatusRegisterUrl("2026-10", RecordStatus.Review),
    "/records?month=2026-10&status=Review",
  );
  assert.equal(
    dashboardStatusRegisterUrl("2026-10", RecordStatus.Failed),
    "/records?month=2026-10&status=Failed",
  );
});

test("parses only supported dashboard register filters", () => {
  assert.deepEqual(
    parseDashboardRegisterFilters("?month=2026-10&status=Review"),
    { month: "2026-10", status: RecordStatus.Review },
  );
  assert.deepEqual(
    parseDashboardRegisterFilters("?month=2026-13&status=unknown"),
    {},
  );
});

test("filters register rows by sample month and requested status", () => {
  const records = [
    { id: 1, sampleDate: "2026-10-03", status: RecordStatus.Passed },
    { id: 2, sampleDate: "2026-10-12", status: RecordStatus.Review },
    { id: 3, sampleDate: "2026-09-30", status: RecordStatus.Passed },
  ];

  assert.deepEqual(
    filterRecordsByDashboardStatus(records, {
      month: "2026-10",
      status: RecordStatus.Passed,
    }).map(({ id }) => id),
    [1],
  );
  assert.deepEqual(
    filterRecordsByDashboardStatus(records, { month: "2026-10" }).map(({ id }) => id),
    [1, 2],
  );
});

test("calculates per-record Ready Mix averages for the requested age bands", () => {
  assert.deepEqual(
    calculateReadyMixAgeBandAverages({
      testRows: [
        { testAge: "2", calculatedStrength: "30" },
        { testAge: "5", calculatedStrength: "40" },
        { testAge: 6, calculatedStrength: 44 },
        { testAge: 8, strength: "56" },
        { testAge: 28, calculatedStrength: 60 },
        { testAge: 29, calculatedStrength: 70 },
        { testAge: 10, calculatedStrength: 100 },
        { testAge: "", calculatedStrength: 100 },
      ],
    }),
    {
      twoToFiveDays: 35,
      sixToEightDays: 50,
      twentyEightToTwentyNineDays: 65,
    },
  );
});

test("returns null for Ready Mix age bands without recorded strengths", () => {
  assert.deepEqual(
    calculateReadyMixAgeBandAverages({
      testRows: [{ testAge: 3, calculatedStrength: 30 }],
    }),
    {
      twoToFiveDays: 30,
      sixToEightDays: null,
      twentyEightToTwentyNineDays: null,
    },
  );
});

test("derives Kerbstone register testing date from casting date and age", () => {
  assert.equal(
    registerTestingDate({
      testType: TestType.Kerb_Stone,
      sampleDate: "2026-09-01T00:00:00.000Z",
      details: { age: "28" },
    }),
    "2026-09-29T00:00:00.000Z",
  );
});