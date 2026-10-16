import { and, desc, gte, lt } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { db, employeeActivityEventsTable, employeeActivitySessionsTable } from "@workspace/db";
import { GetEmployeeActivityQueryParams } from "@workspace/api-zod";
import { requireAdministrator } from "../middlewares/requireAuthenticated";

const router: IRouter = Router();
const RIYADH_OFFSET_MS = 3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function isRealDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function riyadhDayStart(value: string): Date {
  return new Date(Date.parse(`${value}T00:00:00.000Z`) - RIYADH_OFFSET_MS);
}

function getRiyadhDate(value: Date): string {
  return new Date(value.getTime() + RIYADH_OFFSET_MS)
    .toISOString()
    .slice(0, 10);
}

type SessionEntry = {
  startedAt: string;
  lastSeenAt: string;
  expiresAt: string;
  endedAt: string | null;
  endReason: "logout" | "expired" | "revoked" | null;
};

type ChangeEntry = {
  id: number;
  occurredAt: string;
  action: "created" | "updated" | "deleted";
  entityType: string;
  entityId: string | null;
  summary: string;
  details: Record<string, unknown>;
};

type LoginAttemptEntry = {
  occurredAt: string;
  ipAddress: string;
  location: string;
  outcome: "success" | "failure";
};

type ActivityDay = {
  employeeId: string;
  employeeName: string;
  date: string;
  loginCount: number;
  sessions: SessionEntry[];
  loginAttempts: LoginAttemptEntry[];
  changes: ChangeEntry[];
};

router.get(
  "/employee-activity",
  requireAdministrator,
  async (req, res) => {
    const parsed = GetEmployeeActivityQueryParams.safeParse(req.query);
    if (
      !parsed.success ||
      !isRealDate(parsed.data.from) ||
      !isRealDate(parsed.data.to) ||
      parsed.data.from > parsed.data.to
    ) {
      res.status(400).json({
        error: "Provide valid from and to dates, with from on or before to.",
      });
      return;
    }

    const start = riyadhDayStart(parsed.data.from);
    const endExclusive = new Date(riyadhDayStart(parsed.data.to).getTime() + DAY_MS);
    const [sessions, changes] = await Promise.all([
      db
        .select()
        .from(employeeActivitySessionsTable)
        .where(
          and(
            gte(employeeActivitySessionsTable.startedAt, start),
            lt(employeeActivitySessionsTable.startedAt, endExclusive),
          ),
        )
        .orderBy(desc(employeeActivitySessionsTable.startedAt)),
      db
        .select()
        .from(employeeActivityEventsTable)
        .where(
          and(
            gte(employeeActivityEventsTable.occurredAt, start),
            lt(employeeActivityEventsTable.occurredAt, endExclusive),
          ),
        )
        .orderBy(desc(employeeActivityEventsTable.occurredAt)),
    ]);

    const byDay = new Map<string, ActivityDay>();
    const ensureDay = (
      employeeId: string,
      employeeName: string,
      date: string,
    ): ActivityDay => {
      const key = `${employeeId}\u0000${date}`;
      let day = byDay.get(key);
      if (!day) {
        day = {
          employeeId,
          employeeName,
          date,
          loginCount: 0,
          sessions: [],
          loginAttempts: [],
          changes: [],
        };
        byDay.set(key, day);
      }
      return day;
    };

    const now = new Date();
    for (const session of sessions) {
      const day = ensureDay(
        session.employeeId,
        session.employeeName,
        getRiyadhDate(session.startedAt),
      );
      const inferredExpired = !session.endedAt && session.expiresAt < now;
      const storedEndReason =
        session.endReason === "logout" ||
        session.endReason === "expired" ||
        session.endReason === "revoked"
          ? session.endReason
          : null;
      day.sessions.push({
        startedAt: session.startedAt.toISOString(),
        lastSeenAt: session.lastSeenAt.toISOString(),
        expiresAt: session.expiresAt.toISOString(),
        endedAt: (session.endedAt ?? (inferredExpired ? session.expiresAt : null))
          ?.toISOString() ?? null,
        endReason: storedEndReason ?? (inferredExpired ? "expired" : null),
      });
      day.loginCount += 1;
    }

    for (const change of changes) {
      const day = ensureDay(
        change.employeeId,
        change.employeeName,
        getRiyadhDate(change.occurredAt),
      );
      if (change.entityType === "Login attempt") {
        day.loginAttempts.push({
          occurredAt: change.occurredAt.toISOString(),
          ipAddress:
            typeof change.details.ipAddress === "string"
              ? change.details.ipAddress
              : "Unknown",
          location:
            typeof change.details.location === "string"
              ? change.details.location
              : "Unavailable",
          outcome: change.details.outcome === "success" ? "success" : "failure",
        });
        continue;
      }
      day.changes.push({
        id: change.id,
        occurredAt: change.occurredAt.toISOString(),
        action: change.action as ChangeEntry["action"],
        entityType: change.entityType,
        entityId: change.entityId,
        summary: change.summary,
        details: change.details,
      });
    }

    const records = [...byDay.values()]
      .map((day) => ({
        ...day,
        sessions: day.sessions.sort(
          (left, right) =>
            new Date(left.startedAt).getTime() -
            new Date(right.startedAt).getTime(),
        ),
        changes: day.changes.sort(
          (left, right) =>
            new Date(right.occurredAt).getTime() -
            new Date(left.occurredAt).getTime(),
        ),
        loginAttempts: day.loginAttempts.sort(
          (left, right) =>
            new Date(right.occurredAt).getTime() -
            new Date(left.occurredAt).getTime(),
        ),
      }))
      .sort(
        (left, right) =>
          right.date.localeCompare(left.date) ||
          left.employeeName.localeCompare(right.employeeName),
      );

    res.json({ records });
  },
);

export default router;