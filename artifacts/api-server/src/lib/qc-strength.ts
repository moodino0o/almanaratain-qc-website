import type { QcStrengthStandardRow } from "@workspace/db";

export type StrengthEvaluationStatus = "Passed" | "Review" | "Failed";

export type StrengthEvaluation = {
  status: StrengthEvaluationStatus;
  bsStandard: string | null;
  requiredStrength: number | null;
  strengthUnit: string;
  reason: string | null;
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
