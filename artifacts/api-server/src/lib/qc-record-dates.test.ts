import assert from "node:assert/strict";
import test from "node:test";
import { calculateRecordTestingDate } from "./qc-record-dates";

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

test("rejects missing or nonpositive ages for age-based test types", () => {
  for (const age of [undefined, "", 0, -1, "not a number"]) {
    const result = calculateRecordTestingDate("Sand Sieve", "2026-09-01", {
      sampleAge: age,
    });
    assert.equal(result.testingDate, null);
    assert.ok(result.error);
  }
});

test("leaves test types without age-based dates unchanged", () => {
  const details = { testingDate: "2026-09-20" };
  const result = calculateRecordTestingDate("Ready Mix", "2026-09-01", details);

  assert.equal(result.error, null);
  assert.equal(result.testingDate, null);
  assert.equal(result.details, details);
});