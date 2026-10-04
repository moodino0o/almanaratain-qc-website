import assert from "node:assert/strict";
import test from "node:test";
import { createEmptyDesign } from "./report-designer-types";
import { positionRemarksAboveResults } from "./report-template-layout";

test("places remarks above results in default Ready Mix and Blocks templates without mutating saved designs", () => {
  for (const testType of ["Ready Mix", "Blocks"] as const) {
    const source = createEmptyDesign(testType);
    const sourceResultsY = source.objects.find((object) => object.sectionKey === "results")!.y;
    const sourceSignaturesY = source.objects.find((object) => object.sectionKey === "signatures")!.y;
    const positioned = positionRemarksAboveResults(source, "Inspection remarks for this sample");
    const remarks = positioned.objects.find((object) => object.sectionKey === "remarks")!;
    const results = positioned.objects.find((object) => object.sectionKey === "results")!;
    const signatures = positioned.objects.find((object) => object.sectionKey === "signatures")!;

    assert.ok(remarks.y + remarks.height <= results.y, `${testType} remarks should precede results`);
    assert.ok(results.y >= sourceResultsY, `${testType} results should not move upward`);
    assert.ok(signatures.y >= sourceSignaturesY, `${testType} signatures should not move upward`);
    assert.equal(
      source.objects.find((object) => object.sectionKey === "results")!.y,
      sourceResultsY,
      "the saved template must remain unchanged",
    );
  }
});

test("preserves a template when remarks already fit above results", () => {
  const design = createEmptyDesign("Ready Mix");
  const adjusted = {
    ...design,
    objects: design.objects.map((object) =>
      object.sectionKey === "remarks"
        ? { ...object, y: 50 }
        : object.sectionKey === "results"
          ? { ...object, y: 70 }
          : object,
    ),
  };

  assert.strictEqual(
    positionRemarksAboveResults(adjusted, "Fits in the saved remarks area"),
    adjusted,
  );
});

test("moves results down far enough for long remarks", () => {
  const design = createEmptyDesign("Ready Mix");
  const positioned = positionRemarksAboveResults(design, "Detailed note. ".repeat(300));
  const remarks = positioned.objects.find((object) => object.sectionKey === "remarks")!;
  const results = positioned.objects.find((object) => object.sectionKey === "results")!;

  assert.ok(remarks.y + remarks.height < results.y);
  assert.ok(results.y > design.objects.find((object) => object.sectionKey === "results")!.y);
});

test("keeps hidden remarks hidden and leaves result coordinates unchanged", () => {
  const design = createEmptyDesign("Ready Mix");
  const hiddenRemarks = {
    ...design,
    objects: design.objects.map((object) =>
      object.sectionKey === "remarks" ? { ...object, visible: false } : object,
    ),
  };

  assert.strictEqual(
    positionRemarksAboveResults(hiddenRemarks, "Hidden note"),
    hiddenRemarks,
  );
});