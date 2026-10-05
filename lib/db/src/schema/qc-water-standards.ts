import {
  boolean,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const qcWaterStandardsTable = pgTable("qc_water_standards", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  phMin: numeric("ph_min", { precision: 10, scale: 2 }).notNull(),
  phMax: numeric("ph_max", { precision: 10, scale: 2 }).notNull(),
  chlorideMin: numeric("chloride_min", { precision: 10, scale: 2 }).notNull(),
  chlorideMax: numeric("chloride_max", { precision: 10, scale: 2 }).notNull(),
  tdsMin: numeric("tds_min", { precision: 10, scale: 2 }).notNull(),
  tdsMax: numeric("tds_max", { precision: 10, scale: 2 }).notNull(),
  so3Min: numeric("so3_min", { precision: 10, scale: 2 }).notNull(),
  so3Max: numeric("so3_max", { precision: 10, scale: 2 }).notNull(),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertQcWaterStandardSchema = createInsertSchema(
  qcWaterStandardsTable,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertQcWaterStandard = z.infer<typeof insertQcWaterStandardSchema>;
export type QcWaterStandardRow = typeof qcWaterStandardsTable.$inferSelect;
