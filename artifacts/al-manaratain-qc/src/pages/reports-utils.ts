import type {
  DailyReadyMixResult,
  DailyReadyMixStrengthSummary,
  QcRecord,
} from "@workspace/api-client-react";

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
  category: string;
  plant: string;
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

type StrengthGroup = {
  date: string;
  category: string;
  plant: string;
  product: string;
  cubeAge: number | null;
  strengths: number[];
  strengthUnit: string;
};

const numericValue = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const parsed = Number.parseFloat(value.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
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

const recordProduct = (record: QcRecord, details: Record<string, unknown>) => {
  if (record.testType === "Ready Mix") {
    return firstWords(detailsValue(details, ["designStrength", "mixStrength", "mixType"]) || record.material, 3);
  }
  return firstWords(
    detailsValue(details, ["blockType", "blockSize", "sampleType", "sieveSize", "materialCondition"])
      || record.material,
    2,
  );
};

const recordAge = (record: QcRecord, details: Record<string, unknown>) =>
  record.testType === "Blocks" || record.testType === "Paving Blocks"
    ? numericValue(detailsValue(details, ["blockAge"]))
    : null;

const rowStrength = (row: unknown) => {
  if (typeof row !== "object" || row === null) return null;
  const values = row as Record<string, unknown>;
  return numericValue(
    values.correctedStrength ??
    values.normalizedStrength ??
    values.airDryStrength ??
    values.calculatedStrength ??
    values.strength ??
    values.compressiveStrength,
  );
};

const blockAirDryStrength = (row: unknown, location: string) => {
  if (typeof row !== "object" || row === null) return null;
  const values = row as Record<string, unknown>;
  const storedAirDryStrength = numericValue(values.airDryStrength ?? values.dryAirStrength);
  if (storedAirDryStrength !== null) return storedAirDryStrength;
  const waterStrength = numericValue(
    values.calculatedStrength ??
    values.strength ??
    values.compressiveStrength,
  );
  if (waterStrength === null) return null;
  return Number((waterStrength * (location.trim().toLocaleLowerCase() === "dammam" ? 1 : 1.2)).toFixed(1));
};

const recordStrengths = (record: QcRecord, details: Record<string, unknown>) => {
  const rows = Array.isArray(details.testRows) ? details.testRows : [];
  const strengths = rows
    .map((row) => record.testType === "Blocks"
      ? blockAirDryStrength(row, record.location)
      : rowStrength(row))
    .filter((value): value is number => value !== null);
  if (strengths.length) return strengths;
  const directStrength = numericValue(
    record.testType === "Blocks"
      ? details.averageStrength ??
        details.airDryStrength ??
        details.dryAirStrength ??
        details.calculatedStrength ??
        details.strength ??
        details.compressiveStrength
      : details.averageStrength ??
        details.correctedStrength ??
        details.normalizedStrength ??
        details.airDryStrength ??
        details.calculatedStrength ??
        details.strength ??
        details.compressiveStrength,
  );
  if (directStrength === null) return [];
  if (record.testType !== "Blocks" || details.averageStrength !== undefined || details.airDryStrength !== undefined) {
    return [directStrength];
  }
  return [Number((directStrength * (record.location.trim().toLocaleLowerCase() === "dammam" ? 1 : 1.2)).toFixed(1))];
};

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
): DailyReportRow[] {
  const groups = new Map<string, StrengthGroup>();
  const selected = new Set(selectedProducts);
  const inRange = (date: string) => date >= startDate && date <= endDate;

  const addStrengths = (
    record: QcRecord,
    date: string | null,
    product: string,
    cubeAge: number | null,
    strengths: number[],
  ) => {
    if (!date || !inRange(date) || !strengths.length) return;
    const category = record.testType;
    const key = `${date}\u0000${category}\u0000${record.location}\u0000${product}\u0000${cubeAge ?? ""}`;
    if (selected.size && !selected.has(`${category}\u0000${product}`)) return;
    const current = groups.get(key) ?? {
      date,
      category,
      plant: record.location,
      product,
      cubeAge,
      strengths: [],
      strengthUnit: "N/mm²",
    };
    current.strengths.push(...strengths);
    groups.set(key, current);
  };

  for (const record of records) {
    const details = record.details as Record<string, unknown>;
    const product = recordProduct(record, details);
    if (record.testType === "Ready Mix") {
      const rows = Array.isArray(details.testRows) ? details.testRows : [];
      const ageGroups = new Map<number, number[]>();
      for (const row of rows) {
        if (typeof row !== "object" || row === null) continue;
        const age = numericValue((row as Record<string, unknown>).testAge ??
          (row as Record<string, unknown>).cubeAge ??
          (row as Record<string, unknown>).age);
        const strength = rowStrength(row);
        if (age === null || strength === null) continue;
        const current = ageGroups.get(age) ?? [];
        current.push(strength);
        ageGroups.set(age, current);
      }
      if (ageGroups.size) {
        for (const [age, strengths] of ageGroups) {
          addStrengths(record, addDays(record.sampleDate, age), product, age, strengths);
        }
      } else {
        addStrengths(record, record.sampleDate.slice(0, 10), product, null, recordStrengths(record, details));
      }
      continue;
    }
    addStrengths(
      record,
      record.sampleDate.slice(0, 10),
      product,
      recordAge(record, details),
      recordStrengths(record, details),
    );
  }

  return [...groups.values()]
    .map((group) => ({
      date: group.date,
      category: group.category,
      plant: group.plant,
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
  const headers = ["Category", "Age (days)", "Date", "Plant", "Type / Mix Design", "Average", "Minimum", "Maximum", "Std. Dev."];
  const columns = ["A", "B", "C", "D", "E", "F", "G", "H", "I"];
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
        inlineStringCell(`C${rowNumber}`, row.date) +
        inlineStringCell(`D${rowNumber}`, row.plant) +
        inlineStringCell(`E${rowNumber}`, row.product) +
        numberCell(`F${rowNumber}`, row.averageStrength) +
        numberCell(`G${rowNumber}`, row.minimumStrength) +
        numberCell(`H${rowNumber}`, row.maximumStrength) +
        numberCell(`I${rowNumber}`, row.standardDeviation)
      }</row>`;
    }),
  ].join("");
  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="A1:I${rows.length + 4}"/>
  <cols>
    <col min="1" max="1" width="18" customWidth="1"/>
    <col min="2" max="2" width="12" customWidth="1"/>
    <col min="3" max="3" width="14" customWidth="1"/>
    <col min="4" max="4" width="18" customWidth="1"/>
    <col min="5" max="5" width="24" customWidth="1"/>
    <col min="6" max="9" width="15" customWidth="1"/>
  </cols>
  <sheetData>${sheetRows}</sheetData>
  <mergeCells count="1"><mergeCell ref="A1:I1"/></mergeCells>
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