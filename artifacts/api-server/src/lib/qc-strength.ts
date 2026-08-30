import type { QcSieveStandardRow, QcStrengthStandardRow } from "@workspace/db";

export type StrengthEvaluationStatus = "Passed" | "Review" | "Failed";

export type StrengthEvaluation = {
  status: StrengthEvaluationStatus;
  bsStandard: string | null;
  requiredStrength: number | null;
  strengthUnit: string;
  reason: string | null;
};

export type SieveStandardForEvaluation = QcSieveStandardRow & {
  material: string;
  sieveSize: string;
};

export type SieveEvaluationCriterion = {
  standardId: number;
  sieveSize: string;
  measurementType: string;
  measuredValue: number | null;
  minimum: number | null;
  maximum: number | null;
  unit: string;
  withinLimits: boolean | null;
  rowNo: number | null;
};

export type SieveEvaluation = {
  type: "sieve";
  status: StrengthEvaluationStatus;
  standardReference: string | null;
  reason: string | null;
  criteria: SieveEvaluationCriterion[];
};

type RecordForStrength = {
  testType: string;
  material: string;
  details: Record<string, unknown>;
};

const AUTOMATED_TEST_TYPES = new Set(["Ready Mix", "Blocks"]);
const DEFAULT_STRENGTH_UNIT = "N/mm²";

