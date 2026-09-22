import {
  integer,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { qcReferenceItemsTable } from "./qc-reference-data";

export const qcSieveStandardsTable = pgTable(
  "qc_sieve_standards",
  {
    id: serial("id").primaryKey(),
    testType: text("test_type").notNull(),
    materialReferenceItemId: integer("material_reference_item_id")
      .notNull()
      .references(() => qcReferenceItemsTable.id, { onDelete: "restrict" }),
    sieveSizeReferenceItemId: integer("sieve_size_reference_item_id")
      .notNull()
      .references(() => qcReferenceItemsTable.id, { onDelete: "restrict" }),
    standardReference: text("standard_reference").notNull(),
    measurementType: text("measurement_type").notNull(),
    minimum: numeric("minimum", { precision: 10, scale: 3 }),
    maximum: numeric("maximum", { precision: 10, scale: 3 }),
    unit: text("unit").notNull().default("%"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    sieveRuleUnique: unique("qc_sieve_standards_rule_unique").on(
      table.testType,
      table.materialReferenceItemId,
      table.sieveSizeReferenceItemId,
      table.measurementType,
    ),
  }),
);

export const insertQcSieveStandardSchema = createInsertSchema(
  qcSieveStandardsTable,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertQcSieveStandard = z.infer<typeof insertQcSieveStandardSchema>;
export type QcSieveStandardRow = typeof qcSieveStandardsTable.$inferSelect;