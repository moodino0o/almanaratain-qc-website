import {
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const qcShapeFactorsTable = pgTable("qc_shape_factors", {
  id: serial("id").primaryKey(),
  // blockType is retained for compatibility with the first per-type version.
  blockType: text("block_type"),
  blockSize: text("block_size").unique(),
  shapeFactor: numeric("shape_factor", { precision: 10, scale: 3 }),
  correctionFactor: numeric("correction_factor", { precision: 10, scale: 3 }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type QcShapeFactorRow = typeof qcShapeFactorsTable.$inferSelect;