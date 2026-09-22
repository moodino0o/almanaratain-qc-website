import {
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const qcStrengthStandardsTable = pgTable("qc_strength_standards", {
  id: serial("id").primaryKey(),
  testType: text("test_type").notNull(),
  material: text("material").notNull(),
  blockType: text("block_type"),
  blockSize: text("block_size"),
  bsStandard: text("bs_standard").notNull(),
  requiredStrength: numeric("required_strength", { precision: 10, scale: 2 }).notNull(),
  strengthUnit: text("strength_unit").notNull().default("N/mm²"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertQcStrengthStandardSchema = createInsertSchema(
  qcStrengthStandardsTable,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertQcStrengthStandard = z.infer<typeof insertQcStrengthStandardSchema>;
export type QcStrengthStandardRow = typeof qcStrengthStandardsTable.$inferSelect;