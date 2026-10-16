import assert from "node:assert/strict";
import test from "node:test";
import { canonicalPlantLocation } from "./plant-location";

test("Eastern plant aliases resolve to one canonical location", () => {
  for (const location of [
    "EASTERN",
    "EASTERN Hidd",
    "EASTERN Aker",
    "EASTERN system",
    " eastern   hidd ",
  ]) {
    assert.equal(canonicalPlantLocation(location), "EASTERN");
  }
});

test("other plant location labels remain unchanged", () => {
  assert.equal(canonicalPlantLocation("HIDD"), "HIDD");
});
