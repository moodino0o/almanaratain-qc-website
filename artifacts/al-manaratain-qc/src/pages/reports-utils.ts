import type {
  DailyReadyMixResult,
  DailyReadyMixStrengthSummary,
  QcRecord,
} from "@workspace/api-client-react";
import { filterRowsWithLoad } from "./report-print-utils";
import { dammamBlockDisplayResults } from "./record-detail-utils";
import { isSandwichBlockType } from "./record-form-utils";

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

export type DailyStrengthTableRow = {
  mixDesign: string;
  plant: string;
  cubeAge: number;
  averageStrength: number;
  minimumStrength: number;
  maximumStrength: number;
  strengthUnit: string;
};

export type DailyReportRow = {
  date: string;
  castingDate: string;
  testingDate: string;
  category: string;
  status: "Passed" | "Failed" | null;
  plant: string;
  machineType: string;
  product: string;
  cubeAge: number | null;
  averageStrength: number;
  minimumStrength: number;
  maximumStrength: number;
  standardDeviation: number | null;
  strengthUnit: string;
};

export type DailyReportProductOption = {
  key: string;
  category: string;
  product: string;
};

export type RecordStrengthSummary = {
  averageStrength: number;
  minimumStrength: number;
  maximumStrength: number;
};

export type DailyReadyMixReferenceFilter = "site" | "plant" | null;

type StrengthGroup = {
  date: string;
  castingDate: string;
  testingDate: string;
  category: string;
  plant: string;
  machineType: string;
  product: string;
  cubeAge: number | null;
  strengths: number[];
  statuses: QcRecord["status"][];
  strengthUnit: string;
};

const numericValue = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const parsed = Number.parseFloat(value.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
};
const isDammamLocation = (location: string) => {
  const normalizedLocation = location.trim().toLocaleLowerCase().replace(/\s+/g, " ");
  return normalizedLocation === "dammam" || normalizedLocation === "dammam plant";
};

const firstNumericValue = (values: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const parsed = numericValue(values[key]);
    if (parsed !== null) return parsed;
  }
  return null;
};

const populationStandardDeviation = (values: number[]) => {
  if (values.length < 2) return null;
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + ((value - average) ** 2), 0) / values.length;
  return Math.sqrt(variance);
};

const detailsValue = (details: Record<string, unknown>, keys: string[]) => {
  const normalized = new Map(
    Object.entries(details).map(([key, value]) => [key.toLowerCase(), value]),
  );
  for (const key of keys) {
    const value = normalized.get(key.toLowerCase());
    if (value !== undefined && value !== null && value !== "") return String(value).trim();
  }
  return "";
};

export function firstWords(value: string, count: number) {
  return value.trim().split(/\s+/).filter(Boolean).slice(0, count).join(" ") || "Unspecified";
}

