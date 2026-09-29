const EMPLOYEE_ADDABLE_REFERENCE_CATEGORY_KEYS = new Set([
  "locations",
  "customers",
  "customerLocations",
  "mixStrengths",
  "machines",
]);

export function canEmployeeAddReferenceCategory(categoryKey: string): boolean {
  return EMPLOYEE_ADDABLE_REFERENCE_CATEGORY_KEYS.has(categoryKey);
}