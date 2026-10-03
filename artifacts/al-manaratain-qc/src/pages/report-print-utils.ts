export function formatShapeFactor(value: unknown) {
  if (value === null || value === undefined || value === "") return "-";
  const rawValue = String(value).trim();
  if (!rawValue) return "-";

  const numericValue = Number(rawValue);
  return Number.isFinite(numericValue) ? numericValue.toFixed(2) : rawValue;
}

export function formatWholeNumber(value: unknown, fallback = "-") {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(Math.round(value)) : fallback;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return fallback;
    const numericValue = Number(trimmed);
    return Number.isFinite(numericValue) ? String(Math.round(numericValue)) : trimmed;
  }
  return String(value);
}

export function blockReportColumnsWithoutWetWeight<T extends { key: string }>(columns: T[]) {
  return columns.filter((column) => column.key !== "wetWeight");
}

export function filterRowsWithLoad<T>(rows: T[]): T[] {
  return rows.filter((row) => {
    if (typeof row !== "object" || row === null) return false;
    const load = (row as Record<string, unknown>).load;
    return load !== undefined && load !== null && String(load).trim() !== "";
  });
}