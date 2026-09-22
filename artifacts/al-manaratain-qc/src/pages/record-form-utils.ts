import type { QcRecord } from "@workspace/api-client-react";

export type TestRow = {
  id: number;
  length: string;
  width: string;
  height: string;
  dryWeight: string;
  wetWeight: string;
  weight: string;
  sampleAge: string;
  testAge: string;
  load: string;
  strength: string;
  airDryStrength: string;
  normalizedStrength: string;
  compressiveStrength: string;
  correctionFactor: string;
  correctedStrength: string;
  density: string;
  waterAbsorption: string;
  sieveSize: string;
  sieveSizeReferenceItemId: number | null;
  amountReturned: string;
  passingAmount: string;
  passingPercentage: string;
};

export type RecordFormValues = {
  testType: QcRecord["testType"];
  sampleDate: string;
  location: string;
  material: string;
  testedBy: string;
  remarks: string;
  referenceNumber: string;
  customerName: string;
  customerLocation: string;
  machine: string;
  selectedStrengthStandardId: string;
  details: Record<string, unknown>;
  testRows: TestRow[];
};

export type BlockDimensions = {
  length: string;
  width: string;
  height: string;
};

const NUMERIC_DETAIL_KEYS = [
  "slump",
  "temperature",
  "weight",
  "sampleWeight",
  "dryWeight",
  "wetWeight",
  "length",
  "width",
  "height",
  "compressiveStrength",
  "passing10mm",
  "passing5mm",
  "finenessModulus",
  "moisture",
];

export const createEmptyRow = (id: number): TestRow => ({
  id,
  length: "",
  width: "",
  height: "",
  dryWeight: "",
  wetWeight: "",
  weight: "",
  sampleAge: "",
  testAge: "",
  load: "",
  strength: "",
  airDryStrength: "",
  normalizedStrength: "",
  compressiveStrength: "",
  correctionFactor: "",
  correctedStrength: "",
  density: "",
  waterAbsorption: "",
  sieveSize: "",
  sieveSizeReferenceItemId: null,
  amountReturned: "",
  passingAmount: "",
  passingPercentage: "",
});

export const stringValue = (value: unknown) => (value == null ? "" : String(value));

export const numericInputValue = (value: unknown) => {
  const match = stringValue(value).match(/[-+]?(?:\d+\.?\d*|\.\d+)/);
  return match?.[0] ?? "";
};

export const calculateSieveSampleWeight = (
  rows: Array<Pick<TestRow, "amountReturned">>,
) => {
  let sampleWeight = 0;
  for (const row of rows) {
    const amountReturnedText = numericInputValue(row.amountReturned);
    const amountReturned = Number(amountReturnedText);
    if (amountReturnedText && Number.isFinite(amountReturned) && amountReturned >= 0) {
      sampleWeight += amountReturned;
    }
  }
  return sampleWeight;
};

export const calculateSieveResults = (
  rows: Array<Pick<TestRow, "amountReturned">>,
) => {
  const sampleWeight = calculateSieveSampleWeight(rows);
  let cumulativeReturned = 0;
  let measurementsValid = Number.isFinite(sampleWeight) && sampleWeight > 0;

  return rows.map((row) => {
    const amountReturnedText = numericInputValue(row.amountReturned);
    const amountReturned = Number(amountReturnedText);
    if (!amountReturnedText) {
      return { passingAmount: "", passingPercentage: "" };
    }
    if (
      !measurementsValid ||
      !Number.isFinite(amountReturned) ||
      amountReturned < 0
    ) {
      measurementsValid = false;
      return { passingAmount: "", passingPercentage: "" };
    }

    cumulativeReturned += amountReturned;
    if (cumulativeReturned > sampleWeight) {
      measurementsValid = false;
      return { passingAmount: "", passingPercentage: "" };
    }

    const passingAmount = sampleWeight - cumulativeReturned;
    return {
      passingAmount: passingAmount.toFixed(2),
      passingPercentage: ((passingAmount / sampleWeight) * 100).toFixed(2),
    };
  });
};

export const calculateWaterAbsorption = (dryWeight: unknown, wetWeight: unknown) => {
  const dry = Number(numericInputValue(dryWeight));
  const wet = Number(numericInputValue(wetWeight));
  if (
    !numericInputValue(dryWeight) ||
    !numericInputValue(wetWeight) ||
    !Number.isFinite(dry) ||
    !Number.isFinite(wet) ||
    dry <= 0
  ) {
    return "";
  }
  return (((wet - dry) / dry) * 100).toFixed(2);
};

