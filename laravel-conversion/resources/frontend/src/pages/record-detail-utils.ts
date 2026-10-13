import {
  blockDimensionsFromSize,
  calculateDammamBlockResults,
  getDammamBlockThicknessDefaults,
  isSandwichBlockType,
} from "./record-form-utils";

function positiveNumber(value: unknown) {
  const parsed = typeof value === "number"
    ? value
    : Number(String(value ?? "").replace(/,/g, "").trim());
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function dammamBlockDisplayResults(
  row: unknown,
  blockSize: unknown,
  recordDetails: Record<string, unknown> = {},
) {
  const values = typeof row === "object" && row !== null
    ? row as Record<string, unknown>
    : {};
  const isSandwich = isSandwichBlockType(recordDetails.blockType);
  const dimensions = blockDimensionsFromSize(blockSize);
  const thicknessDefaults = getDammamBlockThicknessDefaults(blockSize);
  const calculated = calculateDammamBlockResults(
    {
      length: values.length || dimensions?.length || "",
      width: values.width || dimensions?.width || "",
      load: values.load ?? values.failureLoad,
    },
    blockSize,
    values.faceThickness ?? recordDetails.faceThickness ?? thicknessDefaults.faceThickness,
    values.webThickness ?? recordDetails.webThickness ?? thicknessDefaults.webThickness,
    recordDetails.blockType,
  );

  const grossArea =
    positiveNumber(values.length || dimensions?.length) !== null &&
    positiveNumber(values.width || dimensions?.width) !== null
      ? positiveNumber(values.length || dimensions?.length)! *
        positiveNumber(values.width || dimensions?.width)!
      : null;
  const storedNetArea = positiveNumber(values.netArea);

  return {
    grossArea: calculated?.grossArea ?? grossArea,
    grossStrength: calculated?.grossStrength ?? positiveNumber(values.grossStrength),
    airDryStrength: isSandwich
      ? calculated?.grossStrength === null || calculated?.grossStrength === undefined
        ? positiveNumber(values.airDryStrength ?? values.dryAirStrength) ??
          positiveNumber(values.grossStrength)
        : Math.round((calculated.grossStrength + Number.EPSILON) * 10) / 10
      : null,
    normalizedStrength: isSandwich
      ? (() => {
          const airDryStrength = calculated?.grossStrength === null ||
              calculated?.grossStrength === undefined
            ? positiveNumber(values.airDryStrength ?? values.dryAirStrength) ??
              positiveNumber(values.grossStrength)
            : Math.round((calculated.grossStrength + Number.EPSILON) * 10) / 10;
          const shapeFactor = positiveNumber(recordDetails.shapeFactor);
          return airDryStrength !== null && shapeFactor !== null
            ? Math.round((airDryStrength * shapeFactor + Number.EPSILON) * 10) / 10
            : positiveNumber(values.normalizedStrength);
        })()
      : null,
    netArea: calculated?.netArea ??
      (!isSandwich && storedNetArea !== null && (grossArea === null || storedNetArea < grossArea)
        ? storedNetArea
        : null),
    netStrength: isSandwich ? null : calculated?.netStrength ?? positiveNumber(values.netStrength),
  };
}

export function summarizeDammamBlockAirDryStrengths(
  rows: unknown[],
  blockSize: unknown,
  recordDetails: Record<string, unknown> = {},
) {
  const strengths = rows
    .map((row) => dammamBlockDisplayResults(row, blockSize, recordDetails).airDryStrength)
    .filter((strength): strength is number => strength !== null);

  if (strengths.length === 0) {
    return { average: null, minimum: null, maximum: null };
  }

  return {
    average: strengths.reduce((total, strength) => total + strength, 0) / strengths.length,
    minimum: Math.min(...strengths),
    maximum: Math.max(...strengths),
  };
}

export function summarizeDammamBlockNetStrengths(
  rows: unknown[],
  blockSize: unknown,
  recordDetails: Record<string, unknown> = {},
) {
  const strengths = rows
    .map((row) => dammamBlockDisplayResults(row, blockSize, recordDetails).netStrength)
    .filter((strength): strength is number => strength !== null);

  if (strengths.length === 0) {
    return { average: null, minimum: null, maximum: null };
  }

  return {
    average: strengths.reduce((total, strength) => total + strength, 0) / strengths.length,
    minimum: Math.min(...strengths),
    maximum: Math.max(...strengths),
  };
}
