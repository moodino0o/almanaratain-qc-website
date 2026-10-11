import type {
  QcShapeFactorRow,
  QcSieveStandardRow,
  QcStrengthStandardRow,
} from "@workspace/db";

export type StrengthEvaluationStatus =
  | "Passed"
  | "Review"
  | "Failed"
  | "Waiting for results";

export type StrengthEvaluation = {
  status: StrengthEvaluationStatus;
  bsStandard: string | null;
  requiredStrength: number | null;
  minimumRequiredStrength?: number | null;
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
  location?: string;
  details: Record<string, unknown>;
};

export type BlockDimensions = {
  length: number;
  width: number;
  height: number;
};

export function isDammamLocation(value: unknown) {
  const location = textValue(value)?.toLocaleLowerCase().replace(/\s+/g, " ");
  return location === "dammam" || location === "dammam plant";
}

function isSandwichBlockType(value: unknown) {
  return textValue(value)?.toLocaleLowerCase().includes("sandwich") ?? false;
}

const AUTOMATED_TEST_TYPES = new Set([
  "Ready Mix",
  "Blocks",
  "Paving Blocks",
  "Precast",
  "Kerb Stone",
]);
const DEFAULT_STRENGTH_UNIT = "N/mm²";
export const PRECAST_AGE_STRENGTH_CRITERIA = [
  {
    age: 1,
    minimumStrength: 30,
    passOutcome: "Approved for demolding",
    failOutcome: "Not approved for demolding",
  },
  { age: 7, minimumStrength: 52, passOutcome: "Pass", failOutcome: "Fail" },
  { age: 28, minimumStrength: 65, passOutcome: "Pass", failOutcome: "Fail" },
] as const;

