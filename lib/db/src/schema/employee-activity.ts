import { sql } from "drizzle-orm";
import {
  index,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const employeeActivitySessionsTable = pgTable(
  "employee_activity_sessions",
  {
    sessionFingerprint: text("session_fingerprint").primaryKey(),
    employeeId: text("employee_id").notNull(),
    employeeName: text("employee_name").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    endReason: text("end_reason"),
  },
  (table) => [
    index("employee_activity_sessions_started_idx").on(table.startedAt),
    index("employee_activity_sessions_employee_started_idx").on(
      table.employeeId,
      table.startedAt,
    ),
  ],
);

export const employeeActivityEventsTable = pgTable(
  "employee_activity_events",
  {
    id: serial("id").primaryKey(),
    employeeId: text("employee_id").notNull(),
    employeeName: text("employee_name").notNull(),
    sessionFingerprint: text("session_fingerprint"),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    summary: text("summary").notNull(),
    details: jsonb("details")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
  },
  (table) => [
    index("employee_activity_events_occurred_idx").on(table.occurredAt),
    index("employee_activity_events_employee_occurred_idx").on(
      table.employeeId,
      table.occurredAt,
    ),
  ],
);

export type EmployeeActivitySession =
  typeof employeeActivitySessionsTable.$inferSelect;
export type EmployeeActivityEvent =
  typeof employeeActivityEventsTable.$inferSelect;