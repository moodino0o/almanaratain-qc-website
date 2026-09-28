export type ReadyMixAgeBandAverages = {
  twoToFiveDays: number | null;
  sixToEightDays: number | null;
  twentyEightToTwentyNineDays: number | null;
};

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