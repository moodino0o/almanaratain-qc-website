import assert from "node:assert/strict";
import test from "node:test";
import { filterTypeaheadOptions } from "./typeahead-options";

test("filters reference values case-insensitively and prioritizes prefixes", () => {
  assert.deepEqual(
    filterTypeaheadOptions(["Fine Sand", "Sand", "Coarse Sand", "Aggregate"], " sand "),
    ["Sand", "Coarse Sand", "Fine Sand"],
  );
});

test("removes blank and case-insensitive duplicate reference values", () => {
  assert.deepEqual(
    filterTypeaheadOptions(["Sand", " sand ", "", "SAND", "Dust"], ""),
    ["Sand", "Dust"],
  );
});