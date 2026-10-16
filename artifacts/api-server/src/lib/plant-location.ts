const easternPlantLocations = new Set([
  "eastern",
  "eastern hidd",
  "eastern aker",
  "eastern system",
]);

export function canonicalPlantLocation(location: string): string {
  const normalized = location.trim().toLocaleLowerCase().replace(/\s+/g, " ");
  return easternPlantLocations.has(normalized) ? "EASTERN" : location;
}