const addDays = (value: string, days: number) => {
  const date = new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

const dateOnly = (value: unknown) => {
  const match = String(value ?? "").trim().match(/^\d{4}-\d{2}-\d{2}/);
  return match?.[0] ?? "";
};

const recordProduct = (record: QcRecord, details: Record<string, unknown>) => {
  if (record.testType === "Ready Mix") {
    return firstWords(detailsValue(details, ["designStrength", "mixStrength", "mixType"]) || record.material, 3);
  }
  if (record.testType === "Blocks") {
    return detailsValue(details, ["productName", "blockType"]) || String(record.material ?? "").trim() || "Unspecified";
  }
  if (record.testType === "Paving Blocks") {
    return detailsValue(details, ["productName", "product"]) || String(record.material ?? "").trim() || "Unspecified";
  }
  return firstWords(
    detailsValue(details, ["blockType", "blockSize", "sampleType", "sieveSize", "materialCondition"])
      || record.material,
    2,
  );
};

const recordAge = (record: QcRecord, details: Record<string, unknown>) => {
  const ageKey =
    record.testType === "Blocks" || record.testType === "Paving Blocks"
      ? "blockAge"
      : record.testType === "Sand Sieve" || record.testType === "Aggregate Sieve"
        ? "sampleAge"
        : null;
  if (!ageKey) return null;
  const configuredAge = numericValue(detailsValue(details, [ageKey]));
  if (configuredAge !== null && configuredAge > 0) return configuredAge;
  const rows = Array.isArray(details.testRows) ? details.testRows : [];
  return rows.reduce<number | null>((age, row) => {
    if (age !== null || typeof row !== "object" || row === null) return age;
    const rowAge = numericValue((row as Record<string, unknown>).sampleAge);
    return rowAge !== null && rowAge > 0 ? rowAge : null;
  }, null);
};

const rowStrength = (row: unknown, testType: QcRecord["testType"]) => {
  if (typeof row !== "object" || row === null) return null;
  const values = row as Record<string, unknown>;
  const strengthKeys = testType === "Ready Mix"
    ? ["calculatedStrength", "strength", "compressiveStrength"]
    : testType === "Paving Blocks"
      ? ["tensileStrength", "correctedStrength", "calculatedStrength", "strength", "compressiveStrength"]
      : [
          "correctedStrength",
          "normalizedStrength",
          "airDryStrength",
          "calculatedStrength",
          "strength",
          "compressiveStrength",
        ];
  return firstNumericValue(values, strengthKeys);
};

const blockSummaryStrength = (row: unknown) => {
  if (typeof row !== "object" || row === null) return null;
  const values = row as Record<string, unknown>;
  const waterStrength = firstNumericValue(values, [
    "waterStrength",
    "calculatedStrength",
    "strength",
    "compressiveStrength",
  ]);
  const storedAirDryStrength = firstNumericValue(values, ["airDryStrength", "dryAirStrength"]);
  if (storedAirDryStrength !== null) return storedAirDryStrength;
  if (waterStrength === null) return null;
  return Number((waterStrength * 1.2).toFixed(1));
};

const recordStrengths = (record: QcRecord, details: Record<string, unknown>) => {
  const savedRows = Array.isArray(details.testRows) ? details.testRows : [];
  if (record.testType === "Blocks" && isDammamLocation(record.location)) {
    // Recalculate from geometry/load, not stale air-dry or generic evaluation averages.
    // The register, daily table and workbook share this same result source.
    const specimens = filterRowsWithLoad((savedRows.length ? savedRows : [details]).map((row) => {
      const values = typeof row === "object" && row !== null ? row as Record<string, unknown> : {};
      return { ...values, load: values.load ?? values.failureLoad };
    }));
    const isSandwich = isSandwichBlockType(details.blockType);
    const strengths = specimens
      .map((row) => {
        const results = dammamBlockDisplayResults(row, details.blockSize, details);
        return isSandwich ? results.airDryStrength : results.netStrength;
      })
      .filter((value): value is number => value !== null);
    if (savedRows.length || strengths.length) return strengths;
    if (isSandwich) {
      const explicitlyAirDry = firstNumericValue(details, ["averageStrength", "airDryStrength"]);
      return explicitlyAirDry === null ? [] : [explicitlyAirDry];
    }
    const explicitlyNet = firstNumericValue(details, ["averageNetStrength", "netStrength"]);
    return explicitlyNet === null ? [] : [explicitlyNet];
  }
  const loadRequired =
    record.testType === "Ready Mix" ||
    record.testType === "Blocks" ||
    record.testType === "Paving Blocks";
  const rows = loadRequired ? filterRowsWithLoad(savedRows) : savedRows;
  const strengths = rows
    .map((row) => record.testType === "Blocks"
      ? blockSummaryStrength(row)
      : rowStrength(row, record.testType))
    .filter((value): value is number => value !== null);
  if (strengths.length) return strengths;
  if (loadRequired && savedRows.length > 0 && rows.length === 0) return [];
  const directStrengthKeys = record.testType === "Ready Mix"
    ? ["averageStrength", "calculatedStrength", "strength", "compressiveStrength"]
    : record.testType === "Blocks"
      ? ["averageStrength", "airDryStrength", "dryAirStrength", "calculatedStrength", "strength", "compressiveStrength"]
      : record.testType === "Paving Blocks"
        ? [
            "averageStrength",
              "tensileStrength",
            "correctedStrength",
            "calculatedStrength",
            "compressiveStrength",
            "strength",
          ]
        : [
            "averageStrength",
            "correctedStrength",
            "normalizedStrength",
            "airDryStrength",
            "calculatedStrength",
            "strength",
            "compressiveStrength",
          ];
  const directStrength = firstNumericValue(details, directStrengthKeys);
  if (directStrength === null) return [];
  if (
    record.testType !== "Blocks" ||
    isDammamLocation(record.location) ||
    firstNumericValue(details, ["averageStrength", "airDryStrength", "dryAirStrength"]) !== null
  ) {
    return [directStrength];
  }
  return [Number((directStrength * 1.2).toFixed(1))];
};

export function summarizeRecordStrengths(record: QcRecord): RecordStrengthSummary | null {
  const strengths = recordStrengths(record, record.details as Record<string, unknown>);
  if (!strengths.length) return null;
  return {
    averageStrength: strengths.reduce((sum, value) => sum + value, 0) / strengths.length,
    minimumStrength: Math.min(...strengths),
    maximumStrength: Math.max(...strengths),
  };
}

export function dailyReportProductOptions(records: QcRecord[]): DailyReportProductOption[] {
  const options = new Map<string, DailyReportProductOption>();
  for (const record of records) {
    const details = record.details as Record<string, unknown>;
    const category = record.testType;
    const product = recordProduct(record, details);
    const key = `${category}\u0000${product}`;
    options.set(key, { key, category, product });
  }
  return [...options.values()].sort(
    (left, right) =>
      left.category.localeCompare(right.category) ||
      left.product.localeCompare(right.product),
  );
}

export function buildDailyReportRows(
  records: QcRecord[],
  startDate: string,
  endDate: string,
  selectedProducts: string[] = [],
  readyMixReferenceFilter: DailyReadyMixReferenceFilter = null,
): DailyReportRow[] {
  const groups = new Map<string, StrengthGroup>();
  const selected = new Set(selectedProducts);
  const inRange = (date: string) => date >= startDate && date <= endDate;

  const addStrengths = (
    record: QcRecord,
    date: string | null,
    testingDate: string | null,
    product: string,
    cubeAge: number | null,
    strengths: number[],
  ) => {
    if (!date || !testingDate || !inRange(date) || !strengths.length) return;
    const castingDate = record.sampleDate.slice(0, 10);
    const category = record.testType;
    const details = record.details as Record<string, unknown>;
    const machineType =
      record.testType === "Blocks" || record.testType === "Paving Blocks"
        ? detailsValue(details, ["machineType", "machine"])
        : "";
    const key = `${date}\u0000${castingDate}\u0000${testingDate}\u0000${category}\u0000${record.location}\u0000${machineType}\u0000${product}\u0000${cubeAge ?? ""}`;
    if (selected.size && !selected.has(`${category}\u0000${product}`)) return;
    const current = groups.get(key) ?? {
      date,
      castingDate,
      testingDate,
      category,
      plant: record.location,
      machineType,
      product,
      cubeAge,
      strengths: [],
      statuses: [],
      strengthUnit: "N/mm²",
    };
    current.strengths.push(...strengths);
    current.statuses.push(record.status);
    groups.set(key, current);
  };

  for (const record of records) {
    const details = record.details as Record<string, unknown>;
    if (record.testType === "Ready Mix" && readyMixReferenceFilter) {
      const referenceNumber =
        detailsValue(details, ["referenceNumber"]) || record.recordNo;
      const requiredPrefix = readyMixReferenceFilter === "site" ? "S" : "H";
      if (!referenceNumber.trim().toLocaleUpperCase().startsWith(requiredPrefix)) {
        continue;
      }
    }
    const product = recordProduct(record, details);
    if (record.testType === "Ready Mix") {
      const rows = filterRowsWithLoad(
        Array.isArray(details.testRows) ? details.testRows : [],
      );
      const ageGroups = new Map<number, number[]>();
      for (const row of rows) {
        if (typeof row !== "object" || row === null) continue;
        const age = numericValue((row as Record<string, unknown>).testAge ??
          (row as Record<string, unknown>).cubeAge ??
          (row as Record<string, unknown>).age);
        const strength = rowStrength(row, record.testType);
        if (age === null || strength === null) continue;
        const current = ageGroups.get(age) ?? [];
        current.push(strength);
        ageGroups.set(age, current);
      }
      if (ageGroups.size) {
        for (const [age, strengths] of ageGroups) {
          const testingDate = addDays(record.sampleDate, age);
          addStrengths(record, testingDate, testingDate, product, age, strengths);
        }
      } else {
        const castingDate = record.sampleDate.slice(0, 10);
        addStrengths(
          record,
          castingDate,
          castingDate,
          product,
          null,
          recordStrengths(record, details),
        );
      }
      continue;
    }
    const castingDate = record.sampleDate.slice(0, 10);
    const age = recordAge(record, details);
    const testingDate =
      (age === null ? null : addDays(castingDate, age)) ||
      dateOnly(detailsValue(details, ["testingDate"])) ||
      castingDate;
    addStrengths(
      record,
      testingDate,
      testingDate,
      product,
      age,
      recordStrengths(record, details),
    );
  }

  return [...groups.values()]
    .map((group) => ({
      date: group.date,
      castingDate: group.castingDate,
      testingDate: group.testingDate,
      category: group.category,
      status: group.statuses.includes("Failed")
        ? "Failed" as const
        : group.statuses.length > 0 && group.statuses.every((status) => status === "Passed")
          ? "Passed" as const
          : null,
      plant: group.plant,
      machineType: group.machineType,
      product: group.product,
      cubeAge: group.cubeAge,
      averageStrength: group.strengths.reduce((sum, value) => sum + value, 0) / group.strengths.length,
      minimumStrength: Math.min(...group.strengths),
      maximumStrength: Math.max(...group.strengths),
      standardDeviation: populationStandardDeviation(group.strengths),
      strengthUnit: group.strengthUnit,
    }))
    .sort(
      (left, right) =>
        left.category.localeCompare(right.category) ||
        left.plant.localeCompare(right.plant) ||
        (left.category === "Ready Mix" || right.category === "Ready Mix"
          ? (left.cubeAge ?? Number.POSITIVE_INFINITY) - (right.cubeAge ?? Number.POSITIVE_INFINITY)
          : 0) ||
        left.product.localeCompare(right.product) ||
        left.date.localeCompare(right.date) ||
        (left.cubeAge ?? Number.POSITIVE_INFINITY) - (right.cubeAge ?? Number.POSITIVE_INFINITY),
    );
}

const xmlEscape = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const inlineStringCell = (reference: string, value: string, style = 0) =>
  `<c r="${reference}" t="inlineStr" s="${style}"><is><t xml:space="preserve">${xmlEscape(value)}</t></is></c>`;

const numberCell = (reference: string, value: number | null, style = 2) =>
  value === null || !Number.isFinite(value)
    ? `<c r="${reference}" s="${style}"/>`
    : `<c r="${reference}" s="${style}"><v>${value}</v></c>`;

const zipBytes = (parts: Uint8Array[]) => {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
};

const crc32 = (bytes: Uint8Array) => {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
};

const zipHeader = (
  signature: number,
  fileNameLength: number,
  dataLength: number,
  checksum: number,
  offset = 0,
) => {
  const size = signature === 0x04034b50 ? 30 : 46;
  const buffer = new ArrayBuffer(size);
  const view = new DataView(buffer);
  view.setUint32(0, signature, true);
  if (signature === 0x04034b50) {
    view.setUint16(4, 20, true);
    view.setUint16(6, 0, true);
    view.setUint16(8, 0, true);
    view.setUint16(10, 0, true);
    view.setUint16(12, 0, true);
    view.setUint32(14, checksum, true);
    view.setUint32(18, dataLength, true);
    view.setUint32(22, dataLength, true);
    view.setUint16(26, fileNameLength, true);
    view.setUint16(28, 0, true);
  } else {
    view.setUint16(4, 20, true);
    view.setUint16(6, 20, true);
    view.setUint16(8, 0, true);
    view.setUint16(10, 0, true);
    view.setUint16(12, 0, true);
    view.setUint16(14, 0, true);
    view.setUint32(16, checksum, true);
    view.setUint32(20, dataLength, true);
    view.setUint32(24, dataLength, true);
    view.setUint16(28, fileNameLength, true);
    view.setUint16(30, 0, true);
    view.setUint16(32, 0, true);
    view.setUint16(34, 0, true);
    view.setUint16(36, 0, true);
    view.setUint32(38, 0, true);
    view.setUint32(42, offset, true);
  }
  return new Uint8Array(buffer);
};

const createZip = (files: Array<{ name: string; content: string }>) => {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const name = encoder.encode(file.name);
    const data = encoder.encode(file.content);
    const checksum = crc32(data);
    const localHeader = zipHeader(0x04034b50, name.length, data.length, checksum);
    localParts.push(localHeader, name, data);
    centralParts.push(
      zipHeader(0x02014b50, name.length, data.length, checksum, offset),
      name,
    );
    offset += localHeader.length + name.length + data.length;
  }

  const local = zipBytes(localParts);
  const central = zipBytes(centralParts);
  const end = new ArrayBuffer(22);
  const endView = new DataView(end);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, files.length, true);
  endView.setUint16(10, files.length, true);
  endView.setUint32(12, central.length, true);
  endView.setUint32(16, local.length, true);
  return zipBytes([local, central, new Uint8Array(end)]);
};

