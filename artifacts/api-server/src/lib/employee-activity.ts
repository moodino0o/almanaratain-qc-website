import { createHash } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { and, eq, isNull } from "drizzle-orm";
import {
  db,
  employeeActivityEventsTable,
  employeeActivitySessionsTable,
} from "@workspace/db";

function getRequestSessionId(req: Request): string | undefined {
  const authorization = req.headers.authorization;
  if (authorization?.startsWith("Bearer ")) return authorization.slice(7);
  return req.cookies?.sid;
}

export type ActivitySessionEndReason = "logout" | "expired" | "revoked";
export type ActivityChangeAction = "created" | "updated" | "deleted";

export function fingerprintSessionId(sessionId: string): string {
  return createHash("sha256").update(sessionId).digest("hex");
}

export function getActivityEmployeeName(
  user: unknown,
  fallbackEmployeeId: string,
): string {
  if (!user || typeof user !== "object") return fallbackEmployeeId;

  const profile = user as Record<string, unknown>;
  const displayName = [profile.displayName, profile.name, profile.fullName].find(
    (value): value is string =>
      typeof value === "string" && value.trim().length > 0,
  );
  if (displayName) return displayName.trim();

  const firstName =
    typeof profile.firstName === "string" ? profile.firstName.trim() : "";
  const lastName =
    typeof profile.lastName === "string" ? profile.lastName.trim() : "";
  return [firstName, lastName].filter(Boolean).join(" ") || fallbackEmployeeId;
}

export async function touchEmployeeActivitySession(
  sessionId: string,
  expiresAt?: Date,
): Promise<void> {
  const now = new Date();
  await db
    .update(employeeActivitySessionsTable)
    .set({
      lastSeenAt: now,
      ...(expiresAt ? { expiresAt } : {}),
    })
    .where(
      and(
        eq(
          employeeActivitySessionsTable.sessionFingerprint,
          fingerprintSessionId(sessionId),
        ),
        isNull(employeeActivitySessionsTable.endedAt),
      ),
    );
}

export async function closeEmployeeActivitySession(
  sessionId: string,
  endReason: ActivitySessionEndReason,
  endedAt = new Date(),
): Promise<void> {
  await db
    .update(employeeActivitySessionsTable)
    .set({ endedAt, endReason })
    .where(
      and(
        eq(
          employeeActivitySessionsTable.sessionFingerprint,
          fingerprintSessionId(sessionId),
        ),
        isNull(employeeActivitySessionsTable.endedAt),
      ),
    );
}

const sensitiveKeyPattern =
  /password|token|cookie|authorization|secret|credential|private.?key|api.?key|session(?:id|key)?/i;

function sanitizeAuditValue(
  value: unknown,
  key = "",
  depth = 0,
): unknown {
  if (sensitiveKeyPattern.test(key)) return "[redacted]";
  if (depth > 6) return "[nested values omitted]";
  if (typeof value === "string") {
    return value.length > 3000 ? `${value.slice(0, 3000)}…[truncated]` : value;
  }
  if (
    value === null ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) {
    const entries = value
      .slice(0, 100)
      .map((entry) => sanitizeAuditValue(entry, "", depth + 1));
    if (value.length > 100) entries.push(`[${value.length - 100} more items]`);
    return entries;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .slice(0, 100)
      .map(([entryKey, entryValue]) => [
        entryKey,
        sanitizeAuditValue(entryValue, entryKey, depth + 1),
      ]);
    const result = Object.fromEntries(entries);
    if (Object.keys(value as Record<string, unknown>).length > 100) {
      result["[truncated]"] = "Additional fields omitted";
    }
    return result;
  }
  return String(value);
}

function getAction(method: string): ActivityChangeAction | null {
  if (method === "POST") return "created";
  if (method === "PUT" || method === "PATCH") return "updated";
  if (method === "DELETE") return "deleted";
  return null;
}

