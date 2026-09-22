import {
  date,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const qcRecordsTable = pgTable("qc_records", {
  id: serial("id").primaryKey(),
  recordNo: text("record_no").notNull().unique(),
  testType: text("test_type").notNull(),
  sampleDate: date("sample_date", { mode: "string" }).notNull(),
  location: text("location").notNull(),
  material: text("material").notNull(),
  status: text("status").notNull(),
  testedBy: text("tested_by").notNull(),
  reviewedBy: text("reviewed_by"),
  remarks: text("remarks"),
  details: jsonb("details").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertQcRecordSchema = createInsertSchema(qcRecordsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertQcRecord = z.infer<typeof insertQcRecordSchema>;
export type QcRecordRow = typeof qcRecordsTable.$inferSelect;