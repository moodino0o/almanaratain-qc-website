import type { QcWaterStandardRow } from "@workspace/db";

type WaterRecord = {
  testType: string;
  details: Record<string, unknown>;
};

type WaterParameter = "pH" | "Chloride (Cl)" | "TDS" | "SO3";

type WaterCriterion = {
  parameter: WaterParameter;
  measuredValue: number | null;
  minimum: number;
  maximum: number;
  withinLimits: boolean | null;
};

function numericValue(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string" || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function idValue(value: unknown): number | null {
  const id = numericValue(value);
  return id !== null && Number.isSafeInteger(id) && id > 0 ? id : null;
}

function criteriaFor(
  details: Record<string, unknown>,
  standard: QcWaterStandardRow,
): WaterCriterion[] {
  const definitions: Array<{
    parameter: WaterParameter;
    value: unknown;
    minimum: string;
    maximum: string;
  }> = [
    {
      parameter: "pH",
      value: details.ph,
      minimum: standard.phMin,
      maximum: standard.phMax,
    },
    {
      parameter: "Chloride (Cl)",
      value: details.chloride,
      minimum: standard.chlorideMin,
      maximum: standard.chlorideMax,
    },
    {
      parameter: "TDS",
      value: details.tds,
      minimum: standard.tdsMin,
      maximum: standard.tdsMax,
    },
    {
      parameter: "SO3",
      value: details.so3 ?? details.sulphate,
      minimum: standard.so3Min,
      maximum: standard.so3Max,
    },
  ];

  return definitions.map((definition) => {
    const measuredValue = numericValue(definition.value);
    const minimum = Number(definition.minimum);
    const maximum = Number(definition.maximum);
    return {
      parameter: definition.parameter,
      measuredValue,
      minimum,
      maximum,
      withinLimits:
        measuredValue === null
          ? null
          : measuredValue >= minimum && measuredValue <= maximum,
    };
  });
}

export function evaluateWaterRecord(
  record: WaterRecord,
  standards: QcWaterStandardRow[],
) {
  if (record.testType !== "Water") {
    return { details: record.details, status: undefined, evaluation: null };
  }

  const requestedId = idValue(record.details.waterStandardId);
  const standard = requestedId === null
    ? standards.find((item) => item.isDefault) ?? standards[0]
    : standards.find((item) => item.id === requestedId);
  const criteria = standard ? criteriaFor(record.details, standard) : [];
  const hasInvalidLink = requestedId !== null && !standard;
  const complete = criteria.length > 0 && criteria.every(
    (criterion) => criterion.measuredValue !== null,
  );
  const withinLimits =
    complete && criteria.every((criterion) => criterion.withinLimits === true);
  const failed =
    complete && criteria.some((criterion) => criterion.withinLimits === false);
  const status = hasInvalidLink || !standard || !complete
    ? "Review"
    : failed || !withinLimits
      ? "Failed"
      : "Passed";
  const reason = hasInvalidLink
    ? "The linked Water limit profile is no longer available."
    : !standard
      ? "Configure a Water limit profile before evaluating this record."
      : !complete
        ? "Enter pH, chloride, TDS, and SO3 results to evaluate this record."
        : failed
          ? "One or more Water results are outside the selected profile limits."
          : null;
  const evaluation = {
    type: "water" as const,
    status,
    standardId: standard?.id ?? requestedId,
    standardName: standard?.name ?? null,
    reason,
    criteria,
  };
  const details = {
    ...record.details,
    ...(standard && requestedId === null
      ? { waterStandardId: standard.id }
      : {}),
    waterEvaluation: evaluation,
  };

  return { details, status, evaluation };
}