function getEntityType(path: string): string {
  const rules: Array<[RegExp, string]> = [
    [/\/auth\/employee-access(?:\/|$)/, "Employee access"],
    [/\/employees?(?:\/|$)/, "Employee directory"],
    [/\/records?(?:\/|$)/, "QC record"],
    [/\/complaints?(?:\/|$)/, "Complaint"],
    [/\/archive(?:\/|$)/, "Archive document"],
    [/\/reference-data\/categories(?:\/|$)/, "Reference category"],
    [/\/reference-data\/items?(?:\/|$)/, "Reference item"],
    [/\/reference-data(?:\/|$)/, "Reference data"],
    [/\/strength-standards?(?:\/|$)/, "Strength standard"],
    [/\/sieve-standards?(?:\/|$)/, "Sieve standard"],
    [/\/shape-factors?(?:\/|$)/, "Shape factor"],
    [/\/report-layouts?(?:\/|$)/, "Report layout"],
    [/\/storage(?:\/|$)/, "Stored file"],
  ];
  return rules.find(([pattern]) => pattern.test(path))?.[1] ?? "QC data";
}

function getPathEntityId(path: string): string | null {
  const segments = path.split("/").filter(Boolean);
  const numericId = [...segments].reverse().find((segment) => /^\d+$/.test(segment));
  if (numericId) return numericId;
  const last = segments.at(-1);
  return last && /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(last) ? last : null;
}

function getResponseEntityId(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const result = body as Record<string, unknown>;
  const candidates = [
    result.id,
    (result.record as Record<string, unknown> | undefined)?.id,
    (result.item as Record<string, unknown> | undefined)?.id,
    (result.data as Record<string, unknown> | undefined)?.id,
  ];
  const id = candidates.find(
    (value) => typeof value === "string" || typeof value === "number",
  );
  return id == null ? null : String(id);
}

export async function recordEmployeeActivityChange(input: {
  employeeId: string;
  employeeName: string;
  sessionId?: string;
  action: ActivityChangeAction;
  entityType: string;
  entityId: string | null;
  path: string;
  submitted: unknown;
}): Promise<void> {
  const sanitized = sanitizeAuditValue(input.submitted);
  const serialized = JSON.stringify(sanitized);
  const details =
    serialized.length > 20000
      ? {
          submittedPreview: serialized.slice(0, 19000),
          truncated: true,
        }
      : { submitted: sanitized };

  await db.insert(employeeActivityEventsTable).values({
    employeeId: input.employeeId,
    employeeName: input.employeeName,
    sessionFingerprint: input.sessionId
      ? fingerprintSessionId(input.sessionId)
      : null,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    summary: `${input.action[0].toUpperCase()}${input.action.slice(1)} ${input.entityType.toLowerCase()}${input.entityId ? ` #${input.entityId}` : ""}`,
    details: {
      ...details,
      path: input.path,
    },
  });
}

export function employeeActivityAuditMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const action = getAction(req.method);
  const employeeId = req.user?.id?.startsWith("employee:")
    ? req.user.id.slice("employee:".length).trim()
    : "";
  const path = req.path;

  if (
    !action ||
    !employeeId ||
    /\/logout(?:\/|$)/i.test(path) ||
    /\/employee-activity(?:\/|$)/i.test(path)
  ) {
    next();
    return;
  }

  let responseEntityId: string | null = null;
  const originalJson = res.json.bind(res);
  res.json = ((body: unknown) => {
    responseEntityId = getResponseEntityId(body);
    return originalJson(body);
  }) as Response["json"];

  res.on("finish", () => {
    if (res.statusCode < 200 || res.statusCode >= 300) return;

    const id = getPathEntityId(path) ?? responseEntityId;
    const submitted = sanitizeAuditValue(req.body ?? {});
    const serialized = JSON.stringify(submitted);
    const boundedSubmitted =
      serialized.length > 20000
        ? { submittedPreview: serialized.slice(0, 19000), truncated: true }
        : submitted;

    void recordEmployeeActivityChange({
      employeeId,
      employeeName: getActivityEmployeeName(req.user, employeeId),
      sessionId: getRequestSessionId(req),
      action,
      entityType: getEntityType(path),
      entityId: id,
      path,
      submitted: boundedSubmitted,
    }).catch((error: unknown) => {
      console.error(
        "Could not persist employee activity event.",
        error instanceof Error ? error.message : "Unknown error",
      );
    });
  });

  next();
}