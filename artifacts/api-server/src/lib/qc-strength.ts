import type { QcSieveStandardRow, QcStrengthStandardRow } from "@workspace/db";

export type StrengthEvaluationStatus = "Passed" | "Review" | "Failed";

export type StrengthEvaluation = {
  status: StrengthEvaluationStatus;
  bsStandard: string | null;
  requiredStrength: number | null;
  averageStrength: number | null;
  minimumStrength: number | null;
  maximumStrength: number | null;
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

export type BlockDimensions = {
  length: number;
  width: number;
  height: number;
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

function normalizedText(value: unknown): string | null {
  const text = textValue(value);
  return text ? text.toLocaleLowerCase() : null;
}

function referenceId(value: unknown): number | null {
  const parsed = numericValue(value);
  return parsed !== null && Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function blockDimensionsFromSize(value: unknown): BlockDimensions | null {
  const text = textValue(value);
  if (!text) return null;

  const dimensionParts = text.match(/\d+(?:\.\d+)?/g);
  if (dimensionParts && /[*x×]/i.test(text) && dimensionParts.length >= 3) {
    const dimensions = dimensionParts.slice(0, 3).map(Number);
    if (dimensions.every((dimension) => Number.isFinite(dimension) && dimension > 0)) {
      return {
        length: dimensions[0],
        width: dimensions[1],
        height: dimensions[2],
      };
    }
  }

  const inchSize = text.match(/^(4|6|8|12)\s*(?:"|''|inches?|in)?$/i)?.[1];
  if (!inchSize) return null;
  const widthByInchSize: Record<string, number> = {
    "4": 100,
    "6": 150,
    "8": 200,
    "12": 250,
  };
  return {
    length: 400,
    width: widthByInchSize[inchSize],
    height: 200,
  };
}

function normalizedBlockType(value: unknown) {
  const text = textValue(value)
    ?.toLocaleLowerCase()
    .replace(/''/g, '"')
    .replace(/\s+/g, " ") ?? "";
  if (/^(plain|lined|sandwich insulation) block$/.test(text)) return text;
  const legacyType = text.match(
    /^(?:4|6|8|12)\s*(?:"|inches?|in)?\s+(plain|lined|sandwich insulation)\s+block$/,
  );
  return legacyType ? `${legacyType[1]} block` : text;
}

function blockTypeMatches(left: unknown, right: unknown) {
  return Boolean(normalizedBlockType(left)) &&
    normalizedBlockType(left) === normalizedBlockType(right);
}

function blockSizeMatches(left: unknown, right: unknown) {
  const leftText = normalizedText(left);
  const rightText = normalizedText(right);
  if (leftText && leftText === rightText) return true;
  const leftDimensions = blockDimensionsFromSize(left);
  const rightDimensions = blockDimensionsFromSize(right);
  if (!leftDimensions || !rightDimensions) return false;
  return (
    leftDimensions.length === rightDimensions.length &&
    leftDimensions.width === rightDimensions.width &&
    leftDimensions.height === rightDimensions.height
  );
}

function blockMaterialMatches(
  standardMaterial: unknown,
  recordMaterial: unknown,
  recordBlockType: unknown,
) {
  const standard = normalizedText(standardMaterial);
  const record = normalizedText(recordMaterial);
  return standard === record ||
    (standard === "concrete block" && blockTypeMatches(recordMaterial, recordBlockType));
}

export function normalizeBlockDetails(details: Record<string, unknown>) {
  const rows = Array.isArray(details.testRows) ? details.testRows : null;
  const legacyBlockAge = rows
    ?.map((row) => (
      typeof row === "object" && row !== null
        ? textValue((row as Record<string, unknown>).sampleAge)
        : null
    ))
    .find((value): value is string => value !== null) ?? null;
  const blockAge = textValue(details.blockAge) ?? legacyBlockAge;
  const dimensions = blockDimensionsFromSize(details.blockSize);

  return {
    ...details,
    ...(blockAge ? { blockAge } : {}),
    ...(rows
      ? {
          testRows: rows.map((row) => {
            if (typeof row !== "object" || row === null) return row;
            const values = { ...(row as Record<string, unknown>) };
            delete values.sampleAge;
            delete values.testAge;
            if (dimensions) {
              if (numericValue(values.length) === null) values.length = dimensions.length;
              if (numericValue(values.width) === null) values.width = dimensions.width;
              if (numericValue(values.height) === null) values.height = dimensions.height;
            }
            return values;
          }),
        }
      : {}),
  };
}

function standardMatchesRecord(
  standard: QcStrengthStandardRow,
  record: RecordForStrength,
) {
  const blockType = textValue(record.details.blockType);
  const blockSize = textValue(record.details.blockSize);
  if (
    standard.testType !== record.testType ||
    !blockMaterialMatches(
      standard.material,
      record.material,
      blockType,
    )
  ) {
    return false;
  }
  if (record.testType !== "Blocks") return true;
  return (
    blockTypeMatches(standard.blockType, blockType) &&
    blockSizeMatches(standard.blockSize, blockSize)
  );
}

function matchingStandard(
  record: RecordForStrength,
  standards: QcStrengthStandardRow[],
) {
  const selectedStandardId = referenceId(record.details.strengthStandardId);
  if (selectedStandardId !== null) {
    return standards.find(
      (standard) =>
        standard.id === selectedStandardId && standardMatchesRecord(standard, record),
    );
  }
  return standards.find((standard) => standardMatchesRecord(standard, record));
}

function dayAge(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const match = value.trim().match(/^\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
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
  const dryWeight = numericValue(values.dryWeight);
  const wetWeight = numericValue(values.wetWeight);
  const waterAbsorption =
    dryWeight !== null &&
    wetWeight !== null &&
    dryWeight > 0
      ? rounded(((wetWeight - dryWeight) / dryWeight) * 100)
      : null;

  return {
    row: {
      ...values,
      ...(loadedFaceArea !== null ? { loadedFaceArea } : {}),
      ...(waterAbsorption !== null
        ? { waterAbsorption: waterAbsorption.toFixed(2) }
        : { waterAbsorption: "" }),
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

  const normalizedDetails =
    record.testType === "Blocks" ? normalizeBlockDetails(record.details) : record.details;
  const normalizedRecord = { ...record, details: normalizedDetails };
  const standard = matchingStandard(normalizedRecord, standards);
  const requiredStrength =
    standard === undefined ? null : numericValue(standard.requiredStrength);
  const rows = Array.isArray(normalizedDetails.testRows) ? normalizedDetails.testRows : [];
  const calculatedRows = rows.map(calculateRow);
  const evaluatedRows =
    record.testType === "Ready Mix"
      ? calculatedRows.filter((row) => dayAge(row.row && typeof row.row === "object"
        ? (row.row as Record<string, unknown>).testAge ??
          (row.row as Record<string, unknown>).cubeAge ??
          (row.row as Record<string, unknown>).age
        : null) === 28)
      : calculatedRows;
  const measuredStrengths = evaluatedRows
    .map((row) => row.calculatedStrength)
    .filter((strength): strength is number => strength !== null);
  const averageStrength = measuredStrengths.length
    ? rounded(measuredStrengths.reduce((sum, strength) => sum + strength, 0) / measuredStrengths.length)
    : null;
  const minimumStrength = measuredStrengths.length ? Math.min(...measuredStrengths) : null;
  const maximumStrength = measuredStrengths.length ? Math.max(...measuredStrengths) : null;
  const hasIncompleteMeasurements =
    evaluatedRows.length === 0 ||
    evaluatedRows.some((row) => !row.complete) ||
    (record.testType === "Blocks" &&
      (dayAge(normalizedDetails.blockAge) === null || dayAge(normalizedDetails.blockAge)! <= 0));
  const averageBelowRequired =
    requiredStrength !== null &&
    averageStrength !== null &&
    averageStrength < requiredStrength;

  let status: StrengthEvaluationStatus = "Review";
  let reason: string | null =
    record.testType === "Ready Mix"
      ? "A complete 28-day cube result is required."
      : "Complete specimen load, dimensions, and Block age are required.";
  if (!standard) {
    reason =
      record.testType === "Blocks"
        ? "No matching standard was configured for this block type and size."
        : "No matching standard was configured for this material.";
  } else if (requiredStrength === null) {
    reason = "The configured minimum strength is invalid.";
  } else if (averageBelowRequired) {
    status = "Failed";
    reason =
      record.testType === "Blocks"
        ? "The average block strength is below the configured minimum."
        : "The measured strength is below the configured minimum.";
  } else if (!hasIncompleteMeasurements) {
    status = "Passed";
    reason = null;
  }

  const details = {
    ...normalizedDetails,
    testRows: calculatedRows.map((item) => item.row),
    strengthEvaluation: {
      status,
      bsStandard: standard?.bsStandard ?? null,
      requiredStrength,
      averageStrength,
      minimumStrength,
      maximumStrength,
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
    : normalizedText(standard.material) === normalizedText(record.material);
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
  const sampleWeight = rounded(
    sourceRows.reduce((total, row) => {
      if (typeof row !== "object" || row === null) return total;
      const amountReturned = numericValue((row as Record<string, unknown>).amountReturned);
      return amountReturned !== null && amountReturned >= 0
        ? total + amountReturned
        : total;
    }, 0),
  );
  let cumulativeReturned = 0;
  let measurementsValid = sampleWeight !== null && sampleWeight > 0;
  const rows: Array<Record<string, unknown>> = sourceRows.map((row, index) => {
    const values =
      typeof row === "object" && row !== null
        ? { ...(row as Record<string, unknown>) }
        : {};
    const amountReturned = numericValue(values.amountReturned);
    const {
      amountReturned: _existingAmountReturned,
      passingAmount: _existingPassingAmount,
      passingPercentage: _existingPassingPercentage,
      ...sourceValues
    } = values;
    const hasAmountEntry =
      values.amountReturned !== null &&
      values.amountReturned !== undefined &&
      String(values.amountReturned).trim().length > 0;
    if (!hasAmountEntry) {
      return {
        ...sourceValues,
        rowNo: referenceId(values.rowNo) ?? index + 1,
      };
    }
    let passingAmount: number | null = null;
    if (
      measurementsValid &&
      amountReturned !== null &&
      amountReturned >= 0
    ) {
      cumulativeReturned += amountReturned;
      if (sampleWeight !== null && cumulativeReturned <= sampleWeight) {
        passingAmount = rounded(sampleWeight - cumulativeReturned);
      } else {
        measurementsValid = false;
      }
    } else {
      measurementsValid = false;
    }
    const passingPercentage =
      passingAmount !== null && sampleWeight !== null
        ? rounded((passingAmount / sampleWeight) * 100)
        : null;
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
    sampleWeight,
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
