import {
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

export const qcReferenceCategoriesTable = pgTable(
  "qc_reference_categories",
  {
    id: serial("id").primaryKey(),
    key: text("key").notNull().unique(),
    label: text("label").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
);

export const qcReferenceItemsTable = pgTable(
  "qc_reference_items",
  {
    id: serial("id").primaryKey(),
    categoryId: integer("category_id")
      .notNull()
      .references(() => qcReferenceCategoriesTable.id, { onDelete: "cascade" }),
    value: text("value").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    categoryValueUnique: unique("qc_reference_items_category_value_unique").on(
      table.categoryId,
      table.value,
    ),
  }),
);

export type QcReferenceCategoryRow =
  typeof qcReferenceCategoriesTable.$inferSelect;
export type QcReferenceItemRow = typeof qcReferenceItemsTable.$inferSelect;