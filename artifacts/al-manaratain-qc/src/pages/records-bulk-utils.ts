import {
  RecordStatus,
  TestType,
  type QcRecord,
  type QcRecordInput,
  type QcRecordUpdate,
} from "@workspace/api-client-react";
import { getReadyMixReferenceNumberError } from "./record-form-utils";

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

const ageFromDates = (sampleDate: string, testingDate: unknown) => {
  const sampleDay = sampleDate.slice(0, 10);
  const testDay = String(testingDate ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(sampleDay) || !/^\d{4}-\d{2}-\d{2}$/.test(testDay)) {
    return "";
  }
  const sampleTime = Date.parse(`${sampleDay}T00:00:00.000Z`);
  const testTime = Date.parse(`${testDay}T00:00:00.000Z`);
  if (
    !Number.isFinite(sampleTime) ||
    !Number.isFinite(testTime) ||
    new Date(sampleTime).toISOString().slice(0, 10) !== sampleDay ||
    new Date(testTime).toISOString().slice(0, 10) !== testDay ||
    testTime < sampleTime
  ) {
    return "";
  }
  const age = (testTime - sampleTime) / 86_400_000;
  return Number.isSafeInteger(age) ? String(age) : "";
};

export const recordToBulkDraft = (record: QcRecord): BulkRecordDraft => {
  const details = structuredClone(record.details);
  const ageKey =
    record.testType === TestType.Blocks || record.testType === TestType.Paving_Blocks
      ? "blockAge"
      : record.testType === TestType.Sand_Sieve || record.testType === TestType.Aggregate_Sieve
        ? "sampleAge"
        : null;
  if (ageKey && !detailText(details, ageKey).trim()) {
    details[ageKey] = ageFromDates(record.sampleDate, details.testingDate);
  }
  return {
    id: record.id,
    recordNo: record.recordNo,
    testType: record.testType,
    sampleDate: record.sampleDate.slice(0, 10),
    location: record.location,
    material: record.material,
    testedBy: record.testedBy,
    reviewedBy: record.reviewedBy ?? "",
    remarks: record.remarks ?? "",
    details,
  };
};

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

export const duplicateBulkDraft = (
  draft: BulkRecordDraft,
  id: number,
): BulkRecordDraft => ({
  ...draft,
  id,
  recordNo: "New",
  details: structuredClone(draft.details),
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
  const ageKey =
    draft.testType === TestType.Blocks || draft.testType === TestType.Paving_Blocks
      ? "blockAge"
      : draft.testType === TestType.Sand_Sieve || draft.testType === TestType.Aggregate_Sieve
        ? "sampleAge"
        : null;
  const ageText = ageKey ? detailText(draft.details, ageKey).trim() : "";
  const age = ageText ? Number(ageText) : Number.NaN;
  const missing = [
    !draft.sampleDate &&
      (draft.testType === TestType.Blocks || draft.testType === TestType.Paving_Blocks
        ? "Casting date"
        : "Sample date"),
    !draft.location.trim() && "Location / plant",
    !draft.material.trim() && "Material / product",
    !draft.testedBy.trim() && "Tested by",
    draft.testType === TestType.Ready_Mix &&
      getReadyMixReferenceNumberError(detailText(draft.details, "referenceNumber")),
    ageKey && (!ageText || !Number.isSafeInteger(age) || age < 0) && "Age (days)",
    draft.testType === TestType.Paving_Blocks &&
      !detailText(draft.details, "pavingBlockSize").trim() &&
      "Paving block size",
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
