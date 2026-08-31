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