export function downloadDailyReportWorkbook(rows: DailyReportRow[]) {
  if (!rows.length) return;
  const headers = ["Category", "Age (days)", "Casting Date", "Machine Type", "Plant", "Type / Mix Design", "Average", "Minimum", "Maximum", "Std. Dev."];
  const columns = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];
  const sheetRows = [
    `<row r="1">${inlineStringCell("A1", "Al Manaratain Daily QC Results", 1)}</row>`,
    `<row r="2">${inlineStringCell("A2", `Generated ${new Date().toLocaleDateString("en-GB")}`)}</row>`,
    `<row r="4">${headers.map((header, index) => inlineStringCell(`${columns[index]}4`, header, 1)).join("")}</row>`,
    ...rows.map((row, index) => {
      const rowNumber = index + 5;
      return `<row r="${rowNumber}">${
        inlineStringCell(`A${rowNumber}`, row.category) +
        (row.cubeAge === null
          ? inlineStringCell(`B${rowNumber}`, "—")
          : numberCell(`B${rowNumber}`, row.cubeAge, 0)) +
        inlineStringCell(`C${rowNumber}`, row.castingDate) +
        inlineStringCell(`D${rowNumber}`, row.machineType || "—") +
        inlineStringCell(`E${rowNumber}`, row.plant) +
        inlineStringCell(`F${rowNumber}`, row.product) +
        numberCell(`G${rowNumber}`, row.averageStrength) +
        numberCell(`H${rowNumber}`, row.minimumStrength) +
        numberCell(`I${rowNumber}`, row.maximumStrength) +
        numberCell(`J${rowNumber}`, row.standardDeviation)
      }</row>`;
    }),
  ].join("");
  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="A1:J${rows.length + 4}"/>
  <cols>
    <col min="1" max="1" width="18" customWidth="1"/>
    <col min="2" max="2" width="12" customWidth="1"/>
    <col min="3" max="3" width="14" customWidth="1"/>
    <col min="4" max="4" width="14" customWidth="1"/>
    <col min="5" max="5" width="18" customWidth="1"/>
    <col min="6" max="6" width="24" customWidth="1"/>
    <col min="7" max="10" width="15" customWidth="1"/>
  </cols>
  <sheetData>${sheetRows}</sheetData>
  <mergeCells count="1"><mergeCell ref="A1:J1"/></mergeCells>
