import assert from "node:assert/strict";
import test from "node:test";
import {
  readyMixStrengthsForAge,
  summarizeStrengths,
  summarizeStrengthSummaries,
} from "./daily-ready-mix";

test("summarizes each requested cube age and ignores missing ages", () => {
  const details = {
    testRows: [
      { testAge: 7, calculatedStrength: 35 },
      { testAge: 7, calculatedStrength: 37 },
      { testAge: 28, calculatedStrength: 49 },
    ],
  };

  assert.deepEqual(readyMixStrengthsForAge(details, 7), [35, 37]);
  assert.deepEqual(summarizeStrengths(readyMixStrengthsForAge(details, 7)), {
    averageStrength: 36,
    minimumStrength: 35,
    maximumStrength: 37,
  });
  assert.deepEqual(summarizeStrengths(readyMixStrengthsForAge(details, 28)), {
    averageStrength: 49,
    minimumStrength: 49,
    maximumStrength: 49,
  });
});

test("does not reuse a direct strength when cube rows omit the requested age", () => {
  const details = {
    averageStrength: 52,
    testRows: [{ testAge: 7, calculatedStrength: 38 }],
  };

  assert.deepEqual(readyMixStrengthsForAge(details, 7), [38]);
  assert.deepEqual(readyMixStrengthsForAge(details, 28), []);
  assert.deepEqual(summarizeStrengths(readyMixStrengthsForAge(details, 28)), {
    averageStrength: null,
    minimumStrength: null,
    maximumStrength: null,
  });
});

test("uses legacy direct age fields when cube rows are not present", () => {
  const details = { avg7Days: "31.5", avg28To29Days: "47" };

  assert.deepEqual(readyMixStrengthsForAge(details, 7), [31.5]);
  assert.deepEqual(readyMixStrengthsForAge(details, 28), [47]);
});

test("preserves specimen minimums and maximums when aggregating records", () => {
  const result = summarizeStrengthSummaries([
    { averageStrength: 26.23, minimumStrength: 26.04, maximumStrength: 26.42 },
    { averageStrength: 31, minimumStrength: 30, maximumStrength: 32 },
  ]);

  assert.ok(Math.abs(result.averageStrength! - 28.615) < 1e-12);
  assert.equal(result.minimumStrength, 26.04);
  assert.equal(result.maximumStrength, 32);
});