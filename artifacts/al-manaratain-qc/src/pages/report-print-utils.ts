export function formatShapeFactor(value: unknown) {
  if (value === null || value === undefined || value === "") return "-";
  const rawValue = String(value).trim();
  if (!rawValue) return "-";

  const numericValue = Number(rawValue);
  return Number.isFinite(numericValue) ? numericValue.toFixed(2) : rawValue;
}

export function filterRowsWithLoad<T>(rows: T[]): T[] {
  return rows.filter((row) => {
    if (typeof row !== "object" || row === null) return false;
    const load = (row as Record<string, unknown>).load;
    return load !== undefined && load !== null && String(load).trim() !== "";
  });
}