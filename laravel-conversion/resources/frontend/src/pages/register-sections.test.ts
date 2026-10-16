import assert from "node:assert/strict";
import test from "node:test";
import { TestType } from "@workspace/api-client-react";
import { REGISTER_SECTIONS } from "./register-sections";

test("register sections include the seven requested QC views in order", () => {
  assert.deepEqual(
    REGISTER_SECTIONS.map(({ label }) => label),
    ["All Tests", "Ready Mix", "Masonry", "Precast", "Kerbstone", "Aggregate", "Water"],
  );
});

test("each scoped register contains only its supported test types", () => {
  assert.deepEqual(
    REGISTER_SECTIONS.find(({ id }) => id === "readymix")?.testTypes,
    [TestType.Ready_Mix],
  );
  assert.deepEqual(
    REGISTER_SECTIONS.find(({ id }) => id === "masonry")?.testTypes,
    [TestType.Blocks, TestType.Paving_Blocks],
  );
  assert.deepEqual(
    REGISTER_SECTIONS.find(({ id }) => id === "aggregate")?.testTypes,
    [TestType.Sand_Sieve, TestType.Aggregate_Sieve, TestType["Flakiness_&_Elongation"]],
  );
  assert.deepEqual(
    REGISTER_SECTIONS.find(({ id }) => id === "precast")?.testTypes,
    [TestType.Precast],
  );
  assert.deepEqual(
    REGISTER_SECTIONS.find(({ id }) => id === "kerbstone")?.testTypes,
    [TestType.Kerb_Stone],
  );
  assert.deepEqual(
    REGISTER_SECTIONS.find(({ id }) => id === "water")?.testTypes,
    [TestType.Water],
  );
});