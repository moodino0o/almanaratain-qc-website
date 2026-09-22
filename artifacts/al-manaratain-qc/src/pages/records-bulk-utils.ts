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
  reviewedBy: string;
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
  reviewedBy: record.reviewedBy ?? "",
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
  reviewedBy: "ADEL ABBAS EBRAHIM",
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

const commonPayload = (
  draft: BulkRecordDraft,
  includeApprovedBy = false,
): QcRecordUpdate => ({
  sampleDate: draft.sampleDate,
  location: draft.location.trim(),
  material: draft.material.trim(),
  testedBy: draft.testedBy.trim(),
  remarks: draft.remarks.trim() || null,
  details: structuredClone(draft.details),
  ...(includeApprovedBy && draft.reviewedBy.trim()
    ? { reviewedBy: draft.reviewedBy.trim() }
    : {}),
});

export const bulkDraftToUpdate = (
  draft: BulkRecordDraft,
  includeApprovedBy = false,
): QcRecordUpdate => commonPayload(draft, includeApprovedBy);

export const bulkDraftToCreate = (
  draft: BulkRecordDraft,
  includeApprovedBy = false,
): QcRecordInput => ({
  ...commonPayload(draft, includeApprovedBy),
  testType: draft.testType,
  status: RecordStatus.Review,
  details: structuredClone(draft.details),
}) as QcRecordInput;