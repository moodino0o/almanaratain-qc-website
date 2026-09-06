const REGISTERED_EMPLOYEE_IDS = new Set(["62925", "29102", "35716"]);

export function normalizeEmployeeId(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function isRegisteredEmployeeId(value: unknown): boolean {
  return REGISTERED_EMPLOYEE_IDS.has(normalizeEmployeeId(value));
}

export function isEmployeeSessionId(value: unknown): boolean {
  return typeof value === "string" && value.startsWith("employee:") &&
    isRegisteredEmployeeId(value.slice("employee:".length));
}