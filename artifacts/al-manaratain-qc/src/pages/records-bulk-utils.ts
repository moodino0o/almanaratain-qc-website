import {
  RecordStatus,
  TestType,
  type QcRecord,
  type QcRecordInput,
  type QcRecordUpdate,
} from "@workspace/api-client-react";

export type BulkRecordDraft = {
  id: number;
  recordNo: string;
  testType: QcRecord["testType"];
  sampleDate: string;
  location: string;
  material: string;
  testedBy: string;
  remarks: string;
  details: Record<string, unknown>;
};

export const detailText = (details: Record<string, unknown>, key: string) =>
  details[key] == null ? "" : String(details[key]);

export const recordToBulkDraft = (record: QcRecord): BulkRecordDraft => ({
  id: record.id,
  recordNo: record.recordNo,
  testType: record.testType,
  sampleDate: record.sampleDate.slice(0, 10),
  location: record.location,
  material: record.material,
  testedBy: record.testedBy,
  remarks: record.remarks ?? "",
  details: structuredClone(record.details),
});

export const createEmptyBulkDraft = (sampleDate: string): BulkRecordDraft => ({
  id: -1,
  recordNo: "New",
  testType: TestType.Ready_Mix,
  sampleDate,
  location: "",
  material: "",
  testedBy: "",
  remarks: "",
  details: {},
});

export const updateDraftDetail = (
  draft: BulkRecordDraft,
  key: string,
  value: string,
): BulkRecordDraft => ({
  ...draft,
  details: {
    ...draft.details,
    [key]: value,
  },
});

export const validateBulkDraft = (draft: BulkRecordDraft) => {
  const missing = [
    !draft.sampleDate && "Sample date",
    !draft.location.trim() && "Location / plant",
    !draft.material.trim() && "Material / product",
    !draft.testedBy.trim() && "Tested by",
  ].filter((value): value is string => Boolean(value));
  return missing;
};

const commonPayload = (draft: BulkRecordDraft): QcRecordUpdate => ({
  sampleDate: draft.sampleDate,
  location: draft.location.trim(),
  material: draft.material.trim(),
  testedBy: draft.testedBy.trim(),
  remarks: draft.remarks.trim() || null,
  details: structuredClone(draft.details),
});

export const bulkDraftToUpdate = (draft: BulkRecordDraft): QcRecordUpdate =>
  commonPayload(draft);

export const bulkDraftToCreate = (draft: BulkRecordDraft): QcRecordInput => ({
  ...commonPayload(draft),
  testType: draft.testType,
  status: RecordStatus.Review,
  details: structuredClone(draft.details),
}) as QcRecordInput;