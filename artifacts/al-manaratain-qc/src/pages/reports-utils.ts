import type {
  DailyReadyMixResult,
  DailyReadyMixStrengthSummary,
  QcRecord,
} from "@workspace/api-client-react";

export type GroupedDailyLocation = {
  location: string;
  recordCount: number;
  sevenDay: DailyReadyMixStrengthSummary;
  twentyEightDay: DailyReadyMixStrengthSummary;
  strengthUnit: string;
};

export type GroupedDailyMix = {
  mixDesign: string;
  recordCount: number;
  sevenDay: DailyReadyMixStrengthSummary;
  twentyEightDay: DailyReadyMixStrengthSummary;
  strengthUnit: string;
  locations: GroupedDailyLocation[];
};

export type DailyStrengthTableRow = {
  mixDesign: string;
  plant: string;
  cubeAge: number;
  averageStrength: number;
  minimumStrength: number;
  maximumStrength: number;
  strengthUnit: string;
};

export type DailyReportRow = {
  date: string;
  category: string;
  plant: string;
  product: string;
  averageStrength: number;
  minimumStrength: number;
  maximumStrength: number;
  strengthUnit: string;
};

export type DailyReportProductOption = {
  key: string;
  category: string;
  product: string;
};

type StrengthGroup = {
  date: string;
  category: string;
  plant: string;
  product: string;
  strengths: number[];
  strengthUnit: string;
};

const numericValue = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const parsed = Number.parseFloat(value.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
};

const detailsValue = (details: Record<string, unknown>, keys: string[]) => {
  const normalized = new Map(
    Object.entries(details).map(([key, value]) => [key.toLowerCase(), value]),
  );
  for (const key of keys) {
    const value = normalized.get(key.toLowerCase());
    if (value !== undefined && value !== null && value !== "") return String(value).trim();
  }
  return "";
};

export function firstTwoWords(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).slice(0, 2).join(" ") || "Unspecified";
}

