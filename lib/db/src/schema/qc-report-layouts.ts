import {
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const qcReportLayoutsTable = pgTable("qc_report_layouts", {
  id: serial("id").primaryKey(),
  testType: text("test_type").notNull().unique(),
  name: text("name").notNull(),
  config: jsonb("config").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type QcReportLayoutRow = typeof qcReportLayoutsTable.$inferSelect;