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

export const complaintsTable = pgTable("complaints", {
  id: serial("id").primaryKey(),
  complaintNo: text("complaint_no").notNull().unique(),
  customerName: text("customer_name").notNull(),
  deliveryDate: date("delivery_date", { mode: "string" }).notNull(),
  complaintType: text("complaint_type").notNull(),
  materialType: text("material_type").notNull(),
  details: text("details").notNull(),
  solution: text("solution").notNull().default(""),
  recommendation: text("recommendation").notNull().default(""),
  status: text("status").notNull().default("open"),
  picturePaths: jsonb("picture_paths")
    .$type<Array<{
      objectPath: string;
      originalName: string;
      mimeType: string;
      size: number;
    }>>()
    .notNull()
    .default([]),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertComplaintSchema = createInsertSchema(complaintsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertComplaint = z.infer<typeof insertComplaintSchema>;
export type ComplaintRow = typeof complaintsTable.$inferSelect;