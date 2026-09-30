import { TestType, type QcRecord } from "@workspace/api-client-react";

export const BLOCK_RECORD_MATERIAL = "Concrete Block";

export const AGGREGATE_CHEMISTRY_FIELDS = [
  { key: "silverNitrateContent", label: "Silver Nitrate Content" },
  { key: "firstChlorideTitrationPoint", label: "1st Cl titration point" },
  { key: "secondChlorideTitrationPoint", label: "2nd Cl titration point" },
  { key: "crucibleWeight", label: "Crucible Weight (g)" },
  { key: "crucibleAshWeight", label: "Cruc. + Ash weight (g)" },
  { key: "wetSiltWeight", label: "Wet Silt Weight (g)" },
  { key: "drySiltWeight", label: "Dry Silt Weight (g)" },
] as const;

export const AGGREGATE_CHLORIDE_LIMIT_PERCENT = 0.06;
export const AGGREGATE_SULPHATE_LIMIT_PERCENT = 0.4;
export const SIEVE_SILT_LIMIT_PERCENT = 3;

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
  tensileStrength: string;
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
  tensileStrength: "",
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

export const createDefaultTestRows = (
  testType: QcRecord["testType"],
  firstId = 1,
): TestRow[] => {
  const readyMixAges = testType === TestType.Ready_Mix
    ? ["7", "7", "28", "28"]
    : null;
  const rowCount = readyMixAges?.length ??
    (testType === TestType.Blocks || testType === TestType.Paving_Blocks ? 5 : 1);

  return Array.from({ length: rowCount }, (_, index) => ({
    ...createEmptyRow(firstId + index),
    ...(readyMixAges ? { testAge: readyMixAges[index] } : {}),
  }));
};

export const getReadyMixReferenceNumberError = (value: string): string | null => {
  const referenceNumber = value.trim();
  if (!referenceNumber) return "Reference Number is required.";
  return /^[SH]\.\s*\d+/i.test(referenceNumber)
    ? null
    : "Reference Number must start with S. or H. followed by a number.";
};

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

