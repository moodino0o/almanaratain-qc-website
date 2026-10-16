import { RecordStatus, TestType, type QcRecord } from "@workspace/api-client-react";

export type ReadyMixAgeBandAverages = {
  twoToFiveDays: number | null;
  sixToEightDays: number | null;
  twentyEightToTwentyNineDays: number | null;
};

export type DashboardRegisterFilters = {
  month?: string;
  status?: RecordStatus;
};

const validMonth = /^\d{4}-(0[1-9]|1[0-2])$/;
const recordStatuses = new Set<string>(Object.values(RecordStatus));

export function dashboardStatusRegisterUrl(
  month: string,
  status?: RecordStatus,
) {
  const params = new URLSearchParams({ month });
  if (status) params.set("status", status);
  return `/records?${params.toString()}`;
}

export function parseDashboardRegisterFilters(search: string): DashboardRegisterFilters {
  const params = new URLSearchParams(search);
  const monthValue = params.get("month") ?? "";
  const statusValue = params.get("status") ?? "";

  return {
    ...(validMonth.test(monthValue) ? { month: monthValue } : {}),
    ...(recordStatuses.has(statusValue)
      ? { status: statusValue as RecordStatus }
      : {}),
  };
}

export function filterRecordsByDashboardStatus<T extends Pick<QcRecord, "sampleDate" | "status">>(
  records: T[],
  filters: DashboardRegisterFilters,
) {
  return records.filter((record) =>
    (!filters.month || record.sampleDate.slice(0, 7) === filters.month) &&
    (!filters.status || record.status === filters.status),
  );
}

export function registerTestingDate(
  record: Pick<QcRecord, "testType" | "sampleDate" | "details">,
) {
  const details = record.details as Record<string, unknown>;
  const ageKey =
    record.testType === TestType.Blocks || record.testType === TestType.Paving_Blocks
      ? "blockAge"
      : record.testType === TestType.Kerb_Stone
        ? "age"
        : "sampleAge";
  const directAgeText = String(details[ageKey] ?? "").trim();
  const directAge = directAgeText ? Number(directAgeText) : Number.NaN;
  const rows = Array.isArray(details.testRows) ? details.testRows : [];
  const legacyRowAge = rows
    .map((row) => (
      typeof row === "object" && row !== null
        ? String((row as Record<string, unknown>).sampleAge ?? "").trim()
        : ""
    ))
    .map((value) => value ? Number(value) : Number.NaN)
    .find((value) => Number.isSafeInteger(value) && value >= 0);
  const age = Number.isSafeInteger(directAge) && directAge >= 0 ? directAge : legacyRowAge;
  const sampleDay = record.sampleDate.slice(0, 10);
  if (age !== undefined && Number.isSafeInteger(age) && age >= 0) {
    const date = new Date(`${sampleDay}T00:00:00.000Z`);
    if (!Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === sampleDay) {
      date.setUTCDate(date.getUTCDate() + age);
      return date.toISOString();
    }
  }
  return typeof details.testingDate === "string" && details.testingDate
    ? details.testingDate
    : record.sampleDate;
}

const numericValue = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const parsed = Number.parseFloat(value.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
};

const firstNumericValue = (values: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = numericValue(values[key]);
    if (value !== null) return value;
  }
  return null;
};

const average = (values: number[]) =>
  values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : null;

export function calculateReadyMixAgeBandAverages(
  details: Record<string, unknown>,
): ReadyMixAgeBandAverages {
  const ageBands = {
    twoToFiveDays: [] as number[],
    sixToEightDays: [] as number[],
    twentyEightToTwentyNineDays: [] as number[],
  };
  const rows = Array.isArray(details.testRows) ? details.testRows : [];

  for (const row of rows) {
    if (typeof row !== "object" || row === null) continue;
    const values = row as Record<string, unknown>;
    const age = firstNumericValue(values, ["testAge", "cubeAge", "age"]);
    const strength = firstNumericValue(values, [
      "calculatedStrength",
      "strength",
      "compressiveStrength",
    ]);
    if (age === null || strength === null) continue;

    if (age >= 2 && age <= 5) ageBands.twoToFiveDays.push(strength);
    else if (age >= 6 && age <= 8) ageBands.sixToEightDays.push(strength);
    else if (age >= 28 && age <= 29) {
      ageBands.twentyEightToTwentyNineDays.push(strength);
    }
  }

  return {
    twoToFiveDays: average(ageBands.twoToFiveDays),
    sixToEightDays: average(ageBands.sixToEightDays),
    twentyEightToTwentyNineDays: average(ageBands.twentyEightToTwentyNineDays),
  };
}