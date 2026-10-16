const MASONRY_TEST_TYPES = new Set(["Blocks", "Paving Blocks"]);

export function normalizeMasonryMachineName(value: string) {
  const normalized = value.trim().toLocaleUpperCase();
  if (normalized === "H1") return "HENKI I";
  if (normalized === "H2") return "HENKI II";
  return value;
}

export function normalizeMasonryMachineDetails(
  testType: string,
  details: Record<string, unknown>,
) {
  if (!MASONRY_TEST_TYPES.has(testType)) return details;

  let normalizedDetails: Record<string, unknown> | null = null;
  for (const key of ["machine", "machineType"] as const) {
    const value = details[key];
    if (typeof value !== "string") continue;
    const normalizedValue = normalizeMasonryMachineName(value);
    if (normalizedValue === value) continue;
    normalizedDetails ??= { ...details };
    normalizedDetails[key] = normalizedValue;
  }
  return normalizedDetails ?? details;
}