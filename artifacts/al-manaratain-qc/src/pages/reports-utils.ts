import type {
  DailyReadyMixResult,
  DailyReadyMixStrengthSummary,
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