function numericValue(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value !== "string" || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function getDammamBlockHoleCount(blockSize: unknown): number | null {
  const width = blockDimensionsFromSize(blockSize)?.width;
  if (width === 100 || width === 150) return 2;
  if (width === 200) return 3;
  return null;
}

function dammamBlockThicknessDefaults(blockSize: unknown) {
  const width = blockDimensionsFromSize(blockSize)?.width;
  return {
    faceThickness: 30,
    webThickness: width === 100 || width === 150 ? 25 : 30,
  };
}

export function calculateDammamBlockResults(
  row: unknown,
  details: Record<string, unknown>,
) {
  if (typeof row !== "object" || row === null) return null;
  const values = row as Record<string, unknown>;
  const length = numericValue(values.length);
  const width = numericValue(values.width);
  const load = numericValue(values.load ?? values.failureLoad);
  if (
    length === null || width === null || length <= 0 || width <= 0 ||
    (load !== null && load <= 0)
  ) {
    return null;
  }

  const grossArea = width * length;
  const failureLoadN = load === null ? null : load * 1000;
  if (isSandwichBlockType(details.blockType)) {
    return {
      numberOfHoles: null,
      failureLoadN,
      grossArea,
      netArea: null,
      grossStrength: failureLoadN === null ? null : failureLoadN / grossArea,
      netStrength: null,
    };
  }

  const thicknessDefaults = dammamBlockThicknessDefaults(details.blockSize);
  const face = numericValue(
    values.faceThickness ?? details.faceThickness ?? thicknessDefaults.faceThickness,
  );
  const web = numericValue(
    values.webThickness ?? details.webThickness ?? thicknessDefaults.webThickness,
  );
  const holes = getDammamBlockHoleCount(details.blockSize);

  if (
    length === null || width === null || face === null || web === null ||
    holes === null || length <= 0 || width <= 0 || face <= 0 || web <= 0 ||
    (load !== null && load <= 0)
  ) {
    return null;
  }

  const holeWidth = width - (2 * face);
  const holeLength = (length - (2 * face) - ((holes - 1) * web)) / holes;
  if (holeWidth <= 0 || holeLength <= 0) return null;

  const netArea = grossArea - (holes * holeWidth * holeLength);
  if (netArea <= 0 || netArea >= grossArea) return null;

  return {
    numberOfHoles: holes,
    failureLoadN,
    grossArea,
    netArea,
    grossStrength: failureLoadN === null ? null : failureLoadN / grossArea,
    netStrength: failureLoadN === null ? null : failureLoadN / netArea,
  };
}

function normalizeDammamBlockDetails(details: Record<string, unknown>) {
  const isSandwich = isSandwichBlockType(details.blockType);
  const thicknessDefaults = dammamBlockThicknessDefaults(details.blockSize);
  const normalized: Record<string, unknown> = { ...details };
  if (isSandwich) {
    delete normalized.faceThickness;
    delete normalized.webThickness;
    delete normalized.numberOfHoles;
  } else {
    normalized.faceThickness =
      details.faceThickness ?? thicknessDefaults.faceThickness;
    normalized.webThickness =
      details.webThickness ?? thicknessDefaults.webThickness;
  }
  const numberOfHoles = isSandwich
    ? null
    : getDammamBlockHoleCount(normalized.blockSize);
  const rows: unknown[] = Array.isArray(normalized.testRows) ? normalized.testRows : [];
  return {
    ...normalized,
    ...(isSandwich ? {} : { numberOfHoles }),
    testRows: rows.map((row) => {
      if (typeof row !== "object" || row === null) return row;
      const values = row as Record<string, unknown>;
      const normalizedRow: Record<string, unknown> = { ...values };
      if (isSandwich) {
        delete normalizedRow.faceThickness;
        delete normalizedRow.webThickness;
        delete normalizedRow.numberOfHoles;
        delete normalizedRow.netArea;
        delete normalizedRow.netStrength;
      } else {
        normalizedRow.faceThickness =
          values.faceThickness ?? normalized.faceThickness;
        normalizedRow.webThickness =
          values.webThickness ?? normalized.webThickness;
      }
      const results = calculateDammamBlockResults(normalizedRow, normalized);
      return {
        ...normalizedRow,
        failureLoad: values.load ?? values.failureLoad ?? "",
        failureLoadN: results?.failureLoadN ?? null,
        grossArea: results?.grossArea ?? null,
        grossStrength: results?.grossStrength ?? null,
        ...(isSandwich
          ? {}
          : {
              numberOfHoles,
              netArea: results?.netArea ?? null,
              netStrength: results?.netStrength ?? null,
            }),
      };
    }),
  };
}

function rounded(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function roundedToOneDecimal(value: number) {
  return Math.round((value + Number.EPSILON) * 10) / 10;
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
    "12": 300,
  };
  return {
    length: 400,
    width: widthByInchSize[inchSize],
    height: 200,
  };
}

const BLOCK_SHAPE_FACTOR_TABLE = [
  { height: 40, factors: [0.8, 0.7, null, null, null] },
  { height: 50, factors: [0.85, 0.75, 0.7, null, null] },
  { height: 65, factors: [0.95, 0.85, 0.75, 0.7, 0.65] },
  { height: 100, factors: [1.15, 1, 0.9, 0.8, 0.75] },
  { height: 150, factors: [1.3, 1.2, 1.1, 1, 0.95] },
  { height: 200, factors: [1.45, 1.35, 1.25, 1.15, 1.1] },
  { height: 250, factors: [1.55, 1.45, 1.35, 1.25, 1.15] },
] as const;

export function blockShapeFactorFromSize(value: unknown): number | null {
  const dimensions = blockDimensionsFromSize(value);
  if (!dimensions) return null;

  const height = dimensions.height;
  const width = dimensions.width;
  const heightRow =
    BLOCK_SHAPE_FACTOR_TABLE.find((row) => row.height === height) ??
    (height >= 250
      ? BLOCK_SHAPE_FACTOR_TABLE[BLOCK_SHAPE_FACTOR_TABLE.length - 1]
      : undefined);
  if (!heightRow) return null;

  const widthColumn =
    width >= 250
      ? 4
      : [50, 100, 150, 200].indexOf(width);
  return widthColumn < 0 ? null : heightRow.factors[widthColumn] ?? null;
}

export function pavingCorrectionFactorFromSize(value: unknown): number | null {
  const text = textValue(value);
  if (!text) return null;
  if (/(?:^|[^0-9])60\s*(?:mm)?$/i.test(text)) return 0.87;
  if (/(?:^|[^0-9])80\s*(?:mm)?$/i.test(text)) return 1;
  return null;
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

export function normalizeBlockDetails(
  details: Record<string, unknown>,
  shapeFactors: QcShapeFactorRow[] = [],
) {
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
  const blockType = textValue(details.blockType);
  const configuredShapeFactor = numericValue(details.shapeFactor);
  const defaultShapeFactor =
    configuredShapeFactor === null && details.blockSize
      ? shapeFactors.find((factor) => blockSizeMatches(factor.blockSize, details.blockSize))
          ?.shapeFactor ?? null
      : null;

  return {
    ...details,
    ...(blockAge ? { blockAge } : {}),
    ...(defaultShapeFactor !== null ? { shapeFactor: defaultShapeFactor } : {}),
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

export function normalizePavingDetails(
  details: Record<string, unknown>,
  shapeFactors: QcShapeFactorRow[] = [],
) {
  const pavingBlockSize = textValue(details.pavingBlockSize ?? details.blockSize);
  const dimensions = blockDimensionsFromSize(pavingBlockSize);
  const rows = Array.isArray(details.testRows) ? details.testRows : null;
  const configuredCorrectionFactor = numericValue(details.correctionFactor);
  const configuredSizeFactor =
    configuredCorrectionFactor === null && pavingBlockSize
      ? shapeFactors.find(
          (factor) => normalizedText(factor.blockSize) === normalizedText(pavingBlockSize),
        )?.correctionFactor ?? null
      : null;
  const defaultCorrectionFactor =
    configuredCorrectionFactor === null && configuredSizeFactor === null
      ? pavingCorrectionFactorFromSize(pavingBlockSize)
      : configuredSizeFactor;

  return {
    ...details,
    ...(pavingBlockSize ? { pavingBlockSize } : {}),
    ...(defaultCorrectionFactor !== null
      ? { correctionFactor: defaultCorrectionFactor }
      : {}),
    ...(rows
      ? {
          testRows: rows.map((row) => {
            if (typeof row !== "object" || row === null || !dimensions) return row;
            const values = { ...(row as Record<string, unknown>) };
            if (numericValue(values.length) === null) values.length = dimensions.length;
            if (numericValue(values.width) === null) values.width = dimensions.width;
            if (numericValue(values.height) === null) values.height = dimensions.height;
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
  if (standard.testType !== record.testType) return false;
  if (record.testType === "Blocks") {
    return (
      blockTypeMatches(standard.blockType, blockType) &&
      blockSizeMatches(standard.blockSize, blockSize)
    );
  }
  if (record.testType === "Kerb Stone") {
    return (
      blockMaterialMatches(standard.material, record.material, blockType) &&
      blockTypeMatches(standard.blockType, textValue(record.details.kerbType)) &&
      blockSizeMatches(
        standard.blockSize,
        textValue(record.details.kerbSize ?? record.details.blockSize),
      )
    );
  }
  if (!blockMaterialMatches(standard.material, record.material, blockType)) return false;
  if (record.testType === "Paving Blocks") {
    const pavingBlockSize = textValue(
      record.details.pavingBlockSize ?? record.details.blockSize,
    );
    return !standard.blockSize ||
      (Boolean(pavingBlockSize) && blockSizeMatches(standard.blockSize, pavingBlockSize));
  }
  return true;
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
  return standards
    .filter((standard) => standardMatchesRecord(standard, record))
    .sort((left, right) => left.id - right.id)[0];
}

function dayAge(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const match = value.trim().match(/^\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function hasReadyMixResultInput(row: unknown) {
  if (typeof row !== "object" || row === null) return false;
  const values = row as Record<string, unknown>;
  return [
    "length",
    "width",
    "height",
    "load",
    "calculatedStrength",
    "strength",
    "compressiveStrength",
    "waterStrength",
  ].some((key) => {
    const value = values[key];
    return value !== undefined && value !== null && String(value).trim() !== "";
  });
}

function calculateRow(
  row: unknown,
  shapeFactorValue?: unknown,
  correctionFactorValue?: unknown,
  isPaving = false,
  isDammam = false,
  isPrecast = false,
  precastWeightIsGrams = false,
  isDammamSandwich = false,
) {
  if (typeof row !== "object" || row === null) {
    return { row, calculatedStrength: null, loadedFaceArea: null, complete: false };
  }

  const values = row as Record<string, unknown>;
  const load = numericValue(values.load);
  const length = numericValue(values.length);
  const width = numericValue(values.width);
  const height = numericValue(values.height);
  const loadedFaceArea =
    length !== null &&
    (isPaving
      ? height !== null && length > 0 && height > 0
      : width !== null && length > 0 && width > 0)
      ? rounded(length * (isPaving ? height! : width!))
      : null;
  const directPavingStrength = isPaving
    ? numericValue(values.tensileStrength ?? values.correctedStrength ?? values.strength)
    : null;
  const directPavingRawStrength = isPaving
    ? numericValue(values.compressiveStrength)
    : null;
  const hasLoadBasedStrength =
    load !== null &&
    load >= 0 &&
    loadedFaceArea !== null &&
    loadedFaceArea > 0;
  const loadBasedStrength =
    hasLoadBasedStrength
      ? (load! * 1000 * (isPaving ? 0.637 : 1)) / loadedFaceArea!
      : null;
  const calculatedStrength =
    loadBasedStrength !== null
      ? rounded(loadBasedStrength)
      : isPaving
        ? directPavingRawStrength ?? directPavingStrength
        : null;
  const airDryStrength =
    !isPaving && calculatedStrength !== null
      ? roundedToOneDecimal(isDammam ? calculatedStrength : calculatedStrength * 1.2)
      : null;
  const shapeFactor = numericValue(shapeFactorValue);
  const normalizedStrength =
    airDryStrength !== null &&
    shapeFactor !== null &&
    shapeFactor > 0
      ? roundedToOneDecimal(airDryStrength * shapeFactor)
      : null;
  const correctionFactor = numericValue(correctionFactorValue);
  const correctedStrength =
    isPaving && calculatedStrength !== null
      ? loadBasedStrength !== null
        ? correctionFactor !== null && correctionFactor >= 0
          ? rounded(loadBasedStrength * correctionFactor)
          : null
        : directPavingStrength ??
          (correctionFactor !== null && correctionFactor >= 0
            ? rounded(calculatedStrength * correctionFactor)
            : null)
      : null;
  const dryWeight = numericValue(values.dryWeight);
  const wetWeight = numericValue(values.wetWeight);
  const precastWeight = numericValue(values.weight);
  const densityWeight = isPrecast
    ? precastWeight !== null
      ? precastWeight * (precastWeightIsGrams ? 1 : 1000)
      : wetWeight === null
        ? null
        : wetWeight * 1000
    : wetWeight;
  const densityMultiplier = isPrecast ? 1_000_000 : 1_000_000_000;
  const density =
    densityWeight !== null &&
    length !== null &&
    width !== null &&
    numericValue(values.height) !== null &&
    densityWeight >= 0 &&
    length > 0 &&
    width > 0 &&
    numericValue(values.height)! > 0
      ? rounded(
          (densityWeight * densityMultiplier) /
          (length * width * numericValue(values.height)!),
        )
      : null;
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
      ...(isPaving
        ? {
            calculatedStrength,
            tensileStrength:
              correctedStrength === null ? "" : correctedStrength.toFixed(2),
            correctedStrength: correctedStrength ?? "",
            strength:
              correctedStrength === null ? "" : correctedStrength.toFixed(2),
          }
        : {}),
      ...(waterAbsorption !== null
        ? { waterAbsorption: waterAbsorption.toFixed(2) }
        : { waterAbsorption: "" }),
      ...(!isPaving && calculatedStrength !== null
        ? {
            calculatedStrength,
            waterStrength: (
              isDammamSandwich ? calculatedStrength / 1.2 : calculatedStrength
            ).toFixed(2),
            strength: calculatedStrength.toFixed(2),
          }
        : {}),
      ...(airDryStrength !== null ? { airDryStrength } : {}),
      ...(normalizedStrength !== null ? { normalizedStrength } : {}),
      ...(!isPaving && correctedStrength !== null
        ? {
            correctedStrength,
            strength: correctedStrength.toFixed(2),
          }
        : {}),
      ...(density !== null || isPrecast
        ? { density: density === null ? "" : density.toFixed(2) }
        : {}),
    },
    calculatedStrength,
    loadedFaceArea,
    complete: isPaving
      ? hasLoadBasedStrength &&
        correctionFactor !== null &&
        correctionFactor >= 0 &&
        correctedStrength !== null &&
        width !== null &&
        width > 0 &&
        density !== null &&
        waterAbsorption !== null
      : calculatedStrength !== null,
  };
}

function evaluatePrecastStrengthRecord(
  record: RecordForStrength,
  standards: QcStrengthStandardRow[],
) {
  const sourceRows = Array.isArray(record.details.testRows)
    ? record.details.testRows
    : [];
  const precastWeightIsGrams =
    textValue(record.details.cubeWeightUnit)?.toLocaleLowerCase() === "g";
  const calculatedRows = sourceRows.map((row) =>
    calculateRow(row, undefined, undefined, false, false, true, precastWeightIsGrams),
  );
  const matchingPrecastStandards = standards.filter(
    (standard) =>
      standard.testType === "Precast" &&
      standard.material.trim().toLocaleLowerCase() ===
        record.material.trim().toLocaleLowerCase(),
  );
  const ageEvaluations = PRECAST_AGE_STRENGTH_CRITERIA.map((criterion) => {
    const ageStandard = matchingPrecastStandards.find(
      (standard) => Number(standard.cubeAge) === criterion.age,
    );
    const minimumStrength =
      numericValue(ageStandard?.requiredStrength) ?? criterion.minimumStrength;
    const ageRows = calculatedRows.filter((row) => {
      const values = typeof row.row === "object" && row.row !== null
        ? row.row as Record<string, unknown>
        : {};
      return dayAge(
        values.testAge ?? values.sampleAge ?? values.cubeAge ?? values.age,
      ) === criterion.age;
    });
    const measuredStrengths = ageRows
      .map((row) => row.calculatedStrength)
      .filter((strength): strength is number => strength !== null);
    const averageStrength = measuredStrengths.length
      ? rounded(
          measuredStrengths.reduce((sum, strength) => sum + strength, 0) /
            measuredStrengths.length,
        )
      : null;
    const complete =
      ageRows.length > 0 && ageRows.every((row) => row.complete);
    const outcome =
      !complete || averageStrength === null
        ? "Pending"
        : averageStrength >= minimumStrength
          ? criterion.passOutcome
          : criterion.failOutcome;
    return {
      age: criterion.age,
      minimumStrength,
      standardId: ageStandard?.id ?? null,
      bsStandard: ageStandard?.bsStandard ?? null,
      averageStrength,
      outcome,
    };
  });
  const finalAgeEvaluation = ageEvaluations.find((evaluation) => evaluation.age === 28);
  const finalAgeStandard = matchingPrecastStandards.find(
    (standard) => Number(standard.cubeAge) === 28,
  );
  const finalAgeRows = calculatedRows.filter((row) => {
    const values = typeof row.row === "object" && row.row !== null
      ? row.row as Record<string, unknown>
      : {};
    return dayAge(
      values.testAge ?? values.sampleAge ?? values.cubeAge ?? values.age,
    ) === 28;
  });
  const finalAgeStrengths = finalAgeRows
    .map((row) => row.calculatedStrength)
    .filter((strength): strength is number => strength !== null);
  const status: StrengthEvaluationStatus =
    finalAgeEvaluation?.outcome === "Pass"
      ? "Passed"
      : finalAgeEvaluation?.outcome === "Fail"
        ? "Failed"
        : "Review";
  const reason =
    status === "Review"
      ? "Complete 28-day Precast cube results are required for final approval."
      : status === "Failed"
        ? `The average 28-day Precast strength is below ${finalAgeEvaluation?.minimumStrength ?? 65} N/mm².`
        : null;
  const strengthEvaluation: StrengthEvaluation = {
    status,
    bsStandard:
      finalAgeStandard?.bsStandard ??
      "BS 1881 : PART 116 : 1983",
    requiredStrength: finalAgeEvaluation?.minimumStrength ?? 65,
    averageStrength: finalAgeEvaluation?.averageStrength ?? null,
    minimumStrength: finalAgeStrengths.length
      ? Math.min(...finalAgeStrengths)
      : null,
    maximumStrength: finalAgeStrengths.length
      ? Math.max(...finalAgeStrengths)
      : null,
    strengthUnit: finalAgeStandard?.strengthUnit ?? DEFAULT_STRENGTH_UNIT,
    reason,
  };
  const details = {
    ...record.details,
    testRows: calculatedRows.map((item) => item.row),
    precastAgeEvaluations: ageEvaluations,
    strengthEvaluation,
  };

  return { details, status, evaluation: strengthEvaluation };
}

function evaluateKerbStrengthRecord(
  record: RecordForStrength,
  standards: QcStrengthStandardRow[],
) {
  const standard = matchingStandard(record, standards);
  const sourceRows = Array.isArray(record.details.testRows) ? record.details.testRows : [];
  const limit = numericValue(standard?.waterAbsorptionLimit);
  let hasIncompleteStrength = sourceRows.length === 0;
  let hasIncompleteAbsorption = false;
  let strengthFailed = false;
  let absorptionFailed = false;
  const strengths: number[] = [];
  const calculatedRows = sourceRows.map((row) => {
    if (typeof row !== "object" || row === null) {
      hasIncompleteStrength = true;
      return row;
    }
    const values = row as Record<string, unknown>;
    const load = numericValue(values.failureLoad ?? values.load);
    const span = numericValue(values.spanLength);
    const width = numericValue(values.width);
    const batterDepth = numericValue(values.batterDepth);
    const completeStrength =
      load !== null && load >= 0 &&
      span !== null && span > 0 &&
      width !== null && width > 0 &&
      batterDepth !== null && batterDepth > 0;
    const rawStrength = completeStrength
      ? (3 * load! * 1_000 * span!) / (2 * width! * batterDepth! ** 2)
      : null;
    const bendingStrength = rawStrength === null ? null : rounded(rawStrength);
    if (bendingStrength === null) hasIncompleteStrength = true;
    else strengths.push(bendingStrength);
    const wetWeight = values.wetWeight;
    const hasWetWeight = wetWeight !== undefined && wetWeight !== null &&
      String(wetWeight).trim() !== "";
    let waterAbsorption: number | null = null;
    let waterAbsorptionStatus: "Pass" | "Fail" | "Review" | "" = "";
    if (hasWetWeight) {
      const dry = numericValue(values.weight);
      const wet = numericValue(wetWeight);
      if (dry === null || dry <= 0 || wet === null || limit === null || limit < 0) {
        hasIncompleteAbsorption = true;
        waterAbsorptionStatus = "Review";
      } else {
        waterAbsorption = ((wet - dry) / dry) * 100;
        waterAbsorptionStatus = waterAbsorption < limit ? "Pass" : "Fail";
        if (waterAbsorptionStatus === "Fail") absorptionFailed = true;
      }
    }
    return {
      ...values,
      bendingStrength: bendingStrength === null ? "" : bendingStrength.toFixed(2),
      waterAbsorption: waterAbsorption === null ? "" : waterAbsorption.toFixed(2),
      waterAbsorptionStatus,
    };
  });
  const averageStrength = strengths.length
    ? rounded(strengths.reduce((sum, strength) => sum + strength, 0) / strengths.length)
    : null;
  const minimumStrength = strengths.length ? Math.min(...strengths) : null;
  const maximumStrength = strengths.length ? Math.max(...strengths) : null;
  const requiredStrength = numericValue(standard?.requiredStrength);
  const minimumRequiredStrength = numericValue(standard?.minimumIndividualStrength);
  if (
    requiredStrength !== null &&
    averageStrength !== null &&
    averageStrength < requiredStrength
  ) strengthFailed = true;
  if (
    minimumRequiredStrength !== null &&
    minimumStrength !== null &&
    minimumStrength < minimumRequiredStrength
  ) strengthFailed = true;

  const status: StrengthEvaluationStatus =
    strengthFailed || absorptionFailed
      ? "Failed"
      : !standard ||
          requiredStrength === null ||
          minimumRequiredStrength === null ||
          hasIncompleteStrength ||
          hasIncompleteAbsorption
        ? "Review"
        : "Passed";
  const reason = status === "Passed"
    ? null
    : status === "Failed"
      ? strengthFailed
        ? "The average or minimum individual bending strength is below the configured Kerbstone standard."
        : "One or more specimens exceed the configured water absorption limit."
      : !standard
        ? "No matching Kerbstone standard was configured."
        : "Complete Kerbstone bending measurements and any entered absorption measurements.";
  const strengthEvaluation: StrengthEvaluation = {
    status,
    bsStandard: standard?.bsStandard ?? null,
    requiredStrength,
    minimumRequiredStrength,
    averageStrength,
    minimumStrength,
    maximumStrength,
    strengthUnit: standard?.strengthUnit || "MPa",
    reason,
  };
  const details = {
    ...record.details,
    testRows: calculatedRows,
    strengthEvaluation,
  };
  return { details, status, evaluation: strengthEvaluation };
}

export function evaluateStrengthRecord(
  record: RecordForStrength,
  standards: QcStrengthStandardRow[],
  shapeFactors: QcShapeFactorRow[] = [],
) {
  if (!AUTOMATED_TEST_TYPES.has(record.testType)) {
    return {
      details: record.details,
      status: undefined,
      evaluation: null,
    };
  }

  if (record.testType === "Precast") {
    return evaluatePrecastStrengthRecord(record, standards);
  }
  if (record.testType === "Kerb Stone") {
    return evaluateKerbStrengthRecord(record, standards);
  }

  const baseNormalizedDetails: Record<string, unknown> =
    record.testType === "Blocks"
      ? normalizeBlockDetails(record.details, shapeFactors)
      : record.testType === "Paving Blocks"
        ? normalizePavingDetails(record.details, shapeFactors)
      : record.details;
  const normalizedDetails: Record<string, unknown> =
    record.testType === "Blocks" && isDammamLocation(record.location)
      ? normalizeDammamBlockDetails(baseNormalizedDetails)
      : baseNormalizedDetails;
  const isDammamSandwich =
    record.testType === "Blocks" &&
    isDammamLocation(record.location) &&
    isSandwichBlockType(normalizedDetails.blockType);
  const isDammamBlock =
    record.testType === "Blocks" && isDammamLocation(record.location);
  const normalizedRecord = { ...record, details: normalizedDetails };
  const standard = matchingStandard(normalizedRecord, standards);
  const requiredStrength = standard === undefined
    ? null
    : numericValue(
        isDammamBlock
          ? standard.dammamAverageStrength
          : standard.requiredStrength,
      );
  const minimumRequiredStrength =
    standard !== undefined && isDammamBlock && !isDammamSandwich
      ? numericValue(standard.dammamMinimumStrength)
      : null;
  const rows = Array.isArray(normalizedDetails.testRows) ? normalizedDetails.testRows : [];
  const calculatedRows = rows.map((row) =>
    calculateRow(
      row,
      record.testType === "Blocks"
        ? (normalizedDetails as Record<string, unknown>).shapeFactor
        : undefined,
      record.testType === "Paving Blocks"
        ? (normalizedDetails as Record<string, unknown>).correctionFactor
        : undefined,
      record.testType === "Paving Blocks",
      record.testType === "Blocks" && isDammamLocation(record.location),
      record.testType === "Precast",
      false,
      isDammamSandwich,
    )
  );
  const evaluatedRows =
    record.testType === "Ready Mix"
      ? calculatedRows.filter((row) => dayAge(row.row && typeof row.row === "object"
        ? (row.row as Record<string, unknown>).testAge ??
          (row.row as Record<string, unknown>).cubeAge ??
          (row.row as Record<string, unknown>).age
        : null) === 28)
      : calculatedRows;
  const readyMixHasMissingAge =
    record.testType === "Ready Mix" &&
    calculatedRows.some((item) => {
      const values = typeof item.row === "object" && item.row !== null
        ? item.row as Record<string, unknown>
        : {};
      return dayAge(
        values.testAge ?? values.cubeAge ?? values.age ?? values.sampleAge,
      ) === null;
    });
  const readyMixHasResultInput =
    record.testType === "Ready Mix" &&
    evaluatedRows.some((item) => hasReadyMixResultInput(item.row));
  const readyMixWaitingForResults =
    record.testType === "Ready Mix" &&
    !readyMixHasMissingAge &&
    !readyMixHasResultInput;
  const measuredStrengths = evaluatedRows
    .map((row) => {
      const values = typeof row.row === "object" && row.row !== null
        ? row.row as Record<string, unknown>
        : {};
      if (record.testType === "Paving Blocks") {
        return numericValue(values.tensileStrength) ??
          numericValue(values.correctedStrength);
      }
      if (record.testType === "Blocks") {
        return isDammamSandwich
          ? numericValue(values.airDryStrength ?? values.dryAirStrength)
          : isDammamLocation(record.location)
            ? numericValue(values.netStrength)
            : numericValue(values.airDryStrength ?? values.dryAirStrength);
      }
      return row.calculatedStrength;
    })
    .filter((strength): strength is number => strength !== null);
  const averageStrength = measuredStrengths.length
    ? rounded(measuredStrengths.reduce((sum, strength) => sum + strength, 0) / measuredStrengths.length)
    : null;
  const minimumStrength = measuredStrengths.length ? Math.min(...measuredStrengths) : null;
  const maximumStrength = measuredStrengths.length ? Math.max(...measuredStrengths) : null;
  const hasIncompleteMeasurements =
    evaluatedRows.length === 0 ||
    evaluatedRows.some((row) => {
      if (record.testType === "Blocks") {
        const values = typeof row.row === "object" && row.row !== null
          ? row.row as Record<string, unknown>
          : {};
        return (isDammamSandwich
          ? numericValue(values.airDryStrength ?? values.dryAirStrength)
          : isDammamLocation(record.location)
            ? numericValue(values.netStrength)
            : numericValue(values.airDryStrength ?? values.dryAirStrength)) === null;
      }
      return !row.complete;
    }) ||
    (record.testType === "Blocks" &&
      (dayAge(normalizedDetails.blockAge) === null || dayAge(normalizedDetails.blockAge)! <= 0));
  const averageBelowRequired =
    requiredStrength !== null &&
    averageStrength !== null &&
    averageStrength < requiredStrength;
  const minimumBelowRequired =
    minimumRequiredStrength !== null &&
    minimumStrength !== null &&
    minimumStrength < minimumRequiredStrength - 1e-9;

  let status: StrengthEvaluationStatus = "Review";
  let reason: string | null =
    record.testType === "Ready Mix"
      ? "A complete 28-day cube result is required."
      : record.testType === "Blocks"
          ? isDammamLocation(record.location) && !isDammamSandwich
            ? "Complete specimen load, dimensions, net strength, and Block age are required."
            : "Complete specimen load, dimensions, air-dry strength, and Block age are required."
        : "Enter each paving specimen's dimensions, dry and wet weights, load, and correction factor.";
  if (!standard) {
      reason =
        record.testType === "Blocks"
          ? "No matching standard was configured for this block type and size."
          : record.testType === "Paving Blocks"
            ? "No matching standard was configured for this paving block size."
            : "No matching standard was configured for this material.";
  } else if (requiredStrength === null) {
    reason = isDammamBlock
      ? "The linked standard is missing a Dammam average-strength limit."
      : "The configured minimum strength is invalid.";
  } else if (isDammamBlock && !isDammamSandwich && minimumRequiredStrength === null) {
    reason = "The linked standard is missing a Dammam minimum specimen-strength limit.";
  } else if (readyMixHasMissingAge) {
    reason = "Enter an age for every Ready Mix specimen.";
  } else if (readyMixWaitingForResults) {
    status = "Waiting for results";
    reason = "Waiting for 28-day cube results.";
  } else if (record.testType === "Ready Mix" && hasIncompleteMeasurements) {
    reason = "Complete each 28-day cube's dimensions and load.";
  } else if (averageBelowRequired || minimumBelowRequired) {
    status = "Failed";
    reason = isDammamBlock
      ? isDammamSandwich
        ? "The average Dammam Sandwich air-dry strength is below the linked standard's limit."
        : averageBelowRequired && minimumBelowRequired
          ? "The average or minimum Dammam Net Strength is below the linked standard's limit."
          : averageBelowRequired
            ? "The average Dammam Net Strength is below the linked standard's limit."
            : "The minimum Dammam specimen Net Strength is below the linked standard's limit."
      : record.testType === "Blocks"
        ? "The average Block air-dry strength is below the configured minimum."
        : record.testType === "Paving Blocks"
          ? "The average paving block tensile strength is below the configured minimum."
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
      minimumRequiredStrength,
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