function numericValue(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value !== "string" || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function rounded(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function textValue(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const text = String(value).trim();
  return text || null;
}

function referenceId(value: unknown): number | null {
  const parsed = numericValue(value);
  return parsed !== null && Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function matchingStandard(
  record: RecordForStrength,
  standards: QcStrengthStandardRow[],
) {
  const blockType = textValue(record.details.blockType);
  const blockSize = textValue(record.details.blockSize);

  return standards.find((standard) => {
    if (standard.testType !== record.testType || standard.material !== record.material) {
      return false;
    }
    if (record.testType !== "Blocks") return true;
    return standard.blockType === blockType && standard.blockSize === blockSize;
  });
}

function calculateRow(row: unknown) {
  if (typeof row !== "object" || row === null) {
    return { row, calculatedStrength: null, loadedFaceArea: null, complete: false };
  }

  const values = row as Record<string, unknown>;
  const load = numericValue(values.load);
  const length = numericValue(values.length);
  const width = numericValue(values.width);
  const loadedFaceArea =
    length !== null && width !== null && length > 0 && width > 0
      ? rounded(length * width)
      : null;
  const calculatedStrength =
    load !== null &&
    load >= 0 &&
    loadedFaceArea !== null &&
    loadedFaceArea > 0
      ? rounded((load * 1000) / loadedFaceArea)
      : null;

  return {
    row: {
      ...values,
      ...(loadedFaceArea !== null ? { loadedFaceArea } : {}),
      ...(calculatedStrength !== null
        ? {
            calculatedStrength,
            strength: calculatedStrength.toFixed(2),
          }
        : {}),
    },
    calculatedStrength,
    loadedFaceArea,
    complete: calculatedStrength !== null,
  };
}

export function evaluateStrengthRecord(
  record: RecordForStrength,
  standards: QcStrengthStandardRow[],
) {
  if (!AUTOMATED_TEST_TYPES.has(record.testType)) {
    return {
      details: record.details,
      status: undefined,
      evaluation: null,
    };
  }

  const standard = matchingStandard(record, standards);
  const requiredStrength =
    standard === undefined ? null : numericValue(standard.requiredStrength);
  const rows = Array.isArray(record.details.testRows) ? record.details.testRows : [];
  const calculatedRows = rows.map(calculateRow);
  const hasIncompleteMeasurements =
    calculatedRows.length === 0 || calculatedRows.some((row) => !row.complete);
  const hasFailedMeasurement =
    requiredStrength !== null &&
    calculatedRows.some(
      (row) => row.calculatedStrength !== null && row.calculatedStrength < requiredStrength,
    );

  let status: StrengthEvaluationStatus = "Review";
  let reason: string | null = "Complete specimen load and dimensions are required.";
  if (!standard) {
    reason =
      record.testType === "Blocks"
        ? "No matching standard was configured for this block type and size."
        : "No matching standard was configured for this material.";
  } else if (requiredStrength === null) {
    reason = "The configured minimum strength is invalid.";
  } else if (hasFailedMeasurement) {
    status = "Failed";
    reason = "At least one measured specimen is below the configured minimum.";
  } else if (!hasIncompleteMeasurements) {
    status = "Passed";
    reason = null;
  }

  const details = {
    ...record.details,
    testRows: calculatedRows.map((item) => item.row),
    strengthEvaluation: {
      status,
      bsStandard: standard?.bsStandard ?? null,
      requiredStrength,
      strengthUnit: standard?.strengthUnit || DEFAULT_STRENGTH_UNIT,
      reason,
    } satisfies StrengthEvaluation,
  };

  return { details, status, evaluation: details.strengthEvaluation };
}

function sieveStandardMatches(
  standard: SieveStandardForEvaluation,
  record: RecordForStrength,
): boolean {
  const recordMaterialId = referenceId(record.details.materialReferenceItemId);
  return recordMaterialId !== null
    ? recordMaterialId === standard.materialReferenceItemId
    : standard.material === record.material;
}

function rowMatchesStandard(
  row: Record<string, unknown>,
  standard: SieveStandardForEvaluation,
): boolean {
  const rowSizeId = referenceId(row.sieveSizeReferenceItemId);
  return rowSizeId !== null
    ? rowSizeId === standard.sieveSizeReferenceItemId
    : textValue(row.sieveSize) === standard.sieveSize;
}

export function evaluateSieveRecord(
  record: RecordForStrength,
  standards: SieveStandardForEvaluation[],
) {
  const applicableStandards = standards.filter(
    (standard) =>
      standard.testType === record.testType && sieveStandardMatches(standard, record),
  );
  const sourceRows = Array.isArray(record.details.sieveRows)
    ? record.details.sieveRows
    : [];
  const sampleWeight = numericValue(record.details.sampleWeight);
  const rows: Array<Record<string, unknown>> = sourceRows.map((row, index) => {
    const values =
      typeof row === "object" && row !== null
        ? { ...(row as Record<string, unknown>) }
        : {};
    const amountReturned = numericValue(values.amountReturned);
    const canCalculatePassing =
      sampleWeight !== null &&
      sampleWeight > 0 &&
      amountReturned !== null &&
      amountReturned >= 0 &&
      amountReturned <= sampleWeight;
    const passingAmount = canCalculatePassing
      ? rounded(sampleWeight - amountReturned)
      : null;
    const passingPercentage =
      passingAmount !== null && sampleWeight !== null
        ? rounded((passingAmount / sampleWeight) * 100)
        : null;
    const {
      passingAmount: _existingPassingAmount,
      passingPercentage: _existingPassingPercentage,
      ...sourceValues
    } = values;
    return {
      ...sourceValues,
      rowNo: referenceId(values.rowNo) ?? index + 1,
      ...(amountReturned !== null ? { amountReturned } : {}),
      ...(passingAmount !== null ? { passingAmount } : {}),
      ...(passingPercentage !== null ? { passingPercentage } : {}),
    };
  });

  const criteria: SieveEvaluationCriterion[] = [];
  let hasIncompleteMeasurements = rows.length === 0 || applicableStandards.length === 0;
  let hasFailedMeasurement = false;

  for (const standard of applicableStandards) {
    const row = rows.find((candidate) => rowMatchesStandard(candidate, standard));
    const measuredValue =
      standard.measurementType === "percentage"
        ? numericValue(row?.passingPercentage)
        : numericValue(row?.passingAmount);
    const minimum = numericValue(standard.minimum);
    const maximum = numericValue(standard.maximum);
    const validLimits =
      (minimum !== null || maximum !== null) &&
      (minimum === null || maximum === null || minimum <= maximum);
    const withinLimits =
      measuredValue !== null && validLimits
        ? (minimum === null || measuredValue >= minimum) &&
          (maximum === null || measuredValue <= maximum)
        : null;

    if (!row || measuredValue === null || !validLimits) {
      hasIncompleteMeasurements = true;
    }
    if (withinLimits === false) {
      hasFailedMeasurement = true;
    }

    criteria.push({
      standardId: standard.id,
      sieveSize: standard.sieveSize,
      measurementType: standard.measurementType,
      measuredValue,
      minimum,
      maximum,
      unit: standard.unit,
      withinLimits,
      rowNo: row ? referenceId(row.rowNo) : null,
    });
  }

  if (
    rows.some(
      (row) =>
        !applicableStandards.some((standard) => rowMatchesStandard(row, standard)),
    )
  ) {
    hasIncompleteMeasurements = true;
  }

  let status: StrengthEvaluationStatus = "Review";
  let reason: string | null = "Complete measurements are required for every configured sieve.";
  if (applicableStandards.length === 0) {
    reason = "No matching sieve standards were configured for this material.";
  } else if (hasFailedMeasurement) {
    status = "Failed";
    reason = "At least one sieve measurement is outside the configured acceptance limit.";
  } else if (!hasIncompleteMeasurements) {
    status = "Passed";
    reason = null;
  }

  const details = {
    ...record.details,
    sieveRows: rows,
    sieveEvaluation: {
      type: "sieve" as const,
      status,
      standardReference:
        applicableStandards.length > 0
          ? Array.from(new Set(applicableStandards.map((standard) => standard.standardReference))).join(", ")
          : null,
      reason,
      criteria,
    } satisfies SieveEvaluation,
  };

  return { details, status, evaluation: details.sieveEvaluation };
}
