function detailsValue(details: unknown, keys: string[]) {
  if (typeof details !== "object" || details === null) return undefined;
  const values = details as Record<string, unknown>;
  const normalized = new Map(
    Object.entries(values).map(([key, value]) => [key.toLowerCase(), value]),
  );
  for (const key of keys) {
    const value = normalized.get(key.toLowerCase());
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
}

function numericValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const parsed = Number.parseFloat(value.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

export function readyMixStrengthsForAge(details: unknown, age: 7 | 28) {
  if (typeof details === "object" && details !== null) {
    const rows = (details as Record<string, unknown>).testRows;
    if (Array.isArray(rows)) {
      const rowStrengths = rows
        .filter((row) => numericValue(detailsValue(row, ["testAge", "cubeAge", "age"])) === age)
        .map((row) => detailsValue(row, ["calculatedStrength", "strength", "compressiveStrength"]))
        .map(numericValue)
        .filter((value): value is number => value !== null);
      if (rowStrengths.length || rows.length > 0) return rowStrengths;
    }
  }

  const directStrength = detailsValue(
    details,
    age === 7
      ? ["avg7Days", "average7Days", "sevenDayStrength", "strength7Days"]
      : ["avg28To29Days", "average28To29Days", "twentyEightDayStrength", "strength28Days", "averageStrength", "compressiveStrength", "strength"],
  );
  const directNumber = numericValue(directStrength);
  return directNumber === null ? [] : [directNumber];
}

export function summarizeStrengths(values: number[]) {
  return {
    averageStrength: values.length
      ? values.reduce((sum, value) => sum + value, 0) / values.length
      : null,
    minimumStrength: values.length ? Math.min(...values) : null,
    maximumStrength: values.length ? Math.max(...values) : null,
  };
}

export function summarizeStrengthSummaries(
  values: ReturnType<typeof summarizeStrengths>[],
) {
  return {
    averageStrength: values.length
      ? values.reduce((sum, value) => sum + (value.averageStrength ?? 0), 0) / values.length
      : null,
    minimumStrength: values.length
      ? Math.min(...values.map((value) => value.minimumStrength ?? Infinity))
      : null,
    maximumStrength: values.length
      ? Math.max(...values.map((value) => value.maximumStrength ?? -Infinity))
      : null,
  };
}