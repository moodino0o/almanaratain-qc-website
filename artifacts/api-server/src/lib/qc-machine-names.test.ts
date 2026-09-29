import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeMasonryMachineDetails,
  normalizeMasonryMachineName,
} from "./qc-machine-names";

test("normalizes legacy Masonry machine aliases", () => {
  assert.equal(normalizeMasonryMachineName("H1"), "HENKI I");
  assert.equal(normalizeMasonryMachineName(" h1 "), "HENKI I");
  assert.equal(normalizeMasonryMachineName("H2"), "HENKI II");
  assert.equal(normalizeMasonryMachineName("h2"), "HENKI II");
  assert.equal(normalizeMasonryMachineName("MASA"), "MASA");
});

test("normalizes machine fields without changing unrelated record details", () => {
  const details = {
    machine: "H1",
    machineType: "H2",
    remarks: "H1 remains in this note",
  };

  assert.deepEqual(
    normalizeMasonryMachineDetails("Blocks", details),
    {
      ...details,
      machine: "HENKI I",
      machineType: "HENKI II",
    },
  );
  assert.equal(normalizeMasonryMachineDetails("Ready Mix", details), details);
});