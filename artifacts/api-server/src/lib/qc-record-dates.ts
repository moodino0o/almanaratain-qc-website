export const ageDetailKeyForTestType: Record<string, "blockAge" | "sampleAge"> = {
  Blocks: "blockAge",
  "Paving Blocks": "blockAge",
  "Sand Sieve": "sampleAge",
  "Aggregate Sieve": "sampleAge",
};

const DAY_IN_MILLISECONDS = 86_400_000;
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function parseDateOnly(value: unknown): { value: string; epochDay: number } | null {
  if (typeof value !== "string" || !DATE_ONLY_PATTERN.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return null;
  return { value, epochDay: date.getTime() / DAY_IN_MILLISECONDS };
}

export function deriveAgeInDays(sampleDate: unknown, testingDate: unknown): number | null {
  const sample = parseDateOnly(sampleDate);
  const testing = parseDateOnly(testingDate);
  if (!sample || !testing || testing.epochDay < sample.epochDay) return null;
  const age = testing.epochDay - sample.epochDay;
  return Number.isSafeInteger(age) ? age : null;
}

export type HistoricalAgeBackfillRecord = {
  id: number;
  recordNo: string;
  testType: string;
  sampleDate: string;
  details: Record<string, unknown>;
};

export type HistoricalAgeBackfillCandidate = {
  id: number;
  recordNo: string;
  testType: string;
  sampleDate: string;
  testingDate: string;
  age: number;
};

export type HistoricalAgeBackfillIssue = {
  id: number;
  recordNo: string;
  testType: string;
  sampleDate: string | null;
  testingDate: string | null;
  reason: string;
};

export type HistoricalAgeBackfillInspection =
  | { kind: "complete" }
  | { kind: "eligible"; candidate: HistoricalAgeBackfillCandidate }
  | { kind: "manualReview"; issue: HistoricalAgeBackfillIssue };

function backfillIssue(
  record: HistoricalAgeBackfillRecord,
  reason: string,
): HistoricalAgeBackfillIssue {
  const savedTestingDate = record.details?.testingDate;
  return {
    id: record.id,
    recordNo: record.recordNo,
    testType: record.testType,
    sampleDate: typeof record.sampleDate === "string" ? record.sampleDate : null,
    testingDate: typeof savedTestingDate === "string" ? savedTestingDate : null,
    reason,
  };
}

function rowAgesMatch(details: Record<string, unknown>, expectedAge: number): boolean {
  if (!Array.isArray(details.testRows)) return true;
  const rowAges = details.testRows.flatMap((row) => {
    if (typeof row !== "object" || row === null || !("sampleAge" in row)) return [];
    const value = String((row as Record<string, unknown>).sampleAge ?? "").trim();
    return value ? [Number(value)] : [];
  });
  return rowAges.every((age) => Number.isSafeInteger(age) && age === expectedAge);
}

export function inspectHistoricalAgeBackfill(
  record: HistoricalAgeBackfillRecord,
): HistoricalAgeBackfillInspection {
  const ageKey = ageDetailKeyForTestType[record.testType];
  if (!ageKey) return { kind: "complete" };

  const details = record.details && typeof record.details === "object"
    ? record.details
    : {};
  const savedTestingDate = details.testingDate;
  const ageText = String(details[ageKey] ?? "").trim();

  if (ageText) {
    const age = Number(ageText);
    const calculated = calculateRecordTestingDate(record.testType, record.sampleDate, {
      ...details,
      [ageKey]: age,
    });
    if (
      Number.isSafeInteger(age) &&
      age >= 0 &&
      typeof savedTestingDate === "string" &&
      calculated.error === null &&
      calculated.testingDate === savedTestingDate &&
      rowAgesMatch(details, age)
    ) {
      return { kind: "complete" };
    }
    return {
      kind: "manualReview",
      issue: backfillIssue(
        record,
        "An age is already saved, but it is invalid or does not match the saved Testing Date.",
      ),
    };
  }

  if (typeof savedTestingDate !== "string" || !parseDateOnly(savedTestingDate)) {
    return {
      kind: "manualReview",
      issue: backfillIssue(record, "Sample Date or saved Testing Date is missing or invalid."),
    };
  }

  const age = deriveAgeInDays(record.sampleDate, savedTestingDate);
  if (age === null) {
    return {
      kind: "manualReview",
      issue: backfillIssue(record, "Testing Date is earlier than Sample Date or the date interval is invalid."),
    };
  }
  if (!rowAgesMatch(details, age)) {
    return {
      kind: "manualReview",
      issue: backfillIssue(record, "Test rows contain age values that conflict with the date interval."),
    };
  }

  const calculated = calculateRecordTestingDate(record.testType, record.sampleDate, {
    ...details,
    [ageKey]: age,
  });
  if (calculated.error || calculated.testingDate !== savedTestingDate) {
    return {
      kind: "manualReview",
      issue: backfillIssue(record, "The derived age does not reproduce the saved Testing Date."),
    };
  }

  return {
    kind: "eligible",
    candidate: {
      id: record.id,
      recordNo: record.recordNo,
      testType: record.testType,
      sampleDate: record.sampleDate,
      testingDate: savedTestingDate,
      age,
    },
  };
}

export function previewHistoricalAgeBackfill(records: HistoricalAgeBackfillRecord[]) {
  const eligible: HistoricalAgeBackfillCandidate[] = [];
  const manualReview: HistoricalAgeBackfillIssue[] = [];
  for (const record of records) {
    const inspection = inspectHistoricalAgeBackfill(record);
    if (inspection.kind === "eligible") eligible.push(inspection.candidate);
    if (inspection.kind === "manualReview") manualReview.push(inspection.issue);
  }
  return { eligible, manualReview };
}

export function calculateRecordTestingDate(
  testType: string,
  sampleDate: string,
  details: Record<string, unknown>,
) {
  const ageKey = ageDetailKeyForTestType[testType];
  if (!ageKey) {
    return { details, testingDate: null as string | null, error: null as string | null };
  }

  const ageText = String(details[ageKey] ?? "").trim();
  const age = ageText ? Number(ageText) : Number.NaN;
  if (!Number.isSafeInteger(age) || age < 0) {
    return {
      details,
      testingDate: null,
      error: `A valid ${ageKey === "blockAge" ? "Block age" : "Age"} in whole days (zero or more) is required.`,
    };
  }

  const sample = parseDateOnly(sampleDate.slice(0, 10));
  if (!sample) {
    return { details, testingDate: null, error: "Sample date must be valid." };
  }
  const date = new Date((sample.epochDay + age) * DAY_IN_MILLISECONDS);
  if (Number.isNaN(date.getTime())) {
    return { details, testingDate: null, error: "Calculated Testing Date is out of range." };
  }
  const testingDate = date.toISOString().slice(0, 10);
  if (!DATE_ONLY_PATTERN.test(testingDate)) {
    return { details, testingDate: null, error: "Calculated Testing Date is out of range." };
  }
  return {
    details: { ...details, testingDate },
    testingDate,
    error: null,
  };
}