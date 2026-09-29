export function formatShapeFactor(value: unknown) {
  if (value === null || value === undefined || value === "") return "-";
  const rawValue = String(value).trim();
  if (!rawValue) return "-";

  const numericValue = Number(rawValue);
  return Number.isFinite(numericValue) ? numericValue.toFixed(2) : rawValue;
}