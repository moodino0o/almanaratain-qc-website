import assert from "node:assert/strict";
import test from "node:test";
import { calculateReadyMixAgeBandAverages } from "./records-utils";

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