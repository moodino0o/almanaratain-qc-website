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

export function calculateBlockNetArea(width: unknown, length: unknown) {
  const parseDimension = (value: unknown) => {
    if (typeof value === "number") return Number.isFinite(value) && value > 0 ? value : null;
    if (typeof value !== "string" || !value.trim()) return null;
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  };
  const parsedWidth = parseDimension(width);
  const parsedLength = parseDimension(length);
  if (parsedWidth === null || parsedLength === null) return null;
  const area = parsedWidth * parsedLength;
  return Number.isFinite(area) ? area : null;
}

export function formatBlockNetArea(width: unknown, length: unknown) {
  const area = calculateBlockNetArea(width, length);
  return area === null ? "-" : String(Math.round(area));
}

type ConfiguredBlockColumn = {
  key: string;
  label: string;
  visible: boolean;
  order: number;
  width: number;
};

export function blockReportColumnsWithFaceArea<T extends ConfiguredBlockColumn>(
  columns: T[],
  faceAreaColumn?: T,
) {
  const compatibleColumns = blockReportColumnsWithoutWetWeight(columns).map((column) =>
    column.key === "faceArea" ? { ...column, label: "Net Area (mm²)" } : column,
  );
  if (
    !compatibleColumns.length ||
    compatibleColumns.some((column) => column.key === "faceArea") ||
    !faceAreaColumn
  ) {
    return compatibleColumns;
  }

  const heightColumn = compatibleColumns.find((column) => column.key === "height");
  const order = heightColumn
    ? heightColumn.order + 0.5
    : Math.max(-1, ...compatibleColumns.map((column) => column.order)) + 1;
  const withFaceArea = [
    ...compatibleColumns.map((column) =>
      column.order >= order ? { ...column, order: column.order + 0.5 } : column,
    ),
    { ...faceAreaColumn, visible: true, order },
  ];
  const visibleWidth = withFaceArea.reduce(
    (total, column) => total + (column.visible ? column.width : 0),
    0,
  );
  const adjustedColumns = visibleWidth > 100
    ? withFaceArea.map((column) => column.visible
      ? { ...column, width: column.width * 100 / visibleWidth }
      : column)
    : withFaceArea;
  return adjustedColumns.sort((left, right) => left.order - right.order);
}

export function filterRowsWithLoad<T>(rows: T[]): T[] {
  return rows.filter((row) => {
    if (typeof row !== "object" || row === null) return false;
    const load = (row as Record<string, unknown>).load;
    return load !== undefined && load !== null && String(load).trim() !== "";
  });
}