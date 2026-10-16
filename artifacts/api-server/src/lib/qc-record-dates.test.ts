import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateRecordTestingDate,
  deriveAgeInDays,
  previewHistoricalAgeBackfill,
} from "./qc-record-dates";

test("calculates age-based testing dates for blocks, paving, sand, and aggregate", () => {
  const cases = [
    ["Blocks", "blockAge", 28, "2026-09-29"],
    ["Paving Blocks", "blockAge", 10, "2026-09-11"],
    ["Sand Sieve", "sampleAge", 5, "2026-09-06"],
    ["Aggregate Sieve", "sampleAge", 7, "2026-09-08"],
  ] as const;

  for (const [testType, ageKey, age, expected] of cases) {
    const result = calculateRecordTestingDate(
      testType,
      "2026-09-01",
      { [ageKey]: age, testingDate: "2026-09-20" },
    );
    assert.equal(result.error, null);
    assert.equal(result.testingDate, expected);
    assert.equal(result.details.testingDate, expected);
  }
});

test("rejects missing, negative, fractional, or invalid ages for age-based test types", () => {
  for (const age of [undefined, "", -1, 1.5, "not a number"]) {
    const result = calculateRecordTestingDate("Sand Sieve", "2026-09-01", {
      sampleAge: age,
    });
    assert.equal(result.testingDate, null);
    assert.ok(result.error);
  }
});

test("accepts a zero-day interval and rejects invalid calendar dates", () => {
  const sameDay = calculateRecordTestingDate("Sand Sieve", "2026-09-01", {
    sampleAge: 0,
  });
  assert.equal(sameDay.error, null);
  assert.equal(sameDay.testingDate, "2026-09-01");
  assert.equal(deriveAgeInDays("2026-09-01", "2026-09-01"), 0);
  assert.equal(deriveAgeInDays("2026-02-30", "2026-03-02"), null);
  assert.equal(deriveAgeInDays("2026-09-02", "2026-09-01"), null);
});

test("previews historical ages without changing ambiguous records", () => {
  const result = previewHistoricalAgeBackfill([
    {
      id: 1,
      recordNo: "BLK-1",
      testType: "Blocks",
      sampleDate: "2026-09-01",
      details: { testingDate: "2026-09-29" },
    },
    {
      id: 2,
      recordNo: "PAV-2",
      testType: "Paving Blocks",
      sampleDate: "2026-09-01",
      details: { testingDate: "2026-09-01" },
    },
    {
      id: 3,
      recordNo: "SAN-3",
      testType: "Sand Sieve",
      sampleDate: "2026-09-01",
      details: { testingDate: "2026-08-31" },
    },
    {
      id: 4,
      recordNo: "AGG-4",
      testType: "Aggregate Sieve",
      sampleDate: "2026-09-01",
      details: {
        testingDate: "2026-09-08",
        testRows: [{ sampleAge: "5" }, { sampleAge: "7" }],
      },
    },
    {
      id: 5,
      recordNo: "AGG-5",
      testType: "Aggregate Sieve",
      sampleDate: "2026-09-01",
      details: { sampleAge: "7", testingDate: "2026-09-08" },
    },
    {
      id: 6,
      recordNo: "WTR-6",
      testType: "Water",
      sampleDate: "2026-09-01",
      details: { testingDate: "2026-09-08" },
    },
  ]);

  assert.deepEqual(
    result.eligible.map(({ id, age }) => [id, age]),
    [[1, 28], [2, 0]],
  );
  assert.deepEqual(
    result.manualReview.map(({ id }) => id),
    [3, 4],
  );
});

test("does not propose already-populated age fields", () => {
  const result = previewHistoricalAgeBackfill([
    {
      id: 1,
      recordNo: "SAN-1",
      testType: "Sand Sieve",
      sampleDate: "2026-09-01",
      details: { sampleAge: "7", testingDate: "2026-09-08" },
    },
  ]);
  assert.deepEqual(result, { eligible: [], manualReview: [] });
});

test("leaves test types without age-based dates unchanged", () => {
  const details = { testingDate: "2026-09-20" };
  const result = calculateRecordTestingDate("Ready Mix", "2026-09-01", details);

  assert.equal(result.error, null);
  assert.equal(result.testingDate, null);
  assert.equal(result.details, details);
});