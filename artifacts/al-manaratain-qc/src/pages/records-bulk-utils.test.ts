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