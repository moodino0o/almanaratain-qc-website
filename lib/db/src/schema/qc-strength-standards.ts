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
  cubeAge: numeric("cube_age", { precision: 4, scale: 0 }),
  kerbClass: numeric("kerb_class", { precision: 2, scale: 0 }),
  kerbMarking: text("kerb_marking"),
  bsStandard: text("bs_standard").notNull(),
  requiredStrength: numeric("required_strength", { precision: 10, scale: 2 }).notNull(),
  minimumIndividualStrength: numeric("minimum_individual_strength", { precision: 10, scale: 2 }),
  dammamAverageStrength: numeric("dammam_average_strength", { precision: 10, scale: 2 }),
  dammamMinimumStrength: numeric("dammam_minimum_strength", { precision: 10, scale: 2 }),
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