export const calculateBlockDensity = ({
  length,
  width,
  height,
  wetWeight,
}: Pick<TestRow, "length" | "width" | "height" | "wetWeight">) => {
  const lengthValue = Number(numericInputValue(length));
  const widthValue = Number(numericInputValue(width));
  const heightValue = Number(numericInputValue(height));
  const wetWeightValue = Number(numericInputValue(wetWeight));
  if (
    !numericInputValue(length) ||
    !numericInputValue(width) ||
    !numericInputValue(height) ||
    !numericInputValue(wetWeight) ||
    ![lengthValue, widthValue, heightValue, wetWeightValue].every(Number.isFinite) ||
    lengthValue <= 0 ||
    widthValue <= 0 ||
    heightValue <= 0 ||
    wetWeightValue < 0
  ) {
    return "";
  }
  return (
    (wetWeightValue * 1_000_000_000) /
    (lengthValue * widthValue * heightValue)
  ).toFixed(2);
};

export const calculateBlockStrengths = (
  row: Pick<TestRow, "length" | "width" | "load">,
  shapeFactorValue: unknown,
) => {
  const length = Number(numericInputValue(row.length));
  const width = Number(numericInputValue(row.width));
  const load = Number(numericInputValue(row.load));
  if (
    !numericInputValue(row.length) ||
    !numericInputValue(row.width) ||
    !numericInputValue(row.load) ||
    ![length, width, load].every(Number.isFinite) ||
    length <= 0 ||
    width <= 0 ||
    load < 0
  ) {
    return { waterStrength: "", airDryStrength: "", normalizedStrength: "" };
  }

  const waterStrength = (load * 1000) / (length * width);
  const airDryStrength = Math.round((waterStrength * 1.2 + Number.EPSILON) * 10) / 10;
  const shapeFactorText = numericInputValue(shapeFactorValue);
  const shapeFactor = Number(shapeFactorText);
  const normalizedStrength =
    shapeFactorText && Number.isFinite(shapeFactor) && shapeFactor > 0
      ? Math.round((airDryStrength * shapeFactor + Number.EPSILON) * 10) / 10
      : null;

  return {
    waterStrength: waterStrength.toFixed(2),
    airDryStrength: airDryStrength.toFixed(1),
    normalizedStrength: normalizedStrength === null ? "" : normalizedStrength.toFixed(1),
  };
};

export const pavingCorrectionFactorFromSize = (value: unknown) => {
  const text = stringValue(value).trim();
  if (/(?:^|[^0-9])60\s*(?:mm)?$/i.test(text)) return "0.87";
  if (/(?:^|[^0-9])80\s*(?:mm)?$/i.test(text)) return "1";
  return "";
};

export const calculatePavingStrengths = (
  row: Pick<TestRow, "length" | "width" | "load" | "compressiveStrength">,
  correctionFactorValue: unknown,
) => {
  const length = Number(numericInputValue(row.length));
  const width = Number(numericInputValue(row.width));
  const loadText = numericInputValue(row.load);
  const directStrengthText = numericInputValue(row.compressiveStrength);
  const load = Number(loadText);
  const directStrength = Number(directStrengthText);
  const rawStrength =
    loadText && Number.isFinite(load) && load >= 0 && length > 0 && width > 0
      ? (load * 1000) / (length * width)
      : directStrengthText && Number.isFinite(directStrength) && directStrength >= 0
        ? directStrength
        : null;
  const correctionText = numericInputValue(correctionFactorValue);
  const correctionFactor = Number(correctionText);
  const correctedStrength =
    rawStrength !== null &&
    correctionText &&
    Number.isFinite(correctionFactor) &&
    correctionFactor >= 0
      ? Math.round((rawStrength * correctionFactor + Number.EPSILON) * 100) / 100
      : null;

  return {
    compressiveStrength: rawStrength === null ? "" : rawStrength.toFixed(2),
    correctedStrength: correctedStrength === null ? "" : correctedStrength.toFixed(2),
  };
};

export const sieveSizeNumber = (value: string) => {
  const parsed = Number(numericInputValue(value));
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
};

