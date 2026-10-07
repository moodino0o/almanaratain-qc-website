import {
  blockDimensionsFromSize,
  calculateDammamBlockResults,
  getDammamBlockThicknessDefaults,
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
  );

  const grossArea =
    positiveNumber(values.length || dimensions?.length) !== null &&
    positiveNumber(values.width || dimensions?.width) !== null
      ? positiveNumber(values.length || dimensions?.length)! *
        positiveNumber(values.width || dimensions?.width)!
      : null;
  const storedNetArea = positiveNumber(values.netArea);

  return {
    netArea: calculated?.netArea ??
      (storedNetArea !== null && (grossArea === null || storedNetArea < grossArea)
        ? storedNetArea
        : null),
    netStrength: calculated?.netStrength ?? positiveNumber(values.netStrength),
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