</worksheet>`;
  const files = [
    {
      name: "[Content_Types].xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`,
    },
    {
      name: "_rels/.rels",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`,
    },
    {
      name: "xl/workbook.xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="Daily Results" sheetId="1" r:id="rId1"/></sheets>
</workbook>`,
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`,
    },
    {
      name: "xl/styles.xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2"><font><sz val="11"/><name val="Arial"/></font><font><b/><sz val="12"/><name val="Arial"/></font></fonts>
  <fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE5E7EB"/><bgColor indexed="64"/></patternFill></fill></fills>
  <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/><xf numFmtId="0" fontId="1" fillId="1" borderId="0" applyFont="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" applyNumberFormat="1"/></cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
  <numFmts count="1"><numFmt numFmtId="164" formatCode="0.0"/></numFmts>
</styleSheet>`,
    },
    { name: "xl/worksheets/sheet1.xml", content: sheet },
  ];
  const blob = new Blob([createZip(files)], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `daily-qc-results-${rows[0].date}.xlsx`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function buildDailyStrengthRows(records: DailyReadyMixResult[]): DailyStrengthTableRow[] {
  const groups = new Map<string, {
    mixDesign: string;
    plant: string;
    cubeAge: number;
    strengths: number[];
    strengthUnit: string;
  }>();

  for (const record of records) {
    const summary = record.cubeAge === 7 ? record.sevenDay : record.twentyEightDay;
    const strengths = record.strengths.length
      ? record.strengths
      : summary.averageStrength === null
        ? []
        : [summary.averageStrength];
    if (!strengths.length) continue;

    const key = `${record.mixDesign}\u0000${record.location}\u0000${record.cubeAge}`;
    const current = groups.get(key) ?? {
      mixDesign: record.mixDesign,
      plant: record.location,
      cubeAge: record.cubeAge,
      strengths: [],
      strengthUnit: record.strengthUnit,
    };
    current.strengths.push(...strengths);
    groups.set(key, current);
  }

  return [...groups.values()]
    .map((group) => ({
      mixDesign: group.mixDesign,
      plant: group.plant,
      cubeAge: group.cubeAge,
      averageStrength: group.strengths.reduce((sum, value) => sum + value, 0) / group.strengths.length,
      minimumStrength: Math.min(...group.strengths),
      maximumStrength: Math.max(...group.strengths),
      strengthUnit: group.strengthUnit,
    }))
    .sort((left, right) =>
      left.mixDesign.localeCompare(right.mixDesign)
      || left.plant.localeCompare(right.plant)
      || left.cubeAge - right.cubeAge,
    );
}

const referenceSortParts = (value: string) => {
  const normalized = value.trim().toLocaleUpperCase();
  const prefixRank = normalized.startsWith("H")
    ? 0
    : normalized.startsWith("S")
      ? 1
      : 2;
  const numberMatch = normalized.match(/\d+(?:[.,]\d+)?/);
  const number = numberMatch
    ? Number(numberMatch[0].replace(",", "."))
    : Number.POSITIVE_INFINITY;

  return { prefixRank, number, normalized };
};

export function sortByReferenceNumber<T>(
  entries: T[],
  getReferenceNumber: (entry: T) => string,
): T[] {
  return [...entries].sort((left, right) => {
    const leftParts = referenceSortParts(getReferenceNumber(left));
    const rightParts = referenceSortParts(getReferenceNumber(right));

    return leftParts.prefixRank - rightParts.prefixRank
      || leftParts.number - rightParts.number
      || leftParts.normalized.localeCompare(rightParts.normalized, undefined, { numeric: true });
  });
}

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