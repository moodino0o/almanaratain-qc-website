import {
  boolean,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const qcReportTemplatesTable = pgTable("qc_report_templates", {
  id: serial("id").primaryKey(),
  testType: text("test_type").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  isDefault: boolean("is_default").notNull().default(false),
  version: integer("version").notNull().default(1),
  design: jsonb("design").$type<Record<string, unknown>>().notNull(),
  history: jsonb("history").$type<Record<string, unknown>[]>().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type QcReportTemplateRow = typeof qcReportTemplatesTable.$inferSelect;