export const blockDimensionsFromSize = (value: unknown): BlockDimensions | null => {
  const text = stringValue(value).trim();
  if (!text) return null;

  const dimensionParts = text.match(/\d+(?:\.\d+)?/g);
  if (dimensionParts && /[*x×]/i.test(text) && dimensionParts.length >= 3) {
    const dimensions = dimensionParts.slice(0, 3);
    if (dimensions.every((dimension) => Number(dimension) > 0)) {
      return {
        length: dimensions[0],
        width: dimensions[1],
        height: dimensions[2],
      };
    }
  }

  const inchSize = text.match(/^(4|6|8|12)\s*(?:"|''|inches?|in)?$/i)?.[1];
  if (!inchSize) return null;
  const widthByInchSize: Record<string, string> = {
    "4": "100",
    "6": "150",
    "8": "200",
    "12": "300",
  };
  return {
    length: "400",
    width: widthByInchSize[inchSize],
    height: "200",
  };
};

const normalizedBlockType = (value: unknown) => {
  const text = stringValue(value)
    .trim()
    .toLocaleLowerCase()
    .replace(/''/g, '"')
    .replace(/\s+/g, " ");
  if (/^(plain|lined|sandwich insulation) block$/.test(text)) return text;
  const legacyType = text.match(
    /^(?:4|6|8|12)\s*(?:"|inches?|in)?\s+(plain|lined|sandwich insulation)\s+block$/,
  );
  return legacyType ? `${legacyType[1]} block` : text;
};

export const blockTypeMatches = (left: unknown, right: unknown) =>
  Boolean(normalizedBlockType(left)) && normalizedBlockType(left) === normalizedBlockType(right);

export const blockSizeMatches = (left: unknown, right: unknown) => {
  const leftText = stringValue(left).trim().toLocaleLowerCase().replace(/\s+/g, "");
  const rightText = stringValue(right).trim().toLocaleLowerCase().replace(/\s+/g, "");
  if (leftText && leftText === rightText) return true;
  const leftDimensions = blockDimensionsFromSize(left);
  const rightDimensions = blockDimensionsFromSize(right);
  if (!leftDimensions || !rightDimensions) return false;
  return (
    leftDimensions.length === rightDimensions.length &&
    leftDimensions.width === rightDimensions.width &&
    leftDimensions.height === rightDimensions.height
  );
};

export const blockMaterialMatches = (
  standardMaterial: unknown,
  recordMaterial: unknown,
  recordBlockType: unknown,
) => {
  const standard = stringValue(standardMaterial).trim().toLocaleLowerCase();
  const record = stringValue(recordMaterial).trim().toLocaleLowerCase();
  return standard === record ||
    (standard === "concrete block" && blockTypeMatches(recordMaterial, recordBlockType));
};

export const toFormRow = (row: unknown, id: number): TestRow => {
  const values = typeof row === "object" && row !== null ? row as Record<string, unknown> : {};
  return {
    id,
    length: numericInputValue(values.length),
    width: numericInputValue(values.width),
    height: numericInputValue(values.height),
    dryWeight: numericInputValue(values.dryWeight),
    wetWeight: numericInputValue(values.wetWeight),
    weight: numericInputValue(values.weight),
    sampleAge: numericInputValue(values.sampleAge),
    testAge: numericInputValue(values.testAge),
    load: numericInputValue(values.load),
    strength: numericInputValue(values.strength ?? values.calculatedStrength ?? values.compressiveStrength),
    airDryStrength: numericInputValue(values.airDryStrength ?? values.dryAirStrength),
    normalizedStrength: numericInputValue(values.normalizedStrength),
    compressiveStrength: numericInputValue(
      values.compressiveStrength ?? values.strength ?? values.calculatedStrength,
    ),
    correctionFactor: numericInputValue(values.correctionFactor),
    correctedStrength: numericInputValue(values.correctedStrength),
    density: numericInputValue(values.density ?? values.densityKgM3),
    waterAbsorption: calculateWaterAbsorption(values.dryWeight, values.wetWeight),
    sieveSize: stringValue(values.sieveSize),
    sieveSizeReferenceItemId: numericInputValue(values.sieveSizeReferenceItemId)
      ? Number(numericInputValue(values.sieveSizeReferenceItemId))
      : null,
    amountReturned: numericInputValue(values.amountReturned),
    passingAmount: numericInputValue(values.passingAmount),
    passingPercentage: numericInputValue(values.passingPercentage),
  };
};

const cloneDetails = (details: unknown): Record<string, unknown> => {
  if (typeof details !== "object" || details === null) return {};
  return structuredClone(details as Record<string, unknown>);
};

export const prepareDetailsForForm = (details: unknown) => {
  const formDetails = cloneDetails(details);
  for (const key of NUMERIC_DETAIL_KEYS) {
    if (key in formDetails) formDetails[key] = numericInputValue(formDetails[key]);
  }

  const sourceRows = Array.isArray(formDetails.sieveRows)
    ? formDetails.sieveRows
    : Array.isArray(formDetails.testRows)
      ? formDetails.testRows
      : [];

  return {
    details: formDetails,
    sourceRows,
  };
};

export const prepareRecordForForm = (record: QcRecord): RecordFormValues => {
  const { details, sourceRows } = prepareDetailsForForm(record.details);
  return {
    testType: record.testType,
    sampleDate: record.sampleDate.slice(0, 10),
    location: record.location,
    material: record.material,
    testedBy: record.testedBy,
    remarks: record.remarks ?? "",
    referenceNumber: stringValue(details.referenceNumber),
    customerName: stringValue(details.customerName),
    customerLocation: stringValue(details.customerLocation),
    machine: stringValue(details.machine),
    selectedStrengthStandardId: stringValue(details.strengthStandardId),
    details,
    testRows: sourceRows.length
      ? sourceRows.map((row, index) => toFormRow(row, index + 1))
      : [createEmptyRow(1)],
  };
};