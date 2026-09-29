const ageDetailKeyForTestType: Record<string, "blockAge" | "sampleAge"> = {
  Blocks: "blockAge",
  "Paving Blocks": "blockAge",
  "Sand Sieve": "sampleAge",
  "Aggregate Sieve": "sampleAge",
};

export function calculateRecordTestingDate(
  testType: string,
  sampleDate: string,
  details: Record<string, unknown>,
) {
  const ageKey = ageDetailKeyForTestType[testType];
  if (!ageKey) {
    return { details, testingDate: null as string | null, error: null as string | null };
  }

  const ageText = String(details[ageKey] ?? "").trim();
  const age = ageText ? Number(ageText) : Number.NaN;
  if (!Number.isFinite(age) || age <= 0) {
    return {
      details,
      testingDate: null,
      error: `A valid ${ageKey === "blockAge" ? "Block age" : "Age"} in days greater than zero is required.`,
    };
  }

  const date = new Date(`${sampleDate.slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    return { details, testingDate: null, error: "Sample date must be valid." };
  }
  date.setUTCDate(date.getUTCDate() + age);
  const testingDate = date.toISOString().slice(0, 10);
  return {
    details: { ...details, testingDate },
    testingDate,
    error: null,
  };
}