const addDays = (value: string, days: number) => {
  const date = new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

const recordProduct = (record: QcRecord, details: Record<string, unknown>) => {
  if (record.testType === "Ready Mix") {
    return firstTwoWords(detailsValue(details, ["designStrength", "mixStrength", "mixType"]) || record.material);
  }
  return firstTwoWords(
    detailsValue(details, ["blockType", "blockSize", "sampleType", "sieveSize", "materialCondition"])
      || record.material,
  );
};

const rowStrength = (row: unknown) => {
  if (typeof row !== "object" || row === null) return null;
  const values = row as Record<string, unknown>;
  return numericValue(
    values.correctedStrength ??
    values.normalizedStrength ??
    values.airDryStrength ??
    values.calculatedStrength ??
    values.strength ??
    values.compressiveStrength,
  );
};

const recordStrengths = (record: QcRecord, details: Record<string, unknown>) => {
  const rows = Array.isArray(details.testRows) ? details.testRows : [];
  const strengths = rows.map(rowStrength).filter((value): value is number => value !== null);
  if (strengths.length) return strengths;
  const directStrength = numericValue(
    details.averageStrength ??
    details.correctedStrength ??
    details.normalizedStrength ??
    details.airDryStrength ??
    details.calculatedStrength ??
    details.strength ??
    details.compressiveStrength,
  );
  return directStrength === null ? [] : [directStrength];
};

export function dailyReportProductOptions(records: QcRecord[]): DailyReportProductOption[] {
  const options = new Map<string, DailyReportProductOption>();
  for (const record of records) {
    const details = record.details as Record<string, unknown>;
    const category = record.testType;
    const product = recordProduct(record, details);
    const key = `${category}\u0000${product}`;
    options.set(key, { key, category, product });
  }
  return [...options.values()].sort(
    (left, right) =>
      left.category.localeCompare(right.category) ||
      left.product.localeCompare(right.product),
  );
}

export function buildDailyReportRows(
  records: QcRecord[],
  startDate: string,
  endDate: string,
  selectedProducts: string[] = [],
): DailyReportRow[] {
  const groups = new Map<string, StrengthGroup>();
  const selected = new Set(selectedProducts);
  const inRange = (date: string) => date >= startDate && date <= endDate;

  const addStrengths = (
    record: QcRecord,
    date: string | null,
    product: string,
    strengths: number[],
  ) => {
    if (!date || !inRange(date) || !strengths.length) return;
    const category = record.testType;
    const key = `${date}\u0000${category}\u0000${record.location}\u0000${product}`;
    if (selected.size && !selected.has(`${category}\u0000${product}`)) return;
    const current = groups.get(key) ?? {
      date,
      category,
      plant: record.location,
      product,
      strengths: [],
      strengthUnit: "N/mm²",
    };
    current.strengths.push(...strengths);
    groups.set(key, current);
  };

  for (const record of records) {
    const details = record.details as Record<string, unknown>;
    const product = recordProduct(record, details);
    if (record.testType === "Ready Mix") {
      const rows = Array.isArray(details.testRows) ? details.testRows : [];
      const ageGroups = new Map<number, number[]>();
      for (const row of rows) {
        if (typeof row !== "object" || row === null) continue;
        const age = numericValue((row as Record<string, unknown>).testAge ??
          (row as Record<string, unknown>).cubeAge ??
          (row as Record<string, unknown>).age);
        const strength = rowStrength(row);
        if (age === null || strength === null) continue;
        const current = ageGroups.get(age) ?? [];
        current.push(strength);
        ageGroups.set(age, current);
      }
      if (ageGroups.size) {
        for (const [age, strengths] of ageGroups) {
          addStrengths(record, addDays(record.sampleDate, age), product, strengths);
        }
      } else {
        addStrengths(record, record.sampleDate.slice(0, 10), product, recordStrengths(record, details));
      }
      continue;
    }
    addStrengths(record, record.sampleDate.slice(0, 10), product, recordStrengths(record, details));
  }

  return [...groups.values()]
    .map((group) => ({
      date: group.date,
      category: group.category,
      plant: group.plant,
      product: group.product,
      averageStrength: group.strengths.reduce((sum, value) => sum + value, 0) / group.strengths.length,
      minimumStrength: Math.min(...group.strengths),
      maximumStrength: Math.max(...group.strengths),
      strengthUnit: group.strengthUnit,
    }))
    .sort(
      (left, right) =>
        left.category.localeCompare(right.category) ||
        left.plant.localeCompare(right.plant) ||
        left.product.localeCompare(right.product) ||
        left.date.localeCompare(right.date),
    );
}

export function buildDailyStrengthRows(records: DailyReadyMixResult[]): DailyStrengthTableRow[] {
  const groups = new Map<string, {
    mixDesign: string;
    plant: string;
    cubeAge: number;
    strengths: number[];
    strengthUnit: string;
  }>();

  for (const record of records) {
    const summary = record.cubeAge === 7 ? record.sevenDay : record.twentyEightDay;
    const strengths = record.strengths.length
      ? record.strengths
      : summary.averageStrength === null
        ? []
        : [summary.averageStrength];
    if (!strengths.length) continue;

    const key = `${record.mixDesign}\u0000${record.location}\u0000${record.cubeAge}`;
    const current = groups.get(key) ?? {
      mixDesign: record.mixDesign,
      plant: record.location,
      cubeAge: record.cubeAge,
      strengths: [],
      strengthUnit: record.strengthUnit,
    };
    current.strengths.push(...strengths);
    groups.set(key, current);
  }

  return [...groups.values()]
    .map((group) => ({
      mixDesign: group.mixDesign,
      plant: group.plant,
      cubeAge: group.cubeAge,
      averageStrength: group.strengths.reduce((sum, value) => sum + value, 0) / group.strengths.length,
      minimumStrength: Math.min(...group.strengths),
      maximumStrength: Math.max(...group.strengths),
      strengthUnit: group.strengthUnit,
    }))
    .sort((left, right) =>
      left.mixDesign.localeCompare(right.mixDesign)
      || left.plant.localeCompare(right.plant)
      || left.cubeAge - right.cubeAge,
    );
}

const referenceSortParts = (value: string) => {
  const normalized = value.trim().toLocaleUpperCase();
  const prefixRank = normalized.startsWith("H")
    ? 0
    : normalized.startsWith("S")
      ? 1
      : 2;
  const numberMatch = normalized.match(/\d+(?:[.,]\d+)?/);
  const number = numberMatch
    ? Number(numberMatch[0].replace(",", "."))
    : Number.POSITIVE_INFINITY;

  return { prefixRank, number, normalized };
};

export function sortByReferenceNumber<T>(
  entries: T[],
  getReferenceNumber: (entry: T) => string,
): T[] {
  return [...entries].sort((left, right) => {
    const leftParts = referenceSortParts(getReferenceNumber(left));
    const rightParts = referenceSortParts(getReferenceNumber(right));

    return leftParts.prefixRank - rightParts.prefixRank
      || leftParts.number - rightParts.number
      || leftParts.normalized.localeCompare(rightParts.normalized, undefined, { numeric: true });
  });
}

type DailyStrengthAccumulator = {
  recordCount: number;
  sevenDay: DailyReadyMixStrengthSummary[];
  twentyEightDay: DailyReadyMixStrengthSummary[];
  strengthUnit: string;
};

const createDailyStrengthAccumulator = (): DailyStrengthAccumulator => ({
  recordCount: 0,
  sevenDay: [],
  twentyEightDay: [],
  strengthUnit: "N/mm²",
});

const summarizeDailyStrengths = (values: DailyReadyMixStrengthSummary[]): DailyReadyMixStrengthSummary => ({
  averageStrength: values.length
    ? values.reduce((sum, value) => sum + (value.averageStrength ?? 0), 0) / values.length
    : null,
  minimumStrength: values.length
    ? Math.min(...values.map((value) => value.minimumStrength ?? Infinity))
    : null,
  maximumStrength: values.length
    ? Math.max(...values.map((value) => value.maximumStrength ?? -Infinity))
    : null,
});

export function groupDailyResults(records: DailyReadyMixResult[]): GroupedDailyMix[] {
  const groups = new Map<string, DailyStrengthAccumulator & {
    locations: Map<string, DailyStrengthAccumulator>;
  }>();

  for (const record of records) {
    let group = groups.get(record.mixDesign);
    if (!group) {
      group = {
        ...createDailyStrengthAccumulator(),
        strengthUnit: record.strengthUnit,
        locations: new Map(),
      };
      groups.set(record.mixDesign, group);
    }
    group.recordCount += 1;
    if (record.sevenDay.averageStrength !== null) {
      group.sevenDay.push(record.sevenDay);
    }
    if (record.twentyEightDay.averageStrength !== null) {
      group.twentyEightDay.push(record.twentyEightDay);
    }

    let location = group.locations.get(record.location);
    if (!location) {
      location = {
        ...createDailyStrengthAccumulator(),
        strengthUnit: record.strengthUnit,
      };
      group.locations.set(record.location, location);
    }
    location.recordCount += 1;
    if (record.sevenDay.averageStrength !== null) {
      location.sevenDay.push(record.sevenDay);
    }
    if (record.twentyEightDay.averageStrength !== null) {
      location.twentyEightDay.push(record.twentyEightDay);
    }
  }

  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([mixDesign, group]) => ({
      mixDesign,
      recordCount: group.recordCount,
      sevenDay: summarizeDailyStrengths(group.sevenDay),
      twentyEightDay: summarizeDailyStrengths(group.twentyEightDay),
      strengthUnit: group.strengthUnit,
      locations: [...group.locations.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([location, summary]) => ({
          location,
          recordCount: summary.recordCount,
          sevenDay: summarizeDailyStrengths(summary.sevenDay),
          twentyEightDay: summarizeDailyStrengths(summary.twentyEightDay),
          strengthUnit: summary.strengthUnit,
        })),
    }));
}