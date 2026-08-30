import {
  index,
  integer,
  pgTable,
  serial,
  date,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { usersTable } from "./auth";

export const archiveDocumentsTable = pgTable(
  "archive_documents",
  {
    id: serial("id").primaryKey(),
    originalName: text("original_name").notNull(),
    objectPath: text("object_path").notNull().unique(),
    mimeType: text("mime_type").notNull(),
    size: integer("size").notNull(),
    category: text("category").notNull(),
    subcategory: text("subcategory").notNull(),
    documentDate: date("document_date", { mode: "string" })
      .notNull()
      .default(sql`CURRENT_DATE`),
    expiryDate: date("expiry_date", { mode: "string" }),
    description: text("description").notNull().default(""),
    uploadedBy: varchar("uploaded_by").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    categoryIndex: index("archive_documents_category_idx").on(table.category),
    subcategoryIndex: index("archive_documents_subcategory_idx").on(
      table.subcategory,
    ),
  }),
);

export type ArchiveDocumentRow = typeof archiveDocumentsTable.$inferSelect;