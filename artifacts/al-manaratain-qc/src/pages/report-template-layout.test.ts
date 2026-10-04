import assert from "node:assert/strict";
import test from "node:test";
import { createEmptyDesign } from "./report-designer-types";
import { positionRemarksAboveResults } from "./report-template-layout";

test("positions Blocks remarks after the full Test Details area and before results without mutating the template", () => {
  const source = createEmptyDesign("Blocks");
  const sourceContext = source.objects.find((object) => object.sectionKey === "context")!;
  const sourceResultsY = source.objects.find((object) => object.sectionKey === "results")!.y;
  const sourceSignaturesY = source.objects.find((object) => object.sectionKey === "signatures")!.y;
  const positioned = positionRemarksAboveResults(
    source,
    "Inspection remarks for this sample",
    "Blocks",
  );
  const remarks = positioned.objects.find((object) => object.sectionKey === "remarks")!;
  const results = positioned.objects.find((object) => object.sectionKey === "results")!;
  const signatures = positioned.objects.find((object) => object.sectionKey === "signatures")!;
  const testDetails = positioned.objects.find((object) => object.sectionKey === "context")!;

  assert.ok(testDetails.height >= 70, "the positioned details area must fit its rendered fields");
  assert.ok(testDetails.y + testDetails.height < remarks.y, "Remarks should follow all Test Details");
  assert.ok(remarks.y + remarks.height <= results.y, "results should follow Remarks");
  assert.ok(results.y >= sourceResultsY, "results should not move upward");
  assert.ok(signatures.y >= sourceSignaturesY, "signatures should not move upward");
  assert.equal(sourceContext.height, 39, "the saved details area must remain unchanged");
  assert.equal(
    source.objects.find((object) => object.sectionKey === "results")!.y,
    sourceResultsY,
    "the saved template must remain unchanged",
  );
});

test("does not move non-Blocks template coordinates because their details share the results flow", () => {
  const source = createEmptyDesign("Ready Mix");

  assert.strictEqual(
    positionRemarksAboveResults(source, "Inspection remarks for this sample", "Ready Mix"),
    source,
  );
});

test("preserves a template when remarks already fit above results", () => {
  const design = createEmptyDesign("Ready Mix");
  const adjusted = {
    ...design,
    objects: design.objects.map((object) =>
      object.sectionKey === "context"
        ? { ...object, height: 70 }
        : object.sectionKey === "remarks"
        ? { ...object, y: 125 }
        : object.sectionKey === "results"
          ? { ...object, y: 141 }
          : object,
    ),
  };

  assert.strictEqual(
    positionRemarksAboveResults(adjusted, "Fits in the saved remarks area", "Blocks"),
    adjusted,
  );
});

test("moves results down far enough for long remarks", () => {
  const design = createEmptyDesign("Blocks");
  const positioned = positionRemarksAboveResults(
    design,
    "Detailed note. ".repeat(300),
    "Blocks",
  );
  const remarks = positioned.objects.find((object) => object.sectionKey === "remarks")!;
  const results = positioned.objects.find((object) => object.sectionKey === "results")!;
  const context = positioned.objects.find((object) => object.sectionKey === "context")!;

  assert.ok(context.y + context.height < remarks.y);
  assert.ok(remarks.y + remarks.height < results.y);
  assert.ok(results.y > design.objects.find((object) => object.sectionKey === "results")!.y);
});

test("keeps hidden remarks hidden and leaves result coordinates unchanged", () => {
  const design = createEmptyDesign("Blocks");
  const hiddenRemarks = {
    ...design,
    objects: design.objects.map((object) =>
      object.sectionKey === "remarks" ? { ...object, visible: false } : object,
    ),
  };

  assert.strictEqual(
    positionRemarksAboveResults(hiddenRemarks, "Hidden note", "Blocks"),
    hiddenRemarks,
  );
});