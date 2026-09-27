import assert from "node:assert/strict";
import test from "node:test";
import { canEmployeeAddReferenceCategory } from "./employee-reference-permissions";

test("employees can add only customer, location, and mix-design values", () => {
  for (const categoryKey of [
    "customers",
    "customerLocations",
    "locations",
    "mixStrengths",
  ]) {
    assert.equal(canEmployeeAddReferenceCategory(categoryKey), true);
  }

  for (const categoryKey of [
    "materials",
    "employees",
    "blockTypes",
    "reference-data",
  ]) {
    assert.equal(canEmployeeAddReferenceCategory(categoryKey), false);
  }
});