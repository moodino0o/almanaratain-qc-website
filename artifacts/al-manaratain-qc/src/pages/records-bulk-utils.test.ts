import assert from "node:assert/strict";
import test from "node:test";
import { RecordStatus, TestType, type QcRecord } from "@workspace/api-client-react";
import {
  bulkDraftToUpdate,
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

test("bulk drafts require positive ages for age-based record types", () => {
  const baseDraft = recordToBulkDraft(record);
  const cases = [
    { testType: TestType.Blocks, details: { blockAge: "" } },
    { testType: TestType.Paving_Blocks, details: { blockAge: "", pavingBlockSize: "200*200*60" } },
    { testType: TestType.Sand_Sieve, details: { sampleAge: "" } },
    { testType: TestType.Aggregate_Sieve, details: { sampleAge: "0" } },
  ] as const;

  for (const testCase of cases) {
    const draft = {
      ...baseDraft,
      testType: testCase.testType,
      details: { ...testCase.details },
    };
    assert.ok(validateBulkDraft(draft).includes("Age (days)"));
  }
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