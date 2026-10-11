/** The only record/detail keys that report layouts may bind to. */
export type ReportLayoutField = {
  key: string;
  label: string;
  width: number;
};

const fields = (items: Array<[string, string, number]>): ReportLayoutField[] =>
  items.map(([key, label, width]) => ({ key, label, width }));

export const REPORT_LAYOUT_FIELD_GROUPS: Record<string, Record<string, ReportLayoutField[]>> = {
  "Ready Mix": {
    readyMixDetails: fields([
      ["customerName", "Customer Name", 25], ["customerLocation", "Customer Location", 25],
      ["projectName", "Project Name", 25], ["otherDetails", "Other Details", 25],
      ["castedBy", "Casted By", 25], ["sampleNumber", "Sample No.", 25],
      ["slump", "Slump (mm)", 25], ["temperature", "Temperature", 25], ["compactionType", "Compaction Type", 25],
    ]),
    readyMixResults: fields([
      ["testingDate", "Testing Date", 18], ["age", "Cube Age", 12], ["weight", "Cube Weight (g)", 16],
      ["load", "Load (kN)", 16], ["strength", "Strength (N/mm²)", 19], ["absorption", "Water Absorption (%)", 19],
    ]),
  },
  Blocks: {
    blockDetails: fields([
      ["blockSize", "Block Size", 25], ["testingDate", "Testing Date", 25], ["blockAge", "Block Age", 25],
      ["machine", "Machine Type", 25], ["sampleType", "Sample Type", 25], ["conditioningMethod", "Conditioning", 25],
      ["preparationMethod", "Preparation", 25], ["shapeFactor", "Shape Factor", 25], ["blockType", "Block Type", 25],
      ["faceThickness", "Face Thickness (mm)", 18], ["webThickness", "Web Thickness (mm)", 18],
      ["numberOfHoles", "Number of Holes", 14],
    ]),
    blockCompression: fields([
      ["no", "No.", 7], ["length", "Length (mm)", 9], ["width", "Width (mm)", 9], ["height", "Height (mm)", 9],
      ["faceArea", "Net Area (mm²)", 12], ["load", "Load (kN)", 9], ["water", "Water (N/mm2)", 10],
      ["airDry", "Air Dry (N/mm2)", 10], ["normalized", "Normalized (N/mm2)", 12], ["density", "Density (kg/m3)", 13],
      ["grossArea", "Gross Area (mm²)", 10], ["netArea", "Net Area (mm²)", 10],
      ["grossStrength", "Gross Strength (N/mm²)", 10], ["netStrength", "Net Strength (N/mm²)", 10],
    ]),
  },
  "Paving Blocks": {
    pavingDetails: fields([["pavingBlockSize", "Block Size", 25], ["testingDate", "Testing Date", 25], ["blockAge", "Block Age", 25], ["machine", "Machine Type", 25], ["sampleType", "Sample Type", 25], ["correctionFactor", "Correction Factor", 25], ["blockType", "Paving Block Type", 25]]),
    pavingResults: fields([["no", "Block No.", 7], ["age", "Test Age", 9], ["length", "Length (mm)", 10], ["width", "Width (mm)", 10], ["height", "Height (mm)", 10], ["dryWeight", "Dry Weight", 10], ["wetWeight", "Wet Weight", 10], ["load", "Load (kN)", 10], ["strength", "Calculated Strength", 14], ["density", "Density (kg/m³)", 11], ["waterAbsorption", "% Water Absorption", 11]]),
  },
  "Sand Sieve": { sieveSampleDetails: fields([["sampleAge", "Age (days)", 25], ["testingDate", "Testing Date", 25], ["supplier", "Supplier", 25], ["materialCondition", "Material Condition", 25]]), sieveResults: fields([["no", "No.", 6], ["size", "Sieve / Pore Size", 17], ["returned", "Mass Retained (g)", 13], ["retained", "Retained (%)", 9], ["passing", "Amount Passing (g)", 11], ["percentage", "Passing (%)", 8], ["lower", "Lower Limit", 12], ["upper", "Upper Limit", 12], ["remarks", "Remarks", 18]]), sieveChemicalDetails: fields([["siltBefore", "Silt Before", 25], ["siltAfter", "Silt After", 25]]) },
  "Aggregate Sieve": { sieveSampleDetails: fields([["sampleAge", "Age (days)", 25], ["testingDate", "Testing Date", 25], ["supplier", "Supplier", 25], ["materialCondition", "Material Condition", 25]]), sieveResults: fields([["no", "No.", 6], ["size", "Sieve / Pore Size", 17], ["returned", "Mass Retained (g)", 13], ["retained", "Retained (%)", 9], ["passing", "Amount Passing (g)", 11], ["percentage", "Passing (%)", 8], ["lower", "Lower Limit", 12], ["upper", "Upper Limit", 12], ["remarks", "Remarks", 18]]), sieveChemicalDetails: fields([["siltBefore", "Silt Before", 20], ["siltAfter", "Silt After", 20], ["silverNitrateContent", "Silver Nitrate", 20], ["firstChlorideTitrationPoint", "First Titration", 20], ["secondChlorideTitrationPoint", "Second Titration", 20], ["crucibleWeight", "Crucible Weight", 20], ["crucibleAshWeight", "Crucible Ash Weight", 20]]) },
  Water: { waterDetails: fields([["source", "Source", 20], ["ph", "pH", 20], ["tds", "TDS", 20], ["chloride", "Chloride", 20], ["sulphate", "Sulphate", 20]]), genericContext: fields([["sampleDate", "Sample Date", 25], ["location", "Location", 25], ["material", "Material", 25], ["testedBy", "Tested By", 25]]) },
  "Flakiness & Elongation": { flakinessDetails: fields([["observation1", "Observation 1", 50], ["observation2", "Observation 2", 50]]) },
  "RMX Trial": { rmxTrialDetails: fields([["observation1", "Observation 1", 50], ["observation2", "Observation 2", 50]]) },
  Precast: {
    precastDetails: fields([
      ["sampleDate", "Casting Date", 14], ["sampleNo", "Sample No.", 14],
      ["precastMouldNo", "Precast Mould No.", 14], ["jobNo", "Job No.", 12],
      ["customerName", "Customer Name", 18], ["material", "Product Type", 12],
      ["cubeSize", "Cube Size (mm)", 14], ["location", "Testing Location", 16],
      ["compactionType", "Compaction", 16], ["testedBy", "Tested By", 14],
    ]),
    precastResults: fields([
      ["age", "Cube Age (days)", 8], ["testingDate", "Testing Date", 16],
      ["cubeSize", "Cube Size (mm)", 14], ["weight", "Weight (g)", 11],
      ["density", "Density (kg/m³)", 14], ["load", "Load (kN)", 14],
      ["strength", "Compressive Strength (N/mm²)", 23],
    ]),
  },
  "Kerb Stone": { kerbStoneDetails: fields([["sampleDate", "Casting Date", 16], ["testingDate", "Testing Date", 16], ["age", "Age (days)", 10], ["kerbType", "Kerb Type", 14], ["kerbClass", "Class", 8], ["kerbMarking", "Marking", 8], ["characteristicBendingStrength", "Characteristic bending (MPa)", 18], ["minimumIndividualStrength", "Minimum individual (MPa)", 18], ["waterAbsorptionLimit", "Max. water absorption (%)", 18]]) },
};

const genericContext = fields([
  ["sampleDate", "Sample Date", 25], ["location", "Location", 25],
  ["material", "Material", 25], ["testedBy", "Tested By", 25],
  ["observation1", "Observation 1", 25], ["observation2", "Observation 2", 25],
]);
for (const groups of Object.values(REPORT_LAYOUT_FIELD_GROUPS)) {
  groups.genericContext ??= genericContext;
}

export const REPORT_LAYOUT_FIELDS = REPORT_LAYOUT_FIELD_GROUPS;
export function fieldsForReport(testType: string, tableKey: string) {
  return REPORT_LAYOUT_FIELD_GROUPS[testType]?.[tableKey] ?? [];
}