export const calculateRetainedPercentage = (
  amountReturned: unknown,
  sampleWeight: unknown,
) => {
  const retained = finiteNumericValue(amountReturned);
  const total = finiteNumericValue(sampleWeight);
  if (
    retained === null ||
    total === null ||
    retained < 0 ||
    total <= 0 ||
    retained > total
  ) {
    return "";
  }
  return ((retained / total) * 100).toFixed(2);
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

export const findSieveEvaluationCriterion = (
  evaluation: unknown,
  sieveSize: unknown,
): Record<string, unknown> | null => {
  if (typeof evaluation !== "object" || evaluation === null) return null;
  const criteria = (evaluation as Record<string, unknown>).criteria;
  if (!Array.isArray(criteria)) return null;
  const normalizedSize = stringValue(sieveSize)
    .trim()
    .toLocaleLowerCase()
    .replace(/\s+/g, "");
  return (
    criteria.find((criterion) => {
      if (typeof criterion !== "object" || criterion === null) return false;
      return stringValue((criterion as Record<string, unknown>).sieveSize)
        .trim()
        .toLocaleLowerCase()
        .replace(/\s+/g, "") === normalizedSize;
    }) as Record<string, unknown> | undefined
  ) ?? null;
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

export const calculateMoistureContent = (dryWeight: unknown, wetWeight: unknown) =>
  calculateWaterAbsorption(dryWeight, wetWeight);

const finiteNumericValue = (value: unknown) => {
  const valueText = numericInputValue(value);
  if (!valueText) return null;
  const numericValue = Number(valueText);
  return Number.isFinite(numericValue) ? numericValue : null;
};

export const calculateSiltContent = (
  siltBefore: unknown,
  siltAfter: unknown,
): number | null => {
  const before = finiteNumericValue(siltBefore);
  const after = finiteNumericValue(siltAfter);
  if (before === null || after === null || before <= 0) return null;

  const content = ((before - after) / before) * 100;
  return Number.isFinite(content) ? content : null;
};

export const evaluateSiltContent = (
  content: number | null,
  maximumExclusive = SIEVE_SILT_LIMIT_PERCENT,
): "Pass" | "Fail" | "Pending" =>
  content === null ? "Pending" : content < maximumExclusive ? "Pass" : "Fail";

export const calculateChlorideContent = (
  silverNitrateContent: unknown,
  firstTitrationPoint: unknown,
  secondTitrationPoint: unknown,
): number | null => {
  const silverNitrate = finiteNumericValue(silverNitrateContent);
  const firstPoint = finiteNumericValue(firstTitrationPoint);
  const secondPoint = finiteNumericValue(secondTitrationPoint);
  if (silverNitrate === null || firstPoint === null || secondPoint === null) {
    return null;
  }

  const content =
    0.07092 *
    (silverNitrate - 10 * 0.1 * (secondPoint - firstPoint));
  return Number.isFinite(content) ? content : null;
};

export const calculateSulphateContent = (
  crucibleWeight: unknown,
  crucibleAshWeight: unknown,
): number | null => {
  const crucible = finiteNumericValue(crucibleWeight);
  const crucibleWithAsh = finiteNumericValue(crucibleAshWeight);
  if (crucible === null || crucibleWithAsh === null) return null;

  const content = ((crucibleWithAsh - crucible) * 34.3) / 3;
  return Number.isFinite(content) ? content : null;
};

export const evaluateContentAgainstLimit = (
  content: number | null,
  maximum: number,
): "Pass" | "Fail" | "Pending" =>
  content === null ? "Pending" : content > maximum ? "Fail" : "Pass";

export const evaluateSieveValue = (
  value: unknown,
  minimum: unknown,
  maximum: unknown,
): "Pass" | "Fail" | "Pending" => {
  const measured = finiteNumericValue(value);
  const lower = finiteNumericValue(minimum);
  const upper = finiteNumericValue(maximum);
  if (measured === null || (lower === null && upper === null)) return "Pending";
  return (lower === null || measured >= lower) &&
    (upper === null || measured <= upper)
    ? "Pass"
    : "Fail";
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
  locationValue?: unknown,
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
  const location = stringValue(locationValue).trim().toLocaleLowerCase();
  const airDryFactor = location === "dammam" ? 1 : 1.2;
  const airDryStrength =
    Math.round((waterStrength * airDryFactor + Number.EPSILON) * 10) / 10;
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

export const blockAirDryRowStrength = (
  row: unknown,
  locationValue?: unknown,
): number | null => {
  const values = typeof row === "object" && row !== null
    ? row as Record<string, unknown>
    : {};
  const firstNumericValue = (keys: string[]) => {
    for (const key of keys) {
      const candidate = Number.parseFloat(String(values[key] ?? ""));
      if (Number.isFinite(candidate)) return candidate;
    }
    return null;
  };
  const waterStrength = firstNumericValue([
    "waterStrength",
    "calculatedStrength",
    "strength",
    "compressiveStrength",
  ]);
  const isDammam = String(locationValue ?? "").trim().toLocaleLowerCase() === "dammam";
  if (isDammam && waterStrength !== null) return waterStrength;

  const storedAirDryStrength = firstNumericValue([
    "airDryStrength",
    "dryAirStrength",
  ]);
  if (storedAirDryStrength !== null) return storedAirDryStrength;
  if (waterStrength === null) return null;
  return Math.round((waterStrength * 1.2 + Number.EPSILON) * 10) / 10;
};

export const pavingCorrectionFactorFromSize = (value: unknown) => {
  const text = stringValue(value).trim();
  if (/(?:^|[^0-9])60\s*(?:mm)?$/i.test(text)) return "0.87";
  if (/(?:^|[^0-9])80\s*(?:mm)?$/i.test(text)) return "1";
  return "";
};

export const calculatePavingStrengths = (
  row: Pick<TestRow, "length" | "height" | "load"> &
    Partial<Pick<TestRow, "compressiveStrength" | "tensileStrength">>,
  correctionFactorValue: unknown,
) => {
  const length = Number(numericInputValue(row.length));
  const height = Number(numericInputValue(row.height));
  const loadText = numericInputValue(row.load);
  const directTensileText = numericInputValue(row.tensileStrength);
  const directRawStrengthText = numericInputValue(row.compressiveStrength);
  const load = Number(loadText);
  const directTensileStrength = Number(directTensileText);
  const directRawStrength = Number(directRawStrengthText);
  const hasLoadBasedStrength =
    Boolean(loadText) &&
    Number.isFinite(load) &&
    load >= 0 &&
    length > 0 &&
    height > 0;
  const rawStrength =
    hasLoadBasedStrength
      ? (0.637 * load * 1000) / (length * height)
      : directRawStrengthText &&
          Number.isFinite(directRawStrength) &&
          directRawStrength >= 0
        ? directRawStrength
        : directTensileText &&
            Number.isFinite(directTensileStrength) &&
            directTensileStrength >= 0
          ? directTensileStrength
        : null;
  const correctionText = numericInputValue(correctionFactorValue);
  const correctionFactor = Number(correctionText);
  const correctedStrength =
    !hasLoadBasedStrength && directTensileText
      ? directTensileStrength
      : rawStrength !== null &&
          correctionText &&
          Number.isFinite(correctionFactor) &&
          correctionFactor >= 0
        ? Math.round((rawStrength * correctionFactor + Number.EPSILON) * 100) / 100
        : null;

  return {
    tensileStrength: correctedStrength === null ? "" : correctedStrength.toFixed(2),
    correctedStrength: correctedStrength === null ? "" : correctedStrength.toFixed(2),
  };
};

export const sieveSizeNumber = (value: string) => {
  const parsed = Number(numericInputValue(value));
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
};

const SAND_SIEVE_PORE_SIZES = [5, 2.36, 1.18, 0.6, 0.3, 0.15, 0.075, 0] as const;
const DUST_SIEVE_PORE_SIZES = [10, ...SAND_SIEVE_PORE_SIZES] as const;
const COARSE_AGGREGATE_PORE_SIZES = [20, 14, 10, 6.3, 5, 2.36, 0] as const;

const sievePoreSizeWhitelist = (testType: unknown, material: unknown): readonly number[] | null => {
  const normalizedTestType = stringValue(testType).trim();
  const normalizedMaterial = stringValue(material).trim().toLocaleLowerCase();
  if (normalizedTestType === "Sand Sieve") {
    return normalizedMaterial === "dust"
      ? DUST_SIEVE_PORE_SIZES
      : SAND_SIEVE_PORE_SIZES;
  }

  if (normalizedTestType === "Aggregate Sieve") {
    if (/\b(?:10|20)\s*mm\b/.test(normalizedMaterial)) {
      return COARSE_AGGREGATE_PORE_SIZES;
    }
    if (/\b2\s*[-–]\s*5\s*mm\b/.test(normalizedMaterial)) {
      return SAND_SIEVE_PORE_SIZES;
    }
  }

  return null;
};

export const isSievePoreSizeAllowed = (
  testType: unknown,
  material: unknown,
  sieveSize: unknown,
) => {
  const allowedSizes = sievePoreSizeWhitelist(testType, material);
  if (!allowedSizes) return true;

  const sizeText = numericInputValue(sieveSize);
  if (!sizeText) return false;
  const size = Number(sizeText);
  return Number.isFinite(size) && allowedSizes.some((allowedSize) => allowedSize === size);
};

export const filterSieveSizeItems = <T extends { value: string }>(
  items: T[],
  testType: unknown,
  material: unknown,
) => items.filter((item) => isSievePoreSizeAllowed(testType, material, item.value));

export const sortSieveRowsByPoreSize = <T>(
  rows: T[],
  getSieveSize: (row: T) => unknown,
) =>
  rows
    .map((row, index) => ({
      row,
      index,
      size: sieveSizeNumber(String(getSieveSize(row) ?? "")),
    }))
    .sort((left, right) =>
      left.size === right.size
        ? left.index - right.index
        : right.size - left.size,
    )
    .map(({ row }) => row);

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

export const applySizeDimensionDefaults = <T extends BlockDimensions>(
  row: T,
  nextDimensions: BlockDimensions,
  previousDimensions: BlockDimensions | null,
): T => {
  const matchesPreviousDefaults = Boolean(
    previousDimensions &&
    row.length === previousDimensions.length &&
    row.width === previousDimensions.width &&
    row.height === previousDimensions.height,
  );
  const hasDimensions = Boolean(row.length || row.width || row.height);

  if (hasDimensions && !matchesPreviousDefaults) {
    return {
      ...row,
      length: row.length || nextDimensions.length,
      width: row.width || nextDimensions.width,
      height: row.height || nextDimensions.height,
    };
  }

  return { ...row, ...nextDimensions };
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
    tensileStrength: numericInputValue(
      values.tensileStrength ?? values.correctedStrength ?? values.strength,
    ),
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
      : createDefaultTestRows(record.testType),
  };
};