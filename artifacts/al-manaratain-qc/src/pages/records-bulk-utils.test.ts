import assert from "node:assert/strict";
import test from "node:test";
import { RecordStatus, TestType, type QcRecord } from "@workspace/api-client-react";
import {
  bulkDraftToCreate,
  bulkDraftToUpdate,
  duplicateBulkDraft,
  recordToBulkDraft,
  updateDraftDetail,
  validateBulkDraft,
} from "./records-bulk-utils";

const record: QcRecord = {
  id: 7,
  recordNo: "RMX-7",
  testType: TestType.Ready_Mix,
  sampleDate: "2026-09-22",
  location: "HIDD",
  material: "40 N OPC",
  status: RecordStatus.Passed,
  testedBy: "Technician",
  remarks: "Original",
  details: {
    referenceNumber: "H-100",
    slump: 90,
    testRows: [{ load: 500, calculatedStrength: 22.22 }],
  },
};

test("preserves Ready Mix truck numbers in create and update payloads", () => {
  const draft = recordToBulkDraft({
    ...record,
    details: { ...record.details, truckNumber: "TRK-204" },
  });

  assert.equal(bulkDraftToCreate(draft).details?.truckNumber, "TRK-204");
  assert.equal(bulkDraftToUpdate(draft).details?.truckNumber, "TRK-204");
});

test("duplicating a new bulk draft copies every entry without sharing nested test rows", () => {
  const source = recordToBulkDraft(record);
  const duplicate = duplicateBulkDraft(source, -8);

  assert.equal(duplicate.id, -8);
  assert.equal(duplicate.recordNo, "New");
  assert.deepEqual(
    { ...duplicate, id: source.id, recordNo: source.recordNo },
    source,
  );
  assert.notStrictEqual(duplicate.details, source.details);
  assert.notStrictEqual(duplicate.details.testRows, source.details.testRows);

  (duplicate.details.testRows as Array<{ load: number }>)[0].load = 600;
  assert.equal((source.details.testRows as Array<{ load: number }>)[0].load, 500);
});

test("bulk metadata edits preserve specimen results", () => {
  const draft = updateDraftDetail(recordToBulkDraft(record), "slump", "95");
  const payload = bulkDraftToUpdate(draft);

  assert.equal(payload.details?.slump, "95");
  assert.deepEqual(payload.details?.testRows, record.details.testRows);
  assert.equal(payload.details?.referenceNumber, "H-100");
});

test("bulk drafts require the shared main record fields", () => {
  const draft = recordToBulkDraft(record);
  assert.deepEqual(validateBulkDraft(draft), []);
  assert.deepEqual(
    validateBulkDraft({ ...draft, location: "", material: "", testedBy: "" }),
    ["Location / plant", "Material / product", "Tested by"],
  );
});

test("bulk drafts require whole nonnegative ages for age-based record types", () => {
  const baseDraft = recordToBulkDraft(record);
  const cases = [
    { testType: TestType.Blocks, details: { blockAge: "" } },
    { testType: TestType.Paving_Blocks, details: { blockAge: "", pavingBlockSize: "200*200*60" } },
    { testType: TestType.Sand_Sieve, details: { sampleAge: "" } },
    { testType: TestType.Aggregate_Sieve, details: { sampleAge: "-1" } },
    { testType: TestType.Sand_Sieve, details: { sampleAge: "1.5" } },
  ] as const;

  for (const testCase of cases) {
    const draft = {
      ...baseDraft,
      testType: testCase.testType,
      details: { ...testCase.details },
    };
    assert.ok(validateBulkDraft(draft).includes("Age (days)"));
  }

  const zeroAgeDraft = {
    ...baseDraft,
    testType: TestType.Sand_Sieve,
    details: { sampleAge: "0" },
  };
  assert.deepEqual(validateBulkDraft(zeroAgeDraft), []);
});

test("bulk editing derives an age from a legacy testing date", () => {
  const legacyRecord: QcRecord = {
    ...record,
    testType: TestType.Aggregate_Sieve,
    sampleDate: "2026-09-01",
    details: { testingDate: "2026-09-08" },
  };

  const draft = recordToBulkDraft(legacyRecord);
  assert.equal(draft.details.sampleAge, "7");
  assert.deepEqual(validateBulkDraft(draft), []);
});

test("bulk editing does not infer an age from an invalid calendar date", () => {
  const legacyRecord: QcRecord = {
    ...record,
    testType: TestType.Aggregate_Sieve,
    sampleDate: "2026-02-01",
    details: { testingDate: "2026-02-30" },
  };

  const draft = recordToBulkDraft(legacyRecord);
  assert.equal(draft.details.sampleAge, "");
  assert.ok(validateBulkDraft(draft).includes("Age (